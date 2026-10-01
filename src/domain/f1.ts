/**
 * F1 season calendar: every race weekend becomes one round (GP), or two on Sprint
 * weekends (Sprint and GP). See docs/RULES.md §2–3.
 */
import { f1RoundLock } from "./deadlines";

export interface F1Race {
  /** Championship round number, 1-based. */
  round: number;
  /** Short place name shown in the app, e.g. "Singapur". */
  place: string;
  raceStart: Date;
  /** Start of the Sprint race, or null on a regular weekend. */
  sprintStart: Date | null;
}

export type F1RoundKind = "sprint" | "gp";

export interface F1RoundPlan {
  kind: F1RoundKind;
  /** Sprint = 2 × round − 1, GP = 2 × round: rounds sort by date, a weekend's Sprint first. */
  ordinal: number;
  raceRound: number;
  name: string;
  startsAt: Date;
  lockAt: Date;
}

export function f1RoundOrdinal(raceRound: number, kind: F1RoundKind): number {
  return kind === "sprint" ? raceRound * 2 - 1 : raceRound * 2;
}

export interface F1RoundMatch<T> {
  plan: F1RoundPlan;
  /** The round already in the app for this race, if any. */
  round: T | null;
  /** No round yet, and the plan's ordinal is held by another race: it can't be created. */
  blocked: boolean;
}

/**
 * Pairs the calendar with the rounds already in the app. A round is its race, whatever
 * number the calendar gives it today: when a cancelled race is dropped and the following
 * ones are renumbered, each round still finds its own race by name. Only a round whose
 * name is no longer in the calendar is matched by ordinal (the race was renamed).
 * `orphans` are the rounds left without a race.
 */
export function matchF1Rounds<T extends { kind: string; ordinal: number; name: string }>(
  plans: readonly F1RoundPlan[],
  rounds: readonly T[],
): { matches: F1RoundMatch<T>[]; orphans: T[] } {
  const nameKey = (r: { kind: string; name: string }) => `${r.kind}:${r.name}`;
  const slotKey = (r: { kind: string; ordinal: number }) => `${r.kind}:${r.ordinal}`;
  const planNames = new Set(plans.map(nameKey));
  const byName = new Map(rounds.map((r) => [nameKey(r), r]));
  const bySlot = new Map(rounds.map((r) => [slotKey(r), r]));

  const matched = new Set<T>();
  const matches = plans.map((plan) => {
    const inSlot = bySlot.get(slotKey(plan));
    const renamed = inSlot && !planNames.has(nameKey(inSlot)) ? inSlot : null;
    const round = byName.get(nameKey(plan)) ?? renamed;
    if (round) matched.add(round);
    return { plan, round: round ?? null, blocked: !round && inSlot !== undefined };
  });
  return { matches, orphans: rounds.filter((r) => !matched.has(r)) };
}

/** The rounds of a season, in order. Sprint and GP of a weekend share the lock. */
export function f1SeasonRounds(races: readonly F1Race[]): F1RoundPlan[] {
  return [...races]
    .sort((a, b) => a.round - b.round)
    .flatMap((race) => {
      const sprintWeekend = race.sprintStart !== null;
      const lockAt = f1RoundLock(race.raceStart, sprintWeekend);
      const gp: F1RoundPlan = {
        kind: "gp",
        ordinal: f1RoundOrdinal(race.round, "gp"),
        raceRound: race.round,
        name: `GP ${race.place}`,
        startsAt: race.raceStart,
        lockAt,
      };
      if (!race.sprintStart) return [gp];
      return [
        {
          kind: "sprint" as const,
          ordinal: f1RoundOrdinal(race.round, "sprint"),
          raceRound: race.round,
          name: `Sprint ${race.place}`,
          startsAt: race.sprintStart,
          lockAt,
        },
        gp,
      ];
    });
}
