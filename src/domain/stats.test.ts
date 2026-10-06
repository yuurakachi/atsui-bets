import { describe, expect, it } from "vitest";
import {
  f1PickStats,
  matchPickStats,
  netByMeeting,
  roundHistory,
  standingSummary,
  summarizeHistory,
  type RoundLine,
  type SeasonRound,
} from "./stats";

const entries = (points: number[]) => points.map((p, i) => ({ profileId: `p${String(i + 1).padStart(2, "0")}`, points: p }));

describe("standingSummary", () => {
  // Twelve players: 1st–2nd tied, 7th–8th tied, 10th–11th tied.
  const table = entries([41, 41, 40, 39, 38, 38, 36, 36, 35, 34, 34, 30]);

  it("measures the distance to 1st, 7th and second-to-last", () => {
    expect(standingSummary(table, "p03")).toEqual({
      position: 3,
      tied: false,
      participants: 12,
      points: 40,
      gaps: [
        { kind: "winner", position: 1, points: 41, diff: -1 },
        { kind: "lucky_seven", position: 7, points: 36, diff: 4 },
        { kind: "bobby", position: 11, points: 34, diff: 6 },
      ],
      chaser: null,
    });
  });

  it("shares the first position of a tie", () => {
    const summary = standingSummary(table, "p08")!;
    expect(summary).toMatchObject({ position: 7, tied: true });
    expect(summary.gaps.find((g) => g.kind === "lucky_seven")?.diff).toBe(0);
  });

  it("tells a lone leader who is chasing them", () => {
    const summary = standingSummary(entries([32, 30, 30, 29]), "p01")!;
    expect(summary.chaser).toEqual({ position: 2, points: 30, diff: 2 });
    expect(summary.gaps[0]).toMatchObject({ kind: "winner", diff: 0 });
  });

  it("has no chaser when the lead is shared", () => {
    expect(standingSummary(table, "p01")?.chaser).toBeNull();
  });

  it("skips prizes whose position doesn't exist with so few players", () => {
    expect(standingSummary(entries([5, 3, 1]), "p02")?.gaps.map((g) => g.kind)).toEqual(["winner", "bobby"]);
  });

  it("returns null for someone who isn't in the standings", () => {
    expect(standingSummary(table, "nobody")).toBeNull();
  });
});

/** One round of three players paying $100: the given prizes go with the points. */
function round(id: string, scores: [points: number, prizeCents?: number, bonusCents?: number][]): SeasonRound {
  return {
    id,
    entryFeeCents: 100_00,
    scores: scores.map(([points, prizeCents = 0, bonusCents = 0], i) => ({
      profileId: ["ana", "beto", "caro"][i],
      points,
      prizeCents,
      bonusCents,
    })),
  };
}

describe("roundHistory", () => {
  const season = [
    round("j1", [[3], [5, 225_00], [4]]),
    round("j2", [[6, 112_50], [6, 112_50], [2]]),
    round("j3", [[9, 225_00, 1000_00], [1], [5]]),
  ];

  it("follows points, money and standing round by round", () => {
    expect(roundHistory(season, "ana")).toEqual<RoundLine[]>([
      {
        roundId: "j1", points: 3, groupPoints: 12, participants: 3, bestPoints: 5,
        won: false, shared: false, wonCents: 0, feeCents: 100_00, netCents: -100_00, standing: 3,
      },
      {
        roundId: "j2", points: 6, groupPoints: 14, participants: 3, bestPoints: 6,
        won: true, shared: true, wonCents: 112_50, feeCents: 100_00, netCents: -87_50, standing: 2,
      },
      {
        roundId: "j3", points: 9, groupPoints: 15, participants: 3, bestPoints: 9,
        won: true, shared: false, wonCents: 1225_00, feeCents: 100_00, netCents: 1037_50, standing: 1,
      },
    ]);
  });

  it("shares a standing with whoever is tied on points", () => {
    expect(roundHistory(season, "beto").map((l) => l.standing)).toEqual([1, 1, 2]);
    const tied = [round("j1", [[4], [4], [1]])];
    expect(roundHistory(tied, "beto")[0].standing).toBe(1);
  });

  it("leaves out rounds the player isn't part of", () => {
    const late = [...season, { id: "j4", entryFeeCents: 100_00, scores: [{ profileId: "ana", points: 2, prizeCents: 75_00, bonusCents: 0 }] }];
    expect(roundHistory(late, "caro").map((l) => l.roundId)).toEqual(["j1", "j2", "j3"]);
    expect(roundHistory(late, "caro").at(-1)?.netCents).toBe(-300_00);
  });
});

