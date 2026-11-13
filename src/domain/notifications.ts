/**
 * Who gets which phone notification, and when. See docs/ARCHITECTURE.md (Notifications).
 */
import { f1PicksShownFrom } from "./f1";
import { TIME_ZONE } from "./time";
import type { Cents, ProfileId, Sport } from "./types";

/** The "picks lock soon" notice goes out this long before the lock. */
export const CLOSING_NOTICE_MINUTES = 10;

/** Rounds more than this far after a pool's next deadline aren't shown yet (F1 loads the whole season). */
const SHOWN_WINDOW_MS = 4 * 24 * 60 * 60 * 1000;

export interface OpenRound {
  id: string;
  poolId: string;
  sport: Sport;
  /** When its next open event locks. */
  firstLockAt: Date;
}

/**
 * The open rounds a player can already see and pick: those of each pool's next deadline
 * (and up to 4 days after it), and in F1 only from Monday 00:00 of the race week.
 */
export function shownRounds<T extends OpenRound>(rounds: readonly T[], now: Date): T[] {
  const nextDeadline = new Map<string, number>();
  for (const r of rounds) {
    const lock = r.firstLockAt.getTime();
    nextDeadline.set(r.poolId, Math.min(lock, nextDeadline.get(r.poolId) ?? lock));
  }
  return rounds.filter(
    (r) =>
      r.firstLockAt.getTime() <= nextDeadline.get(r.poolId)! + SHOWN_WINDOW_MS &&
      (r.sport !== "f1" || f1PicksShownFrom(r.firstLockAt).getTime() <= now.getTime()),
  );
}

const localHour = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" });

/** "Picks are open" waits for the morning: rounds open by themselves at midnight. */
export function quietHours(now: Date): boolean {
  const hour = Number(localHour.format(now));
  return hour < 9 || hour >= 22;
}

/** One event to pick (one match, or one F1 race with ten positions) that hasn't locked. */
export interface PickSlot {
  eventId: string;
  roundId: string;
  poolId: string;
  lockAt: Date;
  /** 1 per match, 10 per F1 race. */
  picksNeeded: number;
}

export interface ClosingInput {
  now: Date;
  slots: readonly PickSlot[];
  enrollments: readonly { poolId: string; playerId: ProfileId }[];
  /** How many picks each player has made per event. */
  picks: readonly { eventId: string; playerId: ProfileId; count: number }[];
  /** `delegateId` enters `playerId`'s picks in `poolId`. */
  delegates: readonly { poolId: string; playerId: ProfileId; delegateId: ProfileId }[];
}

export interface MissingPicks {
  playerId: ProfileId;
  poolId: string;
  roundIds: string[];
  missing: number;
}

export interface ClosingNotice {
  recipientId: ProfileId;
  lockAt: Date;
  /** The recipient's own first, then those of the players whose picks they enter. */
  missing: MissingPicks[];
}

/**
 * The "picks lock in 10 minutes" notices, one batch per lock time within the next 10
 * minutes. Only players missing a pick of what locks get one, and so do their delegates.
 * A lock time where nobody is missing anything still has its (empty) batch.
 */
export function closingBatches(input: ClosingInput): { lockAt: Date; notices: ClosingNotice[] }[] {
  const now = input.now.getTime();
  const until = now + CLOSING_NOTICE_MINUTES * 60_000;
  const due = input.slots.filter((s) => s.lockAt.getTime() > now && s.lockAt.getTime() <= until);

  const picked = new Map(input.picks.map((p) => [`${p.playerId}:${p.eventId}`, p.count]));
  const lockTimes = [...new Set(due.map((s) => s.lockAt.getTime()))].sort((a, b) => a - b);

  return lockTimes.map((lock) => {
    const slots = due.filter((s) => s.lockAt.getTime() === lock);
    const missing: MissingPicks[] = [];
    for (const { poolId, playerId } of input.enrollments) {
      let count = 0;
      const roundIds: string[] = [];
      for (const s of slots.filter((s) => s.poolId === poolId)) {
        const left = s.picksNeeded - Math.min(s.picksNeeded, picked.get(`${playerId}:${s.eventId}`) ?? 0);
        if (left === 0) continue;
        count += left;
        if (!roundIds.includes(s.roundId)) roundIds.push(s.roundId);
      }
      if (count > 0) missing.push({ playerId, poolId, roundIds, missing: count });
    }

    const byRecipient = new Map<ProfileId, MissingPicks[]>();
    const add = (recipientId: ProfileId, m: MissingPicks) =>
      byRecipient.set(recipientId, [...(byRecipient.get(recipientId) ?? []), m]);
    for (const m of missing) add(m.playerId, m);
    for (const m of missing) {
      for (const d of input.delegates) {
        if (d.poolId === m.poolId && d.playerId === m.playerId) add(d.delegateId, m);
      }
    }

    const lockAt = new Date(lock);
    const notices = [...byRecipient].map(([recipientId, list]) => ({
      recipientId,
      lockAt,
      missing: [...list.filter((m) => m.playerId === recipientId), ...list.filter((m) => m.playerId !== recipientId)],
    }));
    return { lockAt, notices };
  });
}

export interface RoundOutcome {
  /** Everyone tied for the most points. */
  winnerIds: ProfileId[];
  points: number;
  /** Each winner's share of the weekly prize. */
  prizeEachCents: Cents;
  perfectIds: ProfileId[];
  bonusEachCents: Cents;
}

/** Who won a scored round and what, from its stored results. */
export function roundOutcome(
  results: readonly { playerId: ProfileId; points: number; prizeCents: Cents; bonusCents: Cents }[],
): RoundOutcome {
  const points = Math.max(...results.map((r) => r.points));
  const winners = results.filter((r) => r.points === points);
  const perfect = results.filter((r) => r.bonusCents > 0);
  return {
    winnerIds: winners.map((r) => r.playerId),
    points,
    prizeEachCents: winners[0]?.prizeCents ?? 0,
    perfectIds: perfect.map((r) => r.playerId),
    bonusEachCents: perfect[0]?.bonusCents ?? 0,
  };
}
