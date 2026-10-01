import { TIME_ZONE } from "@/domain";

/** Most matches that fit side by side in the picks table on a phone. */
export const MAX_SLOT_EVENTS = 9;
/** Kickoffs this close to a window's first one belong to the same window (14:05 and 14:25). */
const WINDOW_MS = 90 * 60_000;

export interface Slot<T> {
  /** Stable between renders: the local day, plus the first kickoff when the day is split. */
  key: string;
  /** "jue", or "dom 11:00" when the day is split into kickoff windows. */
  label: string;
  events: T[];
}

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });
const weekday = new Intl.DateTimeFormat("es-MX", { timeZone: TIME_ZONE, weekday: "short" });
const time = new Intl.DateTimeFormat("es-MX", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit", hourCycle: "h23" });

/**
 * Splits a round's events into groups small enough for the picks table: one per day
 * (Mexico City), and a day with too many events into its kickoff windows.
 */
export function kickoffSlots<T extends { startsAt: string }>(events: readonly T[]): Slot<T>[] {
  const sorted = [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const days = new Map<string, T[]>();
  for (const event of sorted) {
    const key = dayKey.format(new Date(event.startsAt));
    days.set(key, [...(days.get(key) ?? []), event]);
  }

  return [...days].flatMap(([day, dayEvents]) => {
    const name = weekday.format(new Date(dayEvents[0].startsAt)).replace(".", "");
    if (dayEvents.length <= MAX_SLOT_EVENTS) return [{ key: day, label: name, events: dayEvents }];

    const windows: T[][] = [];
    for (const event of dayEvents) {
      const current = windows.at(-1);
      if (current && Date.parse(event.startsAt) - Date.parse(current[0].startsAt) <= WINDOW_MS) current.push(event);
      else windows.push([event]);
    }
    return windows.map((window) => {
      const start = time.format(new Date(window[0].startsAt)).replace(/^0/, "");
      return { key: `${day} ${start}`, label: `${name} ${start}`, events: window };
    });
  });
}
