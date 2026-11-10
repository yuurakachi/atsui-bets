/**
 * Opening Liga MX matchdays (and NFL weeks) automatically. See docs/RULES.md §2.
 */
import { addDays, localDateOf, zonedTime } from "./time";

/** Matchdays in a Liga MX regular season; the playoffs aren't played. */
export const LIGA_MX_MATCHDAYS = 17;
/** Matches in a regular matchday: 18 teams, each plays once. */
export const LIGA_MX_MATCHES_PER_MATCHDAY = 9;

interface Fixture {
  home: string;
  away: string;
  startsAt: Date;
}

/**
 * The next matchday among upcoming matches: the first nine in kickoff order, where every
 * team plays once. null when a team repeats before nine or there aren't nine, so an admin
 * loads that matchday by hand.
 */
export function nextMatchday<T extends Fixture>(upcoming: readonly T[]): T[] | null {
  const sorted = [...upcoming].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.home.localeCompare(b.home),
  );
  const teams = new Set<string>();
  const matchday: T[] = [];
  for (const match of sorted) {
    if (matchday.length === LIGA_MX_MATCHES_PER_MATCHDAY) break;
    if (teams.has(match.home) || teams.has(match.away)) return null;
    teams.add(match.home).add(match.away);
    matchday.push(match);
  }
  return matchday.length === LIGA_MX_MATCHES_PER_MATCHDAY ? matchday : null;
}

/**
 * The next matchday (or NFL week) opens at 00:00 (Mexico City) of the day after the last
 * match of the current one.
 */
export function matchdayOpensAt(lastKickoff: Date): Date {
  return zonedTime(addDays(localDateOf(lastKickoff), 1), 0, 0);
}

/**
 * Postponed matches that join this matchday: those with a new date still ahead that's
 * played before the matchday ends, midweek included. Later ones wait for a later matchday.
 */
export function rescheduledInto<T extends { startsAt: Date }>(
  rescheduled: readonly T[],
  matchday: readonly { startsAt: Date }[],
  now: Date,
): T[] {
  const lastKickoff = Math.max(...matchday.map((m) => m.startsAt.getTime()));
  return rescheduled.filter((m) => m.startsAt.getTime() > now.getTime() && m.startsAt.getTime() <= lastKickoff);
}
