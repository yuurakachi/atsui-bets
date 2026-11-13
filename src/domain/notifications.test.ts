import { describe, expect, it } from "vitest";
import { closingBatches, quietHours, roundOutcome, shownRounds, type PickSlot } from "./notifications";

// Mexico City is UTC-6 all year. November 2026: Thu 12, Fri 13, Sun 15, Mon 16 … Sat 21.

describe("shownRounds", () => {
  it("shows the next Liga MX matchday but not one more than 4 days after the pool's next deadline", () => {
    const rounds = [
      { id: "j17", poolId: "liga", sport: "liga_mx" as const, firstLockAt: new Date("2026-11-14T00:55:00Z") }, // Fri 18:55
      { id: "j18", poolId: "liga", sport: "liga_mx" as const, firstLockAt: new Date("2026-11-21T00:55:00Z") }, // next Fri
    ];
    const now = new Date("2026-11-12T18:00:00Z");
    expect(shownRounds(rounds, now).map((r) => r.id)).toEqual(["j17"]);
  });

  it("shows an F1 race from Monday 00:00 of its race week, Sprint and GP together", () => {
    const lock = new Date("2026-11-21T17:25:00Z"); // Sat Nov 21, 11:25
    const rounds = [
      { id: "sprint", poolId: "f1", sport: "f1" as const, firstLockAt: lock },
      { id: "gp", poolId: "f1", sport: "f1" as const, firstLockAt: lock },
    ];
    expect(shownRounds(rounds, new Date("2026-11-16T05:59:00Z"))).toEqual([]); // Sun 23:59
    expect(shownRounds(rounds, new Date("2026-11-16T06:00:00Z")).map((r) => r.id)).toEqual(["sprint", "gp"]); // Mon 00:00
  });

  it("decides each pool on its own deadline", () => {
    const rounds = [
      { id: "j17", poolId: "liga", sport: "liga_mx" as const, firstLockAt: new Date("2026-11-14T00:55:00Z") },
      { id: "w11", poolId: "nfl", sport: "nfl" as const, firstLockAt: new Date("2026-11-20T01:10:00Z") }, // Thu Nov 19
    ];
    expect(shownRounds(rounds, new Date("2026-11-12T18:00:00Z")).map((r) => r.id)).toEqual(["j17", "w11"]);
  });
});

describe("quietHours", () => {
  it("is quiet from 22:00 to 8:59 in Mexico City", () => {
    expect(quietHours(new Date("2026-11-16T06:00:00Z"))).toBe(true); // 00:00
    expect(quietHours(new Date("2026-11-16T14:59:00Z"))).toBe(true); // 08:59
    expect(quietHours(new Date("2026-11-16T15:00:00Z"))).toBe(false); // 09:00
    expect(quietHours(new Date("2026-11-17T03:59:00Z"))).toBe(false); // 21:59
    expect(quietHours(new Date("2026-11-17T04:00:00Z"))).toBe(true); // 22:00
  });
});

