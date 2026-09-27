import { describe, expect, it } from "vitest";
import { f1RoundLock, isLocked, ligaMxRoundLock, nflGameLock } from "./deadlines";

// Mexico City is UTC-6 all year (no DST since 2022).
// October 2026: Thu 1, Fri 2, Sat 3, Sun 4 … Thu 22, Fri 23, Sun 25 … Fri 30, Sun Nov 1.

describe("ligaMxRoundLock", () => {
  it("locks at 23:59 the day before the first match", () => {
    // First match Friday Oct 2, 19:00 CDMX
    const lock = ligaMxRoundLock(new Date("2026-10-03T01:00:00Z"));
    expect(lock.toISOString()).toBe("2026-10-02T05:59:00.000Z"); // Thu Oct 1, 23:59 CDMX
  });
});

describe("nflGameLock", () => {
  it("locks 5 minutes before kickoff", () => {
    expect(nflGameLock(new Date("2026-10-04T17:00:00Z")).toISOString()).toBe("2026-10-04T16:55:00.000Z");
  });
});

describe("f1RoundLock", () => {
  it("locks Friday 15:00 on a regular weekend", () => {
    // Race Sunday Nov 1, 14:00 CDMX
    const lock = f1RoundLock(new Date("2026-11-01T20:00:00Z"), false);
    expect(lock.toISOString()).toBe("2026-10-30T21:00:00.000Z"); // Fri Oct 30, 15:00 CDMX
  });

  it("locks Thursday 15:00 on a sprint weekend", () => {
    // Race Sunday Oct 25, 13:00 CDMX
    const lock = f1RoundLock(new Date("2026-10-25T19:00:00Z"), true);
    expect(lock.toISOString()).toBe("2026-10-22T21:00:00.000Z"); // Thu Oct 22, 15:00 CDMX
  });

  it("handles an Asian race that falls on Saturday night in Mexico City", () => {
    // Race Sunday Oct 11, 14:00 JST = Saturday Oct 10, 23:00 CDMX
    const lock = f1RoundLock(new Date("2026-10-11T05:00:00Z"), false);
    expect(lock.toISOString()).toBe("2026-10-09T21:00:00.000Z"); // Fri Oct 9, 15:00 CDMX
  });
});

describe("isLocked", () => {
  it("is locked from the lock instant onwards", () => {
    const lock = new Date("2026-10-02T05:59:00Z");
    expect(isLocked(lock, new Date("2026-10-02T05:58:59Z"))).toBe(false);
    expect(isLocked(lock, lock)).toBe(true);
  });
});
