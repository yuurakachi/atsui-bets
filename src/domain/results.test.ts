import { describe, expect, it } from "vitest";
import { resultsDue } from "./results";

// Liga MX matches last 2 hours, NFL games 3.5 hours (EVENT_DURATION_MINUTES).
const at = (iso: string) => new Date(iso);

describe("resultsDue", () => {
  const matchday = [
    { startsAt: at("2026-11-21T01:00:00Z"), result: null },
    { startsAt: at("2026-11-23T01:00:00Z"), result: null }, // last kickoff: Sun 19:00 CDMX
  ];

  it("waits until the last match should be over", () => {
    expect(resultsDue("liga_mx", matchday, at("2026-11-23T02:59:00Z"))).toBe(false);
    expect(resultsDue("liga_mx", matchday, at("2026-11-23T03:00:00Z"))).toBe(true);
  });

  it("uses each sport's duration", () => {
    const week = [{ startsAt: at("2026-11-24T01:15:00Z"), result: null }];
    expect(resultsDue("nfl", week, at("2026-11-24T04:00:00Z"))).toBe(false);
    expect(resultsDue("nfl", week, at("2026-11-24T04:45:00Z"))).toBe(true);
  });

  it("is done once every match has a result, including the ones that don't count", () => {
    const scored = [
      { startsAt: at("2026-11-21T01:00:00Z"), result: "home" as const },
      { startsAt: at("2026-11-23T01:00:00Z"), result: "void" as const },
    ];
    expect(resultsDue("liga_mx", scored, at("2026-11-30T00:00:00Z"))).toBe(false);
  });

  it("keeps asking while a postponed match has no result", () => {
    const waiting = [
      { startsAt: at("2026-11-21T01:00:00Z"), result: "home" as const },
      { startsAt: at("2026-11-23T01:00:00Z"), result: null },
    ];
    expect(resultsDue("liga_mx", waiting, at("2026-11-30T00:00:00Z"))).toBe(true);
  });

  it("ignores a round without matches", () => {
    expect(resultsDue("liga_mx", [], at("2026-11-30T00:00:00Z"))).toBe(false);
  });
});
