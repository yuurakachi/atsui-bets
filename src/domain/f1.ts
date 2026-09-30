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
