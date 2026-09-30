import { describe, expect, it } from "vitest";
import { f1SeasonRounds } from "./f1";

// Mexico City is UTC-6. October 2026: Thu 8, Fri 9, Sat 10, Sun 11 … Fri 23, Sun 25.
describe("f1SeasonRounds", () => {
  const rounds = f1SeasonRounds([
    // Listed out of order on purpose.
    { round: 20, place: "Estados Unidos", raceStart: new Date("2026-10-25T19:00:00Z"), sprintStart: null },
    {
      round: 19,
      place: "Singapur",
      raceStart: new Date("2026-10-11T12:00:00Z"), // Sun 06:00 CDMX
      sprintStart: new Date("2026-10-10T09:00:00Z"), // Sat 03:00 CDMX
    },
  ]);

  it("makes a Sprint and a GP round on Sprint weekends, Sprint first", () => {
    expect(rounds.map((r) => [r.name, r.kind, r.ordinal])).toEqual([
      ["Sprint Singapur", "sprint", 37],
      ["GP Singapur", "gp", 38],
      ["GP Estados Unidos", "gp", 40],
    ]);
  });

  it("starts each round at its own race", () => {
    expect(rounds[0].startsAt.toISOString()).toBe("2026-10-10T09:00:00.000Z");
    expect(rounds[1].startsAt.toISOString()).toBe("2026-10-11T12:00:00.000Z");
  });

  it("locks both Sprint and GP on Thursday 15:00 of a Sprint weekend", () => {
    expect(rounds[0].lockAt.toISOString()).toBe("2026-10-08T21:00:00.000Z");
    expect(rounds[1].lockAt.toISOString()).toBe("2026-10-08T21:00:00.000Z");
  });

  it("locks a regular weekend on Friday 15:00", () => {
    expect(rounds[2].lockAt.toISOString()).toBe("2026-10-23T21:00:00.000Z");
  });
});
