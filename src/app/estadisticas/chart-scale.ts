/** Charts are drawn 320 units wide and scale with the card, so they fit a 375px phone. */
export const W = 320;

/**
 * The x-axis labels that fit a slot: all of them, each round's number, or every fifth
 * number. `fixed` labels (the season's close) are always shown as they are and don't
 * count towards the width.
 */
export function axisLabels(labels: readonly string[], slot: number, fixed: (i: number) => boolean = () => false): string[] {
  const widest = Math.max(...labels.filter((_, i) => !fixed(i)).map((l) => l.length));
  if (slot >= widest * 6.5 + 3) return [...labels];
  const every = slot >= 15 ? 1 : 5;
  return labels.map((label, i) => (fixed(i) ? label : i === 0 || (i + 1) % every === 0 ? String(i + 1) : ""));
}

/**
 * The point nearest to `x` (in chart units) on a line of `count` points, where point i
 * sits at `left + (i + 1) * step`. Touches past either end pick the first or last point.
 */
export function pointAt(x: number, left: number, step: number, count: number): number {
  const i = Math.round((x - left) / step) - 1;
  return Math.min(count - 1, Math.max(0, i));
}
