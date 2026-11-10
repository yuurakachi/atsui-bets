import { describe, expect, it } from "vitest";
import { espnDays } from "./espn";

describe("espnDays", () => {
  it("asks for each match's Mexico City date and the day after", () => {
    // Fri 19:00 and Sat 21:00 in Mexico City; ESPN may file a late match under the next day.
    const days = espnDays([new Date("2026-11-21T01:00:00Z"), new Date("2026-11-22T03:00:00Z")]);
    expect(days).toEqual(["2026-11-20", "2026-11-21", "2026-11-22"]);
  });

  it("only asks for the days with matches when a rescheduled one is a week later", () => {
    const days = espnDays([new Date("2026-11-07T01:00:00Z"), new Date("2026-11-14T23:00:00Z")]);
    expect(days).toEqual(["2026-11-06", "2026-11-07", "2026-11-14", "2026-11-15"]);
  });
});
