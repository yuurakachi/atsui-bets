import "server-only";
import { cache } from "react";
import { buildStatement, type Cents, type StatementLine } from "@/domain";
import { playerName } from "./format";
import { createClient } from "./supabase/server";

export interface PeriodRound {
  id: string;
  name: string;
  poolName: string;
  participants: number;
  potCents: Cents;
  prizesCents: Cents;
  jackpotCents: Cents;
}

export interface PeriodStatement {
  id: string;
  cutoffAt: Date;
  rounds: PeriodRound[];
  lines: (StatementLine & { name: string })[];
  collectedCents: Cents;
  paidOutCents: Cents;
  keptCents: Cents;
}

/** The oldest settlement period that hasn't been paid yet, with everyone's balance. */
export const getOpenPeriod = cache(async (): Promise<PeriodStatement | null> => {
  const supabase = await createClient();

  const { data: period } = await supabase
    .from("settlement_periods")
    .select("id, cutoff_at")
    .is("settled_at", null)
    .order("cutoff_at")
    .limit(1)
    .maybeSingle();
  if (!period) return null;

  const { data: rounds } = await supabase
    .from("rounds")
    .select("id, name, ordinal, pot_cents, jackpot_cents, pool:pools(name, entry_fee_cents)")
    .eq("settlement_period_id", period.id)
    .eq("status", "completed")
    .order("ordinal");

  const { data: results } = await supabase
    .from("round_results")
    .select("round_id, player_id, prize_cents, bonus_cents, player:players(display_name, nickname)")
    .in("round_id", (rounds ?? []).map((r) => r.id));

  const names = new Map<string, string>();
  for (const r of results ?? []) if (r.player) names.set(r.player_id, playerName(r.player));

  const settledRounds = (rounds ?? []).map((round) => {
    const rows = (results ?? []).filter((r) => r.round_id === round.id);
    return {
      round,
      entryFeeCents: round.pool?.entry_fee_cents ?? 0,
      participantIds: rows.map((r) => r.player_id),
      wonCents: new Map(rows.map((r) => [r.player_id, r.prize_cents + r.bonus_cents])),
    };
  });

  const lines = buildStatement(settledRounds).map((line) => ({
    ...line,
    name: names.get(line.profileId) ?? "?",
  }));
  const collectedCents = lines.reduce((acc, l) => acc + l.owesCents, 0);
  const paidOutCents = lines.reduce((acc, l) => acc + l.wonCents, 0);

  return {
    id: period.id,
    cutoffAt: new Date(period.cutoff_at),
    rounds: settledRounds.map(({ round, participantIds, wonCents }) => {
      const prizesCents = [...wonCents.values()].reduce((a, b) => a + b, 0);
      return {
        id: round.id,
        name: round.name,
        poolName: round.pool?.name ?? "",
        participants: participantIds.length,
        potCents: round.pot_cents ?? 0,
        prizesCents,
        jackpotCents: round.jackpot_cents ?? 0,
      };
    }),
    lines,
    collectedCents,
    paidOutCents,
    keptCents: collectedCents - paidOutCents,
  };
});
