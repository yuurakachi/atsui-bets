import { describe, expect, it } from "vitest";
import { f1PicksShownFrom, f1SeasonRounds, matchF1Rounds } from "./f1";

// Mexico City is UTC-6. October 2026: Thu 8, Fri 9, Sat 10, Sun 11 … Fri 23, Sun 25.
describe("f1SeasonRounds", () => {
  const rounds = f1SeasonRounds([
    // Listed out of order on purpose.
    {
      round: 20,
      place: "Estados Unidos",
      raceStart: new Date("2026-10-25T19:00:00Z"),
      sprintStart: null,
      thirdPracticeStart: new Date("2026-10-24T17:30:00Z"), // Sat 11:30 CDMX
      sprintQualifyingStart: null,
    },
    {
      round: 19,
      place: "Singapur",
      raceStart: new Date("2026-10-11T12:00:00Z"), // Sun 06:00 CDMX
      sprintStart: new Date("2026-10-10T09:00:00Z"), // Sat 03:00 CDMX
      thirdPracticeStart: null,
      sprintQualifyingStart: new Date("2026-10-09T12:30:00Z"), // Fri 06:30 CDMX
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

  it("locks both Sprint and GP 5 minutes before Sprint Qualifying on a Sprint weekend", () => {
    expect(rounds[0].lockAt.toISOString()).toBe("2026-10-09T12:25:00.000Z");
    expect(rounds[1].lockAt.toISOString()).toBe("2026-10-09T12:25:00.000Z");
  });

  it("locks a regular weekend 5 minutes before the third practice", () => {
    expect(rounds[2].lockAt.toISOString()).toBe("2026-10-24T17:25:00.000Z");
  });
});

describe("f1PicksShownFrom", () => {
  it("asks for picks from Monday 00:00 of the race week", () => {
    // Sprint weekend locking Friday Oct 9 and regular weekend locking Saturday Oct 24.
    expect(f1PicksShownFrom(new Date("2026-10-09T12:25:00Z")).toISOString()).toBe("2026-10-05T06:00:00.000Z");
    expect(f1PicksShownFrom(new Date("2026-10-24T17:25:00Z")).toISOString()).toBe("2026-10-19T06:00:00.000Z");
  });

  it("stays in the race week when the third practice is on Friday evening in Mexico City", () => {
    // Las Vegas: third practice Sat Nov 21, 00:30 UTC = Fri Nov 20, 18:30 CDMX.
    expect(f1PicksShownFrom(new Date("2026-11-21T00:25:00Z")).toISOString()).toBe("2026-11-16T06:00:00.000Z");
  });
});

describe("matchF1Rounds", () => {
  const race = (round: number, place: string, day: string) => ({
    round,
    place,
    raceStart: new Date(`${day}T12:00:00Z`),
    sprintStart: null,
    thirdPracticeStart: null,
    sprintQualifyingStart: null,
  });
  const singapore = race(17, "Singapur", "2026-10-11");
  const usa = race(18, "Estados Unidos", "2026-10-25");
  const mexico = race(19, "México", "2026-11-01");
  const inApp = [
    { kind: "gp", ordinal: 34, name: "GP Singapur" },
    { kind: "gp", ordinal: 36, name: "GP Estados Unidos" },
    { kind: "gp", ordinal: 38, name: "GP México" },
  ];
  const pairs = (plans: ReturnType<typeof f1SeasonRounds>, rounds = inApp) =>
    matchF1Rounds(plans, rounds).matches.map((m) => [m.plan.name, m.round?.ordinal ?? null, m.blocked]);

  it("pairs each race with its round", () => {
    const { matches, orphans } = matchF1Rounds(f1SeasonRounds([singapore, usa, mexico]), inApp);
    expect(matches.map((m) => m.round)).toEqual(inApp);
    expect(orphans).toEqual([]);
  });

  it("keeps each round with its own race when a cancelled one is dropped and the rest renumbered", () => {
    const plans = f1SeasonRounds([{ ...usa, round: 17 }, { ...mexico, round: 18 }]);
    expect(pairs(plans)).toEqual([
      ["GP Estados Unidos", 36, false],
      ["GP México", 38, false],
    ]);
    expect(matchF1Rounds(plans, inApp).orphans).toEqual([inApp[0]]);
  });

  it("follows a race that was renamed in place", () => {
    const plans = f1SeasonRounds([{ ...singapore, place: "Singapur (Marina Bay)" }, usa, mexico]);
    expect(pairs(plans)[0]).toEqual(["GP Singapur (Marina Bay)", 34, false]);
    expect(matchF1Rounds(plans, inApp).orphans).toEqual([]);
  });

  it("leaves a new race to be created, unless another race holds its ordinal", () => {
    const brazil = race(20, "Brasil", "2026-11-08");
    expect(pairs(f1SeasonRounds([singapore, usa, mexico, brazil]))[3]).toEqual(["GP Brasil", null, false]);
    // Singapore dropped and a new race added: Brazil lands on Mexico's ordinal.
    const renumbered = f1SeasonRounds([{ ...usa, round: 17 }, { ...mexico, round: 18 }, { ...brazil, round: 19 }]);
    expect(pairs(renumbered)[2]).toEqual(["GP Brasil", null, true]);
  });
});
