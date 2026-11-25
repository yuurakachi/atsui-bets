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
  /** The settlement period that pays the round; null if it has none yet. */
  periodId: string | null;
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
  /** Entry fees for every completed round (everyone enrolled pays every round), plus a playoff pool's buy-in. */
  paidCents: Cents;
  netCents: Cents;
  /** Jackpot prize this player would take if the season ended today. */
  jackpotPrize: { kind: PrizeKind; cents: Cents } | null;
}

export interface PoolPeriod {
  id: string;
  cutoffAt: Date;
  settled: boolean;
}

export interface JackpotAward {
  kind: PrizeKind;
  /** Each winner's share. */
  cents: Cents;
  names: string[];
}

export interface PoolOverview {
  id: string;
  name: string;
  sport: Sport;
  /** The season is over: the jackpot awards are final. */
  finished: boolean;
  /** A playoff pool (liguilla): one buy-in per player instead of a fee per round. */
  playoffs: boolean;
  buyInCents: Cents;
  entryFeeCents: Cents;
  jackpotBalanceCents: Cents;
  /** How the jackpot splits with today's standings (final once the season is over). */
  jackpotAwards: JackpotAward[];
  /** Completed rounds, in order. */
  rounds: PoolRound[];
  season: SeasonRow[];
  periods: PoolPeriod[];
}

/**
 * Everything the standings, money and statistics screens need for one pool, read with the
 * player's session in a single request: the pool with its enrollments, settlement periods
 * and completed rounds, each round with its results.
 */
export const getPoolOverview = cache(async (poolId: string): Promise<PoolOverview> => {
  const supabase = await createClient();
  const { data: pool } = await supabase
    .from("pools")
    .select(
      `id, name, sport, status, playoffs, buy_in_cents, entry_fee_cents, jackpot_opening_cents,
       enrollments(player:players(id, display_name, nickname)),
       settlement_periods(id, cutoff_at, settled_at),
       rounds(id, name, ordinal, status, pot_cents, jackpot_cents, settlement_period_id,
         round_results(player_id, points, position, prize_cents, bonus_cents))`,
    )
    .eq("id", poolId)
    .eq("rounds.status", "completed")
    .order("ordinal", { referencedTable: "rounds" })
    .maybeSingle();
  if (!pool) notFound();

  const players = new Map(
    pool.enrollments.flatMap((e) => (e.player ? [[e.player.id, playerName(e.player)] as const] : [])),
  );
  const settledAt = new Map(pool.settlement_periods.map((p) => [p.id, p.settled_at]));

  const rounds: PoolRound[] = pool.rounds.map((round) => ({
    id: round.id,
    name: round.name,
    ordinal: round.ordinal,
    potCents: round.pot_cents ?? 0,
    jackpotCents: round.jackpot_cents ?? 0,
    settled: round.settlement_period_id != null && settledAt.get(round.settlement_period_id) != null,
    periodId: round.settlement_period_id,
    results: round.round_results
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
  const results = rounds.flatMap((r) => r.results);

  const totals = new Map([...players.keys()].map((id) => [id, { points: 0, wonCents: 0 }]));
  for (const r of results) {
    const total = totals.get(r.playerId);
    if (!total) continue;
    total.points += r.points;
    total.wonCents += r.prizeCents + r.bonusCents;
  }

  const bonusesPaid = results.reduce((acc, r) => acc + r.bonusCents, 0);
  // A playoff pool's buy-ins all go to the jackpot.
  const jackpotBalanceCents =
    pool.jackpot_opening_cents +
    pool.buy_in_cents * players.size +
    rounds.reduce((acc, r) => acc + r.jackpotCents, 0) -
    bonusesPaid;

  const entries = [...totals].map(([profileId, t]) => ({ profileId, points: t.points }));
  const jackpotPrizes = new Map<string, { kind: PrizeKind; cents: Cents }>();
  const { awards } = distributePrizes(jackpotBalanceCents, entries);
  for (const award of awards) {
    for (const id of award.profileIds) {
      // When 7th and second-to-last coincide, the same person holds both prizes.
      const previous = jackpotPrizes.get(id);
      jackpotPrizes.set(id, {
        kind: previous?.kind ?? award.kind,
        cents: (previous?.cents ?? 0) + award.perPersonCents,
      });
    }
  }

  const paidCents = rounds.length * pool.entry_fee_cents + pool.buy_in_cents;
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

  return {
    id: pool.id,
    name: pool.name,
    sport: pool.sport,
    finished: pool.status === "finished",
    playoffs: pool.playoffs,
    buyInCents: pool.buy_in_cents,
    jackpotBalanceCents,
    jackpotAwards: awards.map((a) => ({
      kind: a.kind,
      cents: a.perPersonCents,
      names: a.profileIds.map((id) => players.get(id) ?? "?").sort((x, y) => x.localeCompare(y)),
    })),
    entryFeeCents: pool.entry_fee_cents,
    rounds,
    season,
    periods: pool.settlement_periods.map((p) => ({
      id: p.id,
      cutoffAt: new Date(p.cutoff_at),
      settled: p.settled_at !== null,
    })),
  };
});

export interface OpenSignup {
  id: string;
  name: string;
  sport: Sport;
  buyInCents: Cents;
  players: number;
  /** Sign-up closes when the first match locks; null while the pool has no matches yet. */
  closesAt: Date | null;
}

/**
 * Pools the player can still join themselves (a liguilla, for instance): they take
 * sign-ups, the player isn't in them yet and their first match hasn't locked.
 */
export async function getOpenSignups(playerId: string): Promise<OpenSignup[]> {
  const supabase = await createClient();
  const { data: pools } = await supabase
    .from("pools")
    .select("id, name, sport, buy_in_cents, enrollments(player_id), rounds(events(lock_at))")
    .eq("self_signup", true)
    .eq("status", "active");

  const now = new Date();
  return (pools ?? []).flatMap((pool) => {
    if (pool.enrollments.some((e) => e.player_id === playerId)) return [];
    const locks = pool.rounds.flatMap((r) => r.events.map((e) => new Date(e.lock_at).getTime()));
    const closesAt = locks.length ? new Date(Math.min(...locks)) : null;
    if (closesAt && closesAt <= now) return [];
    return [
      {
        id: pool.id,
        name: pool.name,
        sport: pool.sport,
        buyInCents: pool.buy_in_cents,
        players: pool.enrollments.length,
        closesAt,
      },
    ];
  });
}
