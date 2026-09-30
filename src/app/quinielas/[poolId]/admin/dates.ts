import { addDays, FRIDAY, localDateOf, previousOrSame, type LocalDate } from "@/domain/time";

const iso = (d: LocalDate) =>
  `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

/**
 * Default search window for the next round, in Mexico City dates ("YYYY-MM-DD"):
 * the current Friday–Monday if we're in one, otherwise the coming one.
 */
export function upcomingWeekend(now: Date): { from: string; to: string } {
  const today = localDateOf(now);
  const lastFriday = previousOrSame(today, FRIDAY);
  const inWeekend = iso(addDays(lastFriday, 3)) >= iso(today);
  const friday = inWeekend ? lastFriday : addDays(lastFriday, 7);
  return { from: iso(friday), to: iso(addDays(friday, 3)) };
}
