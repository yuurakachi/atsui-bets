import { describe, expect, it } from "vitest";
import { distributePrizes, perfectRoundBonus, settleRound } from "./prizes";
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
  it("pays 75 % to the winner and 25 % to the jackpot", () => {
    const round = settleRound(entries([6, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4]));

    expect(round.potCents).toBe(1200_00);
    expect(round.weeklyPrizeCents).toBe(900_00);
    expect(round.jackpotCents).toBe(300_00);
    expect(round.winnerIds).toEqual(["p01"]);
    expect(round.wonCents.get("p01")).toBe(900_00);
    expect(round.wonCents.get("p02")).toBe(0);
  });

  it("splits the weekly prize between people tied for first", () => {
    const round = settleRound(entries([5, 5, 5, 5, 5, 4, 4, 3, 3, 3, 3, 3]));
    expect(round.winnerIds).toHaveLength(5);
    expect(round.perWinnerCents).toBe(180_00);
    expect(round.jackpotCents).toBe(300_00);
  });

  it("sends rounding leftovers to the jackpot", () => {
    // 900 / 7 = 128.571… → 128.57 each, 1 cent left over
    const round = settleRound(entries([4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3]));
    expect(round.perWinnerCents).toBe(128_57);
    expect(round.jackpotCents).toBe(300_01);
  });

  it("counts participants without picks as 0 points", () => {
    const round = settleRound(entries([0, 0, 0]));
    expect(round.potCents).toBe(300_00);
    expect(round.winnerIds).toHaveLength(3);
  });

  it("detects perfect rounds only when the maximum is known", () => {
    expect(settleRound(entries([9, 9, 7])).perfectIds).toEqual([]);
    expect(settleRound(entries([9, 9, 7]), { maxPoints: 9 }).perfectIds).toEqual(["p01", "p02"]);
    expect(settleRound(entries([10, 3]), { maxPoints: 10 }).perfectIds).toEqual(["p01"]);
  });
});

describe("perfectRoundBonus", () => {
  it("pays $1,000 per perfect round from the jackpot", () => {
    expect(perfectRoundBonus(2700_00, 1)).toBe(1000_00);
    expect(perfectRoundBonus(2700_00, 2)).toBe(1000_00);
  });

  it("splits what's left when the jackpot can't cover everyone", () => {
    expect(perfectRoundBonus(1500_00, 2)).toBe(750_00);
    expect(perfectRoundBonus(0, 1)).toBe(0);
  });

  it("pays nothing without perfect rounds", () => {
    expect(perfectRoundBonus(2700_00, 0)).toBe(0);
  });
});

describe("distributePrizes for the season jackpot", () => {
  it("uses 70 / 20 / 10 for 1st, 7th and second-to-last", () => {
    const result = distributePrizes(10_000_00, entries([90, 80, 70, 60, 50, 40, 30, 20, 10]));
    expect(result.wonCents.get("p01")).toBe(7_000_00);
    expect(result.wonCents.get("p07")).toBe(2_000_00);
    expect(result.wonCents.get("p08")).toBe(1_000_00);
  });

  it("splits a prize when a tie spans its position", () => {
    // positions 6–8 tied
    const result = distributePrizes(1000_00, entries([15, 14, 13, 12, 11, 9, 9, 9, 7, 6, 5, 4]));
    for (const id of ["p06", "p07", "p08"]) expect(result.wonCents.get(id)).toBe(66_66);
    expect(result.undistributedCents).toBe(2);
  });

  it("gives both prizes to a tie that spans 7th and second-to-last", () => {
    // 12 people, positions 6–12 tied: they share lucky seven and bobby
    const result = distributePrizes(1000_00, entries([9, 8, 8, 8, 8, 5, 5, 5, 5, 5, 5, 5]));
    for (const id of ["p06", "p12"]) expect(result.wonCents.get(id)).toBe(28_57 + 14_28);
  });

  it("keeps a prize undistributed when its position doesn't exist", () => {
    const result = distributePrizes(1000_00, entries([3, 2, 1]));
    expect(result.awards.map((a) => a.kind)).toEqual(["winner", "bobby"]);
    expect(result.undistributedCents).toBe(200_00);
  });
});
