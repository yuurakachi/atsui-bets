import { describe, expect, it } from "vitest";
import { distributePrizes, settleRound } from "./prizes";
import { rankEntries, type StandingEntry } from "./standings";

/** p01 … pNN with the given points, in order. */
function entries(points: number[]): StandingEntry[] {
  return points.map((p, i) => ({ profileId: `p${String(i + 1).padStart(2, "0")}`, points: p }));
}

describe("rankEntries", () => {
  it("groups ties into position ranges", () => {
    const groups = rankEntries(entries([9, 7, 7, 5]));
    expect(groups.map((g) => [g.from, g.to])).toEqual([[1, 1], [2, 3], [4, 4]]);
  });
});

describe("settleRound", () => {
  it("splits a 15-person round 30 % jackpot, then 50 / 35 / 15", () => {
    // p01 has 15 points … p15 has 1 point
    const round = settleRound(entries([15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]));

    expect(round.potCents).toBe(1500_00);
    expect(round.jackpotCents).toBe(450_00);
    expect(round.payoutCents).toBe(1050_00);
    expect(round.wonCents.get("p01")).toBe(525_00); // 1st
    expect(round.wonCents.get("p07")).toBe(367_50); // 7th
    expect(round.wonCents.get("p14")).toBe(157_50); // second-to-last
    expect(round.wonCents.get("p15")).toBe(0);
    expect(round.undistributedCents).toBe(0);
  });

  it("splits the winner prize between people tied for first", () => {
    const round = settleRound(entries([10, 10, 8, 7, 6, 5, 4, 3, 2, 1]));
    expect(round.wonCents.get("p01")).toBe(175_00);
    expect(round.wonCents.get("p02")).toBe(175_00);
    // The tie occupies positions 1–2, so position 7 is still p07.
    expect(round.wonCents.get("p07")).toBe(245_00);
  });

  it("splits lucky seven when a tie spans position 7", () => {
    // positions 6–8 tied
    const round = settleRound(entries([15, 14, 13, 12, 11, 9, 9, 9, 7, 6, 5, 4, 3, 2, 1]));
    for (const id of ["p06", "p07", "p08"]) expect(round.wonCents.get(id)).toBe(122_50);
  });

  it("splits bobby when a tie spans second-to-last", () => {
    const round = settleRound(entries([15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 1, 1, 1]));
    for (const id of ["p13", "p14", "p15"]) expect(round.wonCents.get(id)).toBe(52_50);
  });

  it("sends rounding leftovers to the jackpot", () => {
    // 4-way tie at 6–9 → 367.50 / 4 = 91.875 → 91.87 each, 2 cents left over
    const round = settleRound(entries([15, 14, 13, 12, 11, 9, 9, 9, 9, 6, 5, 4, 3, 2, 1]));
    expect(round.wonCents.get("p06")).toBe(91_87);
    expect(round.undistributedCents).toBe(2);
    expect(round.jackpotCents).toBe(450_02);
  });

  it("counts participants without picks as 0 points", () => {
    // 15 people, 3 made no picks: they are tied last (13–15) and win bobby.
    const round = settleRound(entries([15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 0, 0, 0]));
    for (const id of ["p13", "p14", "p15"]) expect(round.wonCents.get(id)).toBe(52_50);
  });

  it("pays both prizes to one group when positions coincide", () => {
    // 8 participants: 7th is also second-to-last
    const round = settleRound(entries([8, 7, 6, 5, 4, 3, 2, 1]));
    expect(round.wonCents.get("p07")).toBe(196_00 + 84_00);
  });

  it("keeps a prize in the jackpot when its position doesn't exist", () => {
    const round = settleRound(entries([3, 2, 1]));
    expect(round.awards.map((a) => a.kind)).toEqual(["winner", "bobby"]);
    expect(round.jackpotCents).toBe(90_00 + 73_50);
  });
});

describe("distributePrizes for the season jackpot", () => {
  it("uses the same 50 / 35 / 15 rule on season standings", () => {
    const result = distributePrizes(10_000_00, entries([90, 80, 70, 60, 50, 40, 30, 20, 10]));
    expect(result.wonCents.get("p01")).toBe(5_000_00);
    expect(result.wonCents.get("p07")).toBe(3_500_00);
    expect(result.wonCents.get("p08")).toBe(1_500_00);
  });
});