describe("closingBatches", () => {
  const now = new Date("2026-11-14T00:45:00Z"); // Fri Nov 13, 18:45
  const lock1855 = new Date("2026-11-14T00:55:00Z");
  const slots: PickSlot[] = [
    { eventId: "already", roundId: "j17", poolId: "liga", lockAt: new Date("2026-11-14T00:44:00Z"), picksNeeded: 1 },
    { eventId: "pumas", roundId: "j17", poolId: "liga", lockAt: lock1855, picksNeeded: 1 },
    { eventId: "chiefs", roundId: "w11", poolId: "nfl", lockAt: lock1855, picksNeeded: 1 },
    { eventId: "later", roundId: "j17", poolId: "liga", lockAt: new Date("2026-11-14T01:00:00Z"), picksNeeded: 1 }, // 19:00
  ];
  const enrollments = [
    { poolId: "liga", playerId: "ana" },
    { poolId: "nfl", playerId: "ana" },
    { poolId: "liga", playerId: "beto" },
    { poolId: "liga", playerId: "nao" },
    { poolId: "liga", playerId: "tato" },
  ];

  it("warns only whoever is missing a pick of what locks within 10 minutes, in one notice per lock time", () => {
    const batches = closingBatches({
      now,
      slots,
      enrollments,
      picks: [
        { eventId: "pumas", playerId: "beto", count: 1 },
        { eventId: "pumas", playerId: "tato", count: 1 },
      ],
      delegates: [],
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].lockAt).toEqual(lock1855);
    expect(batches[0].notices).toEqual([
      {
        recipientId: "ana",
        lockAt: lock1855,
        missing: [
          { playerId: "ana", poolId: "liga", roundIds: ["j17"], missing: 1 },
          { playerId: "ana", poolId: "nfl", roundIds: ["w11"], missing: 1 },
        ],
      },
      { recipientId: "nao", lockAt: lock1855, missing: [{ playerId: "nao", poolId: "liga", roundIds: ["j17"], missing: 1 }] },
    ]);
  });

  it("also warns the delegate who enters the player's picks, in that pool only", () => {
    const batches = closingBatches({
      now,
      slots,
      enrollments,
      picks: [{ eventId: "pumas", playerId: "tato", count: 1 }],
      delegates: [
        { poolId: "liga", playerId: "nao", delegateId: "tato" },
        { poolId: "liga", playerId: "ana", delegateId: "tato" },
      ],
    });
    // Ana also misses an NFL game, but Tato only enters her Liga MX picks.
    const tato = batches[0].notices.find((n) => n.recipientId === "tato");
    expect(tato?.missing).toEqual([
      { playerId: "ana", poolId: "liga", roundIds: ["j17"], missing: 1 },
      { playerId: "nao", poolId: "liga", roundIds: ["j17"], missing: 1 },
    ]);
    expect(batches[0].notices.find((n) => n.recipientId === "nao")?.missing).toHaveLength(1);
  });

  it("counts the F1 positions still empty", () => {
    const batches = closingBatches({
      now,
      slots: [
        { eventId: "sprint", roundId: "r-sprint", poolId: "f1", lockAt: lock1855, picksNeeded: 10 },
        { eventId: "gp", roundId: "r-gp", poolId: "f1", lockAt: lock1855, picksNeeded: 10 },
      ],
      enrollments: [
        { poolId: "f1", playerId: "ana" },
        { poolId: "f1", playerId: "beto" },
      ],
      picks: [
        { eventId: "sprint", playerId: "ana", count: 10 },
        { eventId: "gp", playerId: "ana", count: 8 },
        { eventId: "sprint", playerId: "beto", count: 10 },
        { eventId: "gp", playerId: "beto", count: 10 },
      ],
      delegates: [],
    });
    expect(batches[0].notices).toEqual([
      { recipientId: "ana", lockAt: lock1855, missing: [{ playerId: "ana", poolId: "f1", roundIds: ["r-gp"], missing: 2 }] },
    ]);
  });

  it("keeps a lock time with nobody missing as an empty batch, so it is only checked once", () => {
    const batches = closingBatches({
      now,
      slots: [slots[1]],
      enrollments: [{ poolId: "liga", playerId: "beto" }],
      picks: [{ eventId: "pumas", playerId: "beto", count: 1 }],
      delegates: [],
    });
    expect(batches).toEqual([{ lockAt: lock1855, notices: [] }]);
  });
});

describe("roundOutcome", () => {
  it("names the winner, their points and prize", () => {
    expect(
      roundOutcome([
        { playerId: "ana", points: 7, prizeCents: 1125_00, bonusCents: 0 },
        { playerId: "beto", points: 5, prizeCents: 0, bonusCents: 0 },
      ]),
    ).toEqual({ winnerIds: ["ana"], points: 7, prizeEachCents: 1125_00, perfectIds: [], bonusEachCents: 0 });
  });

  it("lists everyone tied for first and the perfect rounds", () => {
    expect(
      roundOutcome([
        { playerId: "beto", points: 9, prizeCents: 562_50, bonusCents: 1000_00 },
        { playerId: "ana", points: 9, prizeCents: 562_50, bonusCents: 1000_00 },
        { playerId: "caro", points: 4, prizeCents: 0, bonusCents: 0 },
      ]),
    ).toEqual({
      winnerIds: ["beto", "ana"],
      points: 9,
      prizeEachCents: 562_50,
      perfectIds: ["beto", "ana"],
      bonusEachCents: 1000_00,
    });
  });
});
