/**
 * When to fetch a round's results automatically.
 */
import type { MatchResult } from "./scoring";
import { roundFinishedAt } from "./settlement";
import type { Sport } from "./types";

/**
 * Whether a round should get its results now: its last match should be over and some
 * match still has no result. A postponed match nobody marked keeps it due, so it is
 * asked again until ESPN has a result or an admin marks it as not counting.
 */
export function resultsDue(
  sport: Sport,
  events: readonly { startsAt: Date; result: MatchResult | null }[],
  now: Date,
): boolean {
  if (!events.some((e) => e.result === null)) return false;
  return now >= roundFinishedAt(sport, events.map((e) => e.startsAt));
}
