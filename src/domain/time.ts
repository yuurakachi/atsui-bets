/**
 * Minimal time-zone helpers. All rules are defined in Mexico City local time.
 */

export const TIME_ZONE = "America/Mexico_City";

export interface LocalDate {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
}

const MINUTE_MS = 60_000;

function partsIn(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)!.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function offsetMs(instant: Date, timeZone: string): number {
  const p = partsIn(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - (instant.getTime() - instant.getMilliseconds());
}

/** The instant at which the wall clock in `timeZone` reads the given date and time. */
export function zonedTime(date: LocalDate, hour: number, minute: number, timeZone = TIME_ZONE): Date {
  const wallClock = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  const guess = new Date(wallClock - offsetMs(new Date(wallClock), timeZone));
  // Re-check once in case the guess crossed an offset change.
  return new Date(wallClock - offsetMs(guess, timeZone));
}

export function localDateOf(instant: Date, timeZone = TIME_ZONE): LocalDate {
  const { year, month, day } = partsIn(instant, timeZone);
  return { year, month, day };
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export const MONDAY = 1;
export const THURSDAY = 4;
export const FRIDAY = 5;
export const SATURDAY = 6;

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(date: LocalDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

/** The most recent `weekday` on or before `date`. */
export function previousOrSame(date: LocalDate, weekday: number): LocalDate {
  return addDays(date, -((weekdayOf(date) - weekday + 7) % 7));
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MINUTE_MS);
}
