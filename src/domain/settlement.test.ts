import { describe, expect, it } from "vitest";
import {
  assignSettlementPeriod,
  buildStatement,
  defaultCutoff,
  nextDefaultCutoff,
  roundFinishedAt,
} from "./settlement";

describe("defaultCutoff", () => {
  it("is 00:00 of the first Saturday of the month in Mexico City", () => {
    expect(defaultCutoff(2026, 10).toISOString()).toBe("2026-10-03T06:00:00.000Z"); // Sat Oct 3
    expect(defaultCutoff(2026, 11).toISOString()).toBe("2026-11-07T06:00:00.000Z"); // Sat Nov 7
    expect(defaultCutoff(2026, 8).toISOString()).toBe("2026-08-01T06:00:00.000Z"); // Aug 1 is a Saturday
  });
});

describe("nextDefaultCutoff", () => {
  it("is this month's meeting when the round finished before it", () => {
    // Friday Oct 2, 21:00 CDMX
    expect(nextDefaultCutoff(new Date("2026-10-03T03:00:00Z")).toISOString()).toBe("2026-10-03T06:00:00.000Z");
  });

  it("is next month's meeting when the round finished on or after this month's", () => {
    // Sunday Oct 11, 21:00 CDMX
    expect(nextDefaultCutoff(new Date("2026-10-12T03:00:00Z")).toISOString()).toBe("2026-11-07T06:00:00.000Z");
  });

  it("rolls over the year", () => {
    expect(nextDefaultCutoff(new Date("2026-12-20T18:00:00Z")).toISOString()).toBe("2027-01-02T06:00:00.000Z");
  });
});

describe("assignSettlementPeriod", () => {
  const periods = [
    { id: "nov", cutoffAt: defaultCutoff(2026, 11) },
    { id: "oct", cutoffAt: defaultCutoff(2026, 10) },
  ];

  it("settles a round that finished before Saturday at that month's meeting", () => {
    // Last match Friday Oct 2, 19:00 CDMX → finishes 21:00 Friday
    const finished = roundFinishedAt("liga_mx", [new Date("2026-10-03T01:00:00Z")]);
    expect(assignSettlementPeriod(finished, periods)?.id).toBe("oct");
  });

  it("moves a round that ends on the meeting weekend to the next month", () => {
    // Last match Sunday Oct 4, 19:00 CDMX
    const finished = roundFinishedAt("liga_mx", [
      new Date("2026-10-03T01:00:00Z"),
      new Date("2026-10-05T01:00:00Z"),
    ]);
    expect(assignSettlementPeriod(finished, periods)?.id).toBe("nov");
  });

  it("moves a Friday late game that finishes after midnight to the next month", () => {
    // Kickoff Friday Oct 2, 23:00 CDMX → finishes Saturday 01:00
    const finished = roundFinishedAt("liga_mx", [new Date("2026-10-03T05:00:00Z")]);
    expect(assignSettlementPeriod(finished, periods)?.id).toBe("nov");
  });

  it("returns null when no period covers the round yet", () => {
    expect(assignSettlementPeriod(new Date("2026-12-01T00:00:00Z"), periods)).toBeNull();
  });
});

describe("buildStatement", () => {
  it("nets fees against prizes across all sports", () => {
    const statement = buildStatement([
      { entryFeeCents: 100_00, participantIds: ["ana", "beto"], wonCents: new Map([["ana", 525_00]]) },
      { entryFeeCents: 100_00, participantIds: ["ana", "beto"], wonCents: new Map() },
      { entryFeeCents: 100_00, participantIds: ["beto"], wonCents: new Map([["beto", 157_50]]) },
    ]);

    expect(statement).toEqual([
      { profileId: "ana", rounds: 2, owesCents: 200_00, wonCents: 525_00, netCents: 325_00 },
      { profileId: "beto", rounds: 3, owesCents: 300_00, wonCents: 157_50, netCents: -142_50 },
    ]);
  });
});
