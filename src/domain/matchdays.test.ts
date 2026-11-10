import { describe, expect, it } from "vitest";
import { matchdayOpensAt, nextMatchday, rescheduledInto } from "./matchdays";

// J17 of the 2026 Apertura (Nov 20–22), in kickoff order.
const j17 = [
  ["Puebla", "San Luis", "2026-11-21T01:00:00Z"],
  ["Juárez", "Atlas", "2026-11-21T03:00:00Z"],
  ["Tijuana", "Atlante", "2026-11-21T03:00:00Z"],
  ["Pachuca", "Toluca", "2026-11-21T22:50:00Z"],
  ["Santos", "León", "2026-11-21T23:00:00Z"],
  ["Pumas", "Monterrey", "2026-11-22T01:00:00Z"],
  ["Tigres", "América", "2026-11-22T03:00:00Z"],
  ["Chivas", "Cruz Azul", "2026-11-22T23:07:00Z"],
  ["Querétaro", "Necaxa", "2026-11-23T01:00:00Z"],
].map(([home, away, start]) => ({ home, away, startsAt: new Date(start) }));

describe("nextMatchday", () => {
  it("takes the next nine matches, where every team plays once", () => {
    expect(nextMatchday(j17)).toEqual(j17);
  });

  it("stops before the following matchday starts", () => {
    const following = { home: "San Luis", away: "Tigres", startsAt: new Date("2026-11-28T01:00:00Z") };
    expect(nextMatchday([...j17, following])).toEqual(j17);
  });

  it("works whatever order the matches come in", () => {
    expect(nextMatchday([...j17].reverse())).toEqual(j17);
  });

  it("gives up when a team plays twice before nine matches", () => {
    const early = { home: "Puebla", away: "Tigres", startsAt: new Date("2026-11-20T01:00:00Z") };
    expect(nextMatchday([early, ...j17])).toBeNull();
  });

  it("gives up when there aren't nine matches", () => {
    expect(nextMatchday(j17.slice(1))).toBeNull();
  });
});

describe("matchdayOpensAt", () => {
  it("opens the next matchday at midnight after the last match's day, in Mexico City", () => {
    // Sat Nov 14, 17:00 CDMX -> Sun Nov 15, 00:00 CDMX
    expect(matchdayOpensAt(new Date("2026-11-14T23:00:00Z")).toISOString()).toBe("2026-11-15T06:00:00.000Z");
  });

  it("uses the Mexico City date for a late kickoff", () => {
    // Sun Nov 8, 20:00 CDMX is already Monday in UTC
    expect(matchdayOpensAt(new Date("2026-11-09T02:00:00Z")).toISOString()).toBe("2026-11-09T06:00:00.000Z");
  });
});

describe("rescheduledInto", () => {
  const now = new Date("2026-11-15T07:00:00Z");

  it("adds a rescheduled match played before the matchday ends, midweek included", () => {
    const wednesday = { startsAt: new Date("2026-11-19T02:00:00Z") };
    expect(rescheduledInto([wednesday], j17, now)).toEqual([wednesday]);
  });

  it("leaves for later a match rescheduled after this matchday", () => {
    const later = { startsAt: new Date("2026-12-02T02:00:00Z") };
    expect(rescheduledInto([later], j17, now)).toEqual([]);
  });

  it("leaves out a new date that already passed", () => {
    const past = { startsAt: new Date("2026-11-14T23:00:00Z") };
    expect(rescheduledInto([past], j17, now)).toEqual([]);
  });
});
