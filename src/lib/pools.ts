import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { distributePrizes, rankEntries, type Cents, type PrizeKind, type Sport } from "@/domain";
import { playerName } from "./format";
import { createClient } from "./supabase/server";

export interface PoolRound {
  id: string;
  name: string;
  ordinal: number;
  potCents: Cents;
  jackpotCents: Cents;
  settled: boolean;
  results: RoundResult[];
}

export interface RoundResult {
  playerId: string;
  name: string;
  points: number;
  position: number;
  prizeCents: Cents;
  bonusCents: Cents;
}

export interface SeasonRow {
  playerId: string;
  name: string;
  points: number;
  position: number;
  wonCents: Cents;
  /** Entry fees for every completed round: everyone enrolled pays every round. */
  paidCents: Cents;
  netCents: Cents;
  /** Jackpot prize this player would take if the season ended today. */
  jackpotPrize: { kind: PrizeKind; cents: Cents } | null;
}

export interface PoolOverview {
  id: string;
  name: string;
  sport: Sport;
  jackpotBalanceCents: Cents;
  rounds: PoolRound[];
  season: SeasonRow[];
}

/** Everything the standings screens need for one pool, read with the player's session. */
export const getPoolOverview = cache(async (poolId: string): Promise<PoolOverview> => {
  const supabase = await createClient();

  const { data: pool } = await supabase
    .from("pools")
    .select("id, name, sport, entry_fee_cents, jackpot_opening_cents")
    .eq("id", poolId)
    .maybeSingle();
  if (!pool) notFound();

  const [{ data: enrollments }, { data: rounds }] = await Promise.all([
    supabase.from("enrollments").select("player:players(id, display_name, nickname)").eq("pool_id", poolId),
    supabase
      .from("rounds")
      .select("id, name, ordinal, status, pot_cents, jackpot_cents, period:settlement_periods(settled_at)")
      .eq("pool_id", poolId)
      .eq("status", "completed")
      .order("ordinal"),
  ]);

  const { data: results } = await supabase
    .from("round_results")
    .select("round_id, player_id, points, position, prize_cents, bonus_cents")
    .in("round_id", (rounds ?? []).map((r) => r.id));

  const players = new Map(
    (enrollments ?? []).flatMap((e) => (e.player ? [[e.player.id, playerName(e.player)] as const] : [])),
  );

  const poolRounds: PoolRound[] = (rounds ?? []).map((round) => ({
    id: round.id,
    name: round.name,
    ordinal: round.ordinal,
    potCents: round.pot_cents ?? 0,
    jackpotCents: round.jackpot_cents ?? 0,
    settled: round.period?.settled_at != null,
    results: (results ?? [])
      .filter((r) => r.round_id === round.id)
      .map((r) => ({
        playerId: r.player_id,
        name: players.get(r.player_id) ?? "?",
        points: r.points,
        position: r.position,
        prizeCents: r.prize_cents,
        bonusCents: r.bonus_cents,
      }))
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
  }));

  const totals = new Map([...players.keys()].map((id) => [id, { points: 0, wonCents: 0 }]));
  for (const r of results ?? []) {
    const total = totals.get(r.player_id);
    if (!total) continue;
    total.points += r.points;
    total.wonCents += r.prize_cents + r.bonus_cents;
  }

  const bonusesPaid = (results ?? []).reduce((acc, r) => acc + r.bonus_cents, 0);
  const jackpotBalanceCents =
    pool.jackpot_opening_cents + poolRounds.reduce((acc, r) => acc + r.jackpotCents, 0) - bonusesPaid;

  const entries = [...totals].map(([profileId, t]) => ({ profileId, points: t.points }));
  const jackpotPrizes = new Map<string, { kind: PrizeKind; cents: Cents }>();
  for (const award of distributePrizes(jackpotBalanceCents, entries).awards) {
    for (const id of award.profileIds) {
      // When 7th and second-to-last coincide, the same person holds both prizes.
      const previous = jackpotPrizes.get(id);
      jackpotPrizes.set(id, {
        kind: previous?.kind ?? award.kind,
        cents: (previous?.cents ?? 0) + award.perPersonCents,
      });
    }
  }

  const paidCents = poolRounds.length * pool.entry_fee_cents;
  const season: SeasonRow[] = rankEntries(entries).flatMap((group) =>
    group.profileIds.map((id) => {
      const wonCents = totals.get(id)!.wonCents;
      return {
        playerId: id,
        name: players.get(id) ?? "?",
        points: group.points,
        position: group.from,
        wonCents,
        paidCents,
        netCents: wonCents - paidCents,
        jackpotPrize: jackpotPrizes.get(id) ?? null,
      };
    }),
  );
  season.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

  return { id: pool.id, name: pool.name, sport: pool.sport, jackpotBalanceCents, rounds: poolRounds, season };
});
