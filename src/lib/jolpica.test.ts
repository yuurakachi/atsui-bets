import { describe, expect, it } from "vitest";
import { f1ExternalId, parseClassification, parseDrivers, parseF1ExternalId, parseSchedule } from "./jolpica";

const driver = (code: string, familyName: string) => ({ driverId: familyName.toLowerCase(), code, givenName: "X", familyName });

describe("parseSchedule", () => {
  it("reads race and Sprint start times and names places in Spanish", () => {
    const races = parseSchedule({
      MRData: {
        RaceTable: {
          Races: [
            {
              season: "2026",
              round: "19",
              raceName: "Singapore Grand Prix",
              date: "2026-10-11",
              time: "12:00:00Z",
              Sprint: { date: "2026-10-10", time: "09:00:00Z" },
            },
            { season: "2026", round: "20", raceName: "Mystery Grand Prix", date: "2026-10-25" },
          ],
        },
      },
    });
    expect(races).toEqual([
      {
        round: 19,
        place: "Singapur",
        raceStart: new Date("2026-10-11T12:00:00Z"),
        sprintStart: new Date("2026-10-10T09:00:00Z"),
      },
      { round: 20, place: "Mystery", raceStart: new Date("2026-10-25T12:00:00Z"), sprintStart: null },
    ]);
  });

  it("names relocated and renamed races the way the family does", () => {
    const race = (round: string, raceName: string) => ({ season: "2026", round, raceName, date: "2026-10-04" });
    const races = parseSchedule({
      MRData: { RaceTable: { Races: [race("16", "Bahrain Grand Prix in Malaysia"), race("20", "Brazilian Grand Prix")] } },
    });
    expect(races.map((r) => r.place)).toEqual(["Baréin (Malasia)", "Brasil"]);
  });
});

describe("parseDrivers", () => {
  const drivers = { MRData: { DriverTable: { Drivers: [driver("VER", "Verstappen"), driver("LAW", "Lawson"), driver("ALB", "Albon")] } } };

  it("marks as active only the drivers of the latest race, with their team", () => {
    const last = {
      MRData: {
        RaceTable: {
          Races: [
            {
              season: "2026", round: "18", raceName: "", date: "",
              Results: [
                { position: "1", Driver: driver("VER", "Verstappen"), Constructor: { name: "Red Bull" } },
                { position: "2", Driver: driver("ALB", "Albon"), Constructor: { name: "Williams" } },
              ],
            },
          ],
        },
      },
    };
    expect(parseDrivers(drivers, last)).toEqual([
      { code: "VER", name: "X Verstappen", team: "Red Bull", active: true },
      { code: "LAW", name: "X Lawson", team: null, active: false },
      { code: "ALB", name: "X Albon", team: "Williams", active: true },
    ]);
  });

  it("marks everyone active before the first race", () => {
    expect(parseDrivers(drivers, { MRData: { RaceTable: { Races: [] } } }).every((d) => d.active)).toBe(true);
  });
});

describe("parseClassification", () => {
  const json = {
    MRData: {
      RaceTable: {
        Races: [
          {
            season: "2026", round: "19", raceName: "", date: "",
            SprintResults: [
              { position: "2", Driver: driver("NOR", "Norris") },
              { position: "1", Driver: driver("PIA", "Piastri") },
            ],
          },
        ],
      },
    },
  };

  it("orders the Sprint classification by position", () => {
    expect(parseClassification(json, "sprint")?.map((d) => d.code)).toEqual(["PIA", "NOR"]);
  });

  it("returns null while there are no results", () => {
    expect(parseClassification(json, "gp")).toBeNull();
    expect(parseClassification({ MRData: { RaceTable: { Races: [] } } }, "gp")).toBeNull();
  });
});

describe("external ids", () => {
  it("round-trips", () => {
    expect(parseF1ExternalId(f1ExternalId("2026", 19, "sprint"))).toEqual({ season: "2026", raceRound: 19, kind: "sprint" });
    expect(parseF1ExternalId("espn:123")).toBeNull();
  });
});
