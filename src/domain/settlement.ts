/**
 * Monthly settlement. See docs/RULES.md §6.
 */
import { addMinutes, previousOrSame, SATURDAY, zonedTime, addDays } from "./time";
import type { Cents, ProfileId, Sport } from "./types";

/** Estimated length of an event, used to know when a round has finished. */
export const EVENT_DURATION_MINUTES: Record<Sport, number> = {
  liga_mx: 120,
  nfl: 210,
  f1: 120,
};

export function roundFinishedAt(sport: Sport, eventStarts: readonly Date[]): Date {
  if (eventStarts.length === 0) throw new Error("A round needs at least one event.");
  const lastStart = Math.max(...eventStarts.map((d) => d.getTime()));
  return addMinutes(new Date(lastStart), EVENT_DURATION_MINUTES[sport]);
}

/** Default cutoff for a month's meeting: 00:00 of the month's first Saturday. */
export function defaultCutoff(year: number, month: number): Date {
  const firstSaturday = previousOrSame(addDays({ year, month, day: 1 }, 6), SATURDAY);
  return zonedTime(firstSaturday, 0, 0);
}

export interface SettlementPeriod {
  id: string;
  cutoffAt: Date;
}

/**
 * A round is settled at the first meeting whose cutoff comes after the round has
 * completely finished. Returns null if no period covers it yet.
 */
export function assignSettlementPeriod(
  finishedAt: Date,
  periods: readonly SettlementPeriod[],
): SettlementPeriod | null {
  const sorted = [...periods].sort((a, b) => a.cutoffAt.getTime() - b.cutoffAt.getTime());
  return sorted.find((p) => finishedAt.getTime() < p.cutoffAt.getTime()) ?? null;
}

export interface SettledRound {
  entryFeeCents: Cents;
  participantIds: readonly ProfileId[];
  wonCents: ReadonlyMap<ProfileId, Cents>;
}

export interface StatementLine {
  profileId: ProfileId;
  rounds: number;
  owesCents: Cents;
  wonCents: Cents;
  /** Positive: collects at the meeting. Negative: pays. */
  netCents: Cents;
}

/** What each person owes and won across every round (all sports) in a period. */
export function buildStatement(rounds: readonly SettledRound[]): StatementLine[] {
  const lines = new Map<ProfileId, StatementLine>();
  const lineFor = (profileId: ProfileId) => {
    let line = lines.get(profileId);
    if (!line) {
      line = { profileId, rounds: 0, owesCents: 0, wonCents: 0, netCents: 0 };
      lines.set(profileId, line);
    }
    return line;
  };

  for (const round of rounds) {
    for (const id of round.participantIds) {
      const line = lineFor(id);
      line.rounds++;
      line.owesCents += round.entryFeeCents;
      line.wonCents += round.wonCents.get(id) ?? 0;
    }
  }

  return [...lines.values()]
    .map((line) => ({ ...line, netCents: line.wonCents - line.owesCents }))
    .sort((a, b) => b.netCents - a.netCents || a.profileId.localeCompare(b.profileId));
}
