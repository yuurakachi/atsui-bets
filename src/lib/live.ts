import type { MatchResult } from "@/domain";
import type { EspnMatch } from "./espn";

/**
 * Outcome of a match right now: the official result, the final score, or who's ahead
 * while it's being played. `final` is false while the match is on.
 */
export function liveOutcome(
  official: MatchResult | null,
  live: Pick<EspnMatch, "state" | "result" | "score"> | undefined,
): { outcome: MatchResult; final: boolean } | null {
  if (official) return { outcome: official, final: true };
  if (!live || live.state === "pre") return null;
  if (live.result) return { outcome: live.result, final: live.state === "post" };
  if (!live.score) return null;
  const diff = live.score.home - live.score.away;
  return { outcome: diff > 0 ? "home" : diff < 0 ? "away" : "draw", final: false };
}
