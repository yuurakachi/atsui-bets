/**
 * Pick deadlines. See docs/RULES.md §3.
 */
import { addDays, addMinutes, FRIDAY, localDateOf, previousOrSame, zonedTime } from "./time";

/** Liga MX: the whole matchday locks at 23:59 the day before its first match. */
export function ligaMxRoundLock(firstKickoff: Date): Date {
  return zonedTime(addDays(localDateOf(firstKickoff), -1), 23, 59);
}

/** NFL: each game locks 5 minutes before kickoff. */
export function nflGameLock(kickoff: Date): Date {
  return addMinutes(kickoff, -5);
}

/**
 * F1: Friday 15:00 of the race weekend, or Thursday 15:00 on Sprint weekends
 * (both Sprint and GP picks). The weekend's Friday is the last Friday on or before
 * the race date, which also covers Saturday races and Asian races that fall on
 * Saturday night in Mexico City.
 */
export function f1RoundLock(raceStart: Date, sprintWeekend: boolean): Date {
  const friday = previousOrSame(localDateOf(raceStart), FRIDAY);
  return zonedTime(sprintWeekend ? addDays(friday, -1) : friday, 15, 0);
}

export function isLocked(lockAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= lockAt.getTime();
}
