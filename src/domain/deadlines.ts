/**
 * Pick deadlines. See docs/RULES.md §3.
 */
import { addDays, addMinutes, FRIDAY, localDateOf, previousOrSame, zonedTime } from "./time";

/** Liga MX and NFL: each match locks 5 minutes before kickoff. */
export function matchLock(kickoff: Date): Date {
  return addMinutes(kickoff, -5);
}

/** The sessions of an F1 weekend that decide when its picks lock. */
export interface F1WeekendSessions {
  raceStart: Date;
  /** Null on a regular weekend. */
  sprintStart: Date | null;
  /** Regular weekends only; null if the calendar doesn't have its time yet. */
  thirdPracticeStart: Date | null;
  /** Sprint weekends only; null if the calendar doesn't have its time yet. */
  sprintQualifyingStart: Date | null;
}

/**
 * F1: 5 minutes before the third practice, or before Sprint Qualifying on Sprint
 * weekends (both Sprint and GP picks). While the calendar doesn't have that session's
 * time, Friday 15:00 of the race weekend (Thursday on Sprint weekends): the last Friday
 * on or before the race date, which also covers Saturday races and Asian races that
 * fall on Saturday night in Mexico City.
 */
export function f1RoundLock(weekend: F1WeekendSessions): Date {
  const sprintWeekend = weekend.sprintStart !== null;
  const session = sprintWeekend ? weekend.sprintQualifyingStart : weekend.thirdPracticeStart;
  if (session) return addMinutes(session, -5);
  const friday = previousOrSame(localDateOf(weekend.raceStart), FRIDAY);
  return zonedTime(sprintWeekend ? addDays(friday, -1) : friday, 15, 0);
}

export function isLocked(lockAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= lockAt.getTime();
}
