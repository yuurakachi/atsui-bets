import { describe, expect, it, vi } from "vitest";
import type { PoolOverview } from "./pools";

vi.mock("server-only", () => ({}));
vi.mock("./supabase/server", () => ({ createClient: vi.fn() }));
const { buildPoolStats } = await import("./stats");

const oct = { id: "oct", cutoffAt: new Date("2026-10-03T06:00:00Z"), settled: true };
const dec = { id: "dec", cutoffAt: new Date("2026-12-05T06:00:00Z"), settled: false };

/**
 * A two-round season of three players paying $100 a round. Ana wins both rounds and
 * the jackpot's 70 %; Beto is second-to-last.
 */
function season(overrides: Partial<PoolOverview> = {}): PoolOverview {
  const result = (playerId: string, points: number, position: number, prizeCents = 0) => ({
    playerId,
    name: playerId,
    points,
    position,
    prizeCents,
    bonusCents: 0,
  });
  return {
    id: "pool",
    name: "Liga MX Apertura 2026",
    sport: "liga_mx",
    finished: false,
    playoffs: false,
    buyInCents: 0,
    entryFeeCents: 100_00,
    jackpotBalanceCents: 150_00,
    jackpotAwards: [],
    periods: [oct, dec],
    rounds: [
      {
        id: "j1", name: "J1", ordinal: 1, potCents: 300_00, jackpotCents: 75_00, settled: true, periodId: "oct",
        results: [result("ana", 5, 1, 225_00), result("beto", 3, 2), result("caro", 1, 3)],
      },
      {
        id: "j2", name: "J2", ordinal: 2, potCents: 300_00, jackpotCents: 75_00, settled: false, periodId: "dec",
        results: [result("ana", 4, 1, 225_00), result("caro", 3, 2), result("beto", 2, 3)],
      },
    ],
    season: [
      { playerId: "ana", name: "ana", points: 9, position: 1, wonCents: 450_00, paidCents: 200_00, netCents: 250_00,
        jackpotPrize: { kind: "winner", cents: 105_00 } },
      { playerId: "beto", name: "beto", points: 5, position: 2, wonCents: 0, paidCents: 200_00, netCents: -200_00,
        jackpotPrize: { kind: "bobby", cents: 15_00 } },
      { playerId: "caro", name: "caro", points: 4, position: 3, wonCents: 0, paidCents: 200_00, netCents: -200_00,
        jackpotPrize: null },
    ],
    ...overrides,
  };
}

const sum = (cents: number[]) => cents.reduce((a, b) => a + b, 0);

describe("buildPoolStats", () => {
  it("leaves the jackpot out while the season is on", () => {
    const stats = buildPoolStats("ana", season())!;
    expect(stats).toMatchObject({ wonCents: 450_00, netCents: 250_00, closing: null, finished: false, closed: false });
    expect(sum(stats.money.map((m) => m.netCents))).toBe(stats.netCents);
  });

  it("adds the jackpot prize once the season is over, at the meeting of its last round", () => {
    const stats = buildPoolStats("ana", season({ finished: true }))!;
    expect(stats).toMatchObject({ wonCents: 555_00, paidCents: 200_00, netCents: 355_00, finished: true, closed: false });
    expect(stats.closing).toEqual({
      cents: 105_00, prizeCents: 105_00, buyInCents: 0, cutoffAt: dec.cutoffAt, paid: false,
    });
    expect(stats.money.at(-1)).toEqual({ cutoffAt: dec.cutoffAt, settled: false, netCents: 105_00 });
    expect(sum(stats.money.map((m) => m.netCents))).toBe(stats.netCents);
  });

  it("keeps the jackpot out of the next meeting's rounds", () => {
    const stats = buildPoolStats("ana", season({ finished: true }))!;
    expect(stats.nextMeeting).toEqual({ cutoffAt: dec.cutoffAt, rounds: 1, netCents: 125_00 });
  });

  it("closes the season once every round is paid", () => {
    const paid = season({ finished: true, periods: [oct, { ...dec, settled: true }] });
    paid.rounds[1].settled = true;
    const stats = buildPoolStats("beto", paid)!;
    expect(stats).toMatchObject({ closed: true, netCents: -185_00 });
    expect(stats.closing).toMatchObject({ cents: 15_00, paid: true });
  });

  it("has nothing to close for a finished season without a prize", () => {
    const stats = buildPoolStats("caro", season({ finished: true }))!;
    expect(stats.closing).toBeNull();
    expect(stats.netCents).toBe(-200_00);
  });

  it("takes a playoff buy-in at the end, with the prizes", () => {
    // A liguilla: no fee per round, $300 each paid at the end; the standings already count it as paid.
    const liguilla = (finished: boolean) =>
      season({
        finished,
        playoffs: true,
        buyInCents: 300_00,
        entryFeeCents: 0,
        rounds: season().rounds.map((r) => ({ ...r, results: r.results.map((x) => ({ ...x, prizeCents: 0 })) })),
        season: season().season.map((row) => ({ ...row, wonCents: 0, paidCents: 300_00, netCents: -300_00 })),
      });

    const playing = buildPoolStats("ana", liguilla(false))!;
    expect(playing.closing).toEqual({ cents: -300_00, prizeCents: 0, buyInCents: 300_00, cutoffAt: null, paid: false });
    expect(playing.netCents).toBe(-300_00);
    expect(sum(playing.money.map((m) => m.netCents))).toBe(playing.netCents);

    const over = buildPoolStats("ana", liguilla(true))!;
    expect(over.closing).toMatchObject({ cents: 105_00 - 300_00, cutoffAt: dec.cutoffAt });
    expect(over.netCents).toBe(105_00 - 300_00);
    expect(sum(over.money.map((m) => m.netCents))).toBe(over.netCents);
  });
});
