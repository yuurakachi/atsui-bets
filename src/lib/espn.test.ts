import { describe, expect, it } from "vitest";
import { espnDays, resultOf } from "./espn";

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

describe("resultOf", () => {
  const event = (home: { score: string; winner?: boolean }, away: { score: string; winner?: boolean }) => ({
    id: "1",
    date: "2026-12-14T02:00:00Z",
    competitions: [
      {
        status: { type: { name: "STATUS_FINAL_PEN", completed: true } },
        competitors: [
          { homeAway: "home" as const, team: { displayName: "Toluca" }, ...home },
          { homeAway: "away" as const, team: { displayName: "América" }, ...away },
        ],
      },
    ],
  });

  it("gives the match to whoever won it, on penalties too", () => {
    expect(resultOf(event({ score: "1", winner: false }, { score: "1", winner: true }))).toBe("away");
  });

  it("is a draw when nobody won", () => {
    expect(resultOf(event({ score: "1", winner: false }, { score: "1", winner: false }))).toBe("draw");
  });

  it("falls back to the score when ESPN doesn't say who won", () => {
    expect(resultOf(event({ score: "2" }, { score: "0" }))).toBe("home");
  });
});
