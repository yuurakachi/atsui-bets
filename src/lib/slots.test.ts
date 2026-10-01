import { describe, expect, it } from "vitest";
import { kickoffSlots } from "./slots";

const games = (...starts: string[]) => starts.map((startsAt, i) => ({ id: `g${i}`, startsAt }));
const repeat = (startsAt: string, times: number) => Array.from({ length: times }, () => startsAt);

describe("kickoffSlots", () => {
  it("keeps a Liga MX matchday's days whole", () => {
    const slots = kickoffSlots(
      games("2026-10-10T01:00:00Z", "2026-10-10T03:00:00Z", "2026-10-10T23:00:00Z", "2026-10-11T01:05:00Z", "2026-10-12T00:00:00Z"),
    );
    expect(slots.map((s) => [s.label, s.events.length])).toEqual([["vie", 2], ["sáb", 2], ["dom", 1]]);
  });

  it("splits an NFL Sunday into its kickoff windows", () => {
    // Week 4 of 2026, in Mexico City: Thu 18:15, Sun 7:30, 11:00 ×8, 14:05, 14:25 ×3, 18:20, Mon 18:15.
    const slots = kickoffSlots(
      games(
        "2026-10-06T00:15:00Z",
        "2026-10-02T00:15:00Z",
        "2026-10-04T13:30:00Z",
        ...repeat("2026-10-04T17:00:00Z", 8),
        "2026-10-04T20:05:00Z",
        ...repeat("2026-10-04T20:25:00Z", 3),
        "2026-10-05T00:20:00Z",
      ),
    );
    expect(slots.map((s) => [s.label, s.events.length])).toEqual([
      ["jue", 1],
      ["dom 7:30", 1],
      ["dom 11:00", 8],
      ["dom 14:05", 4],
      ["dom 18:20", 1],
      ["lun", 1],
    ]);
    expect(new Set(slots.map((s) => s.key)).size).toBe(slots.length);
  });

  it("returns nothing for no events", () => {
    expect(kickoffSlots([])).toEqual([]);
  });
});