describe("summarizeHistory", () => {
  const line = (roundId: string, points: number, groupPoints: number, extra: Partial<RoundLine> = {}): RoundLine => ({
    roundId, points, groupPoints, participants: 4, bestPoints: 9,
    won: false, shared: false, wonCents: 0, feeCents: 100_00, netCents: 0, standing: 1,
    ...extra,
  });

  // Group average per round: 4, 4, 3, 4, 2, 5.
  const lines = [
    line("j1", 5, 16, { won: true }),
    line("j2", 3, 16),
    line("j3", 3, 12),
    line("j4", 5, 16, { won: true, shared: true }),
    line("j5", 2, 8),
    line("j6", 4, 20),
  ];

  it("adds up points, wins and averages", () => {
    expect(summarizeHistory(lines)).toMatchObject({
      rounds: 6,
      points: 22,
      wins: 2,
      sharedWins: 1,
      best: { points: 5, roundIds: ["j1", "j4"] },
      worst: { points: 2, roundIds: ["j5"] },
    });
    expect(summarizeHistory(lines).average).toBeCloseTo(22 / 6);
    expect(summarizeHistory(lines).groupAverage).toBeCloseTo(88 / 24);
  });

  it("counts a round equal to the group's average towards the streak", () => {
    const summary = summarizeHistory(lines);
    expect(summary.longestStreak).toEqual({ length: 3, fromRoundId: "j3", toRoundId: "j5" });
    expect(summary.currentStreak).toBe(0);
  });

  it("keeps the earliest of two equally long streaks and the one still running", () => {
    const summary = summarizeHistory([line("j1", 5, 16), line("j2", 1, 16), line("j3", 5, 16)]);
    expect(summary.longestStreak).toEqual({ length: 1, fromRoundId: "j1", toRoundId: "j1" });
    expect(summary.currentStreak).toBe(1);
  });

  it("is empty before the first round", () => {
    expect(summarizeHistory([])).toEqual({
      rounds: 0, points: 0, average: 0, groupAverage: 0, wins: 0, sharedWins: 0,
      best: null, worst: null, longestStreak: null, currentStreak: 0,
    });
  });
});

describe("netByMeeting", () => {
  const oct = new Date("2026-10-03T06:00:00Z"); // Sat Oct 3, 00:00 CDMX
  const nov = new Date("2026-11-07T06:00:00Z");

  it("adds every pool's rounds of the same meeting and accumulates", () => {
    expect(
      netByMeeting([
        { cutoffAt: nov, settled: false, netCents: -100_00 },
        { cutoffAt: oct, settled: true, netCents: -300_00 },
        { cutoffAt: oct, settled: true, netCents: 262_50 },
        // Another pool's period for the same weekend, moved a few hours by its sub-admin.
        { cutoffAt: new Date("2026-10-03T15:00:00Z"), settled: true, netCents: -175_00 },
      ]),
    ).toEqual([
      { cutoffAt: oct, settled: true, rounds: 3, netCents: -212_50, cumulativeCents: -212_50 },
      { cutoffAt: nov, settled: false, rounds: 1, netCents: -100_00, cumulativeCents: -312_50 },
    ]);
  });

  it("is pending while any pool of the meeting hasn't been paid", () => {
    const [meeting] = netByMeeting([
      { cutoffAt: oct, settled: true, netCents: 50_00 },
      { cutoffAt: oct, settled: false, netCents: -100_00 },
    ]);
    expect(meeting).toMatchObject({ settled: false, netCents: -50_00 });
  });

  it("puts rounds without a period last", () => {
    const meetings = netByMeeting([
      { cutoffAt: null, settled: false, netCents: -100_00 },
      { cutoffAt: oct, settled: true, netCents: 800_00 },
    ]);
    expect(meetings.map((m) => [m.cutoffAt, m.cumulativeCents])).toEqual([[oct, 800_00], [null, 700_00]]);
  });
});

describe("matchPickStats", () => {
  it("counts hits overall and by what was picked", () => {
    expect(
      matchPickStats("liga_mx", [
        { selection: "home", result: "home" },
        { selection: "home", result: "away" },
        { selection: "draw", result: "draw" },
        { selection: "away", result: "home" },
      ]),
    ).toEqual({
      overall: { hits: 2, total: 4 },
      bySelection: { home: { hits: 1, total: 2 }, draw: { hits: 1, total: 1 }, away: { hits: 0, total: 1 } },
    });
  });

  it("leaves out matches that nobody could score", () => {
    const picks = [
      { selection: "home", result: "void" },
      { selection: "away", result: null },
      { selection: "home", result: "draw" },
    ] as const;
    // An NFL tie awards no points; a Liga MX draw is just a wrong pick.
    expect(matchPickStats("nfl", picks).overall).toEqual({ hits: 0, total: 0 });
    expect(matchPickStats("liga_mx", picks).overall).toEqual({ hits: 0, total: 1 });
  });
});

describe("f1PickStats", () => {
  const order = ["ver", "nor", "lec", "pia", "ham", "rus", "alo", "sai", "gas", "tsu"];

  it("counts exact positions, P1 first", () => {
    const stats = f1PickStats([
      { pick: ["ver", "lec", "nor", "pia", "ham", "rus", "alo", "sai", "gas", "tsu"], classification: order },
      { pick: ["ver", "nor", "lec", null, null, null, null, null, null, null], classification: order },
    ]);
    expect(stats.overall).toEqual({ hits: 11, total: 13 });
    expect(stats.byPosition.slice(0, 4)).toEqual([
      { hits: 2, total: 2 },
      { hits: 1, total: 2 },
      { hits: 1, total: 2 },
      { hits: 1, total: 1 },
    ]);
  });

  it("skips positions without an official result", () => {
    const stats = f1PickStats([{ pick: order, classification: ["ver", null] }]);
    expect(stats.overall).toEqual({ hits: 1, total: 1 });
    expect(stats.byPosition).toHaveLength(10);
  });
});
