/**
 * Points per round. See docs/RULES.md §2.
 */

export type MatchOutcome = "home" | "draw" | "away";

/**
 * `void` = postponed or cancelled: nobody scores it.
 * An NFL tie is recorded as `draw`; NFL picks can't be `draw`, so nobody scores it either.
 */
export type MatchResult = MatchOutcome | "void";

export interface ScoredMatch {
  id: string;
  /** null while the match hasn't finished. */
  result: MatchResult | null;
}

/** Liga MX and NFL: 1 point per correct pick. Missing picks score 0. */
export function scoreMatchPicks(
  matches: readonly ScoredMatch[],
  picks: Readonly<Record<string, MatchOutcome | undefined>>,
): number {
  let points = 0;
  for (const match of matches) {
    if (match.result === null || match.result === "void") continue;
    if (picks[match.id] === match.result) points++;
  }
  return points;
}

export function isValidNflPick(pick: MatchOutcome): boolean {
  return pick !== "draw";
}

export const F1_PICK_POSITIONS = 10;

/** Driver ids by position: index 0 is P1. `null` = position left empty. */
export type F1Pick = readonly (string | null)[];

/** Rows of (1-based position, driver id) as an ordered list of `length`, null where empty. */
export function orderByPosition(
  rows: readonly { position: number; driverId: string }[],
  length: number = F1_PICK_POSITIONS,
): (string | null)[] {
  const list: (string | null)[] = Array.from({ length }, () => null);
  for (const row of rows) if (row.position >= 1 && row.position <= length) list[row.position - 1] = row.driverId;
  return list;
}

/** Returns a list of problems; empty means the pick is valid. */
export function validateF1Pick(pick: F1Pick): string[] {
  const errors: string[] = [];
  if (pick.length !== F1_PICK_POSITIONS) {
    errors.push(`A pick must have exactly ${F1_PICK_POSITIONS} positions.`);
  }
  const seen = new Set<string>();
  pick.forEach((driver, i) => {
    if (driver === null) return;
    if (seen.has(driver)) errors.push(`Driver ${driver} is picked more than once (P${i + 1}).`);
    seen.add(driver);
  });
  return errors;
}

/**
 * F1 (GP and Sprint): 1 point per driver in the exact position, P1–P10.
 * `classification` is the official order of driver ids, index 0 is P1.
 */
export function scoreF1Pick(pick: F1Pick, classification: readonly string[]): number {
  let points = 0;
  for (let i = 0; i < F1_PICK_POSITIONS; i++) {
    const driver = pick[i];
    if (driver != null && driver === classification[i]) points++;
  }
  return points;
}
