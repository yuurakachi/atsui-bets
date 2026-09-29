/**
 * Round payouts and season jackpot. See docs/RULES.md §4–5.
 */
import { rankEntries, type StandingEntry } from "./standings";
import { ENTRY_FEE_CENTS, type Cents, type ProfileId } from "./types";

export const JACKPOT_PERCENT = 25;
export const PERFECT_ROUND_BONUS_CENTS: Cents = 1000_00;

export type PrizeKind = "winner" | "lucky_seven" | "bobby";

interface PrizeRule {
  kind: PrizeKind;
  percent: number;
  position: (participants: number) => number;
}

/** How the season jackpot is split. */
export const JACKPOT_PRIZE_RULES: readonly PrizeRule[] = [
  { kind: "winner", percent: 50, position: () => 1 },
  { kind: "lucky_seven", percent: 35, position: () => 7 },
  { kind: "bobby", percent: 15, position: (n) => n - 1 },
];

export interface Award {
  kind: PrizeKind;
  position: number;
  amountCents: Cents;
  profileIds: ProfileId[];
  perPersonCents: Cents;
}

export interface Distribution {
  awards: Award[];
  /** Total won per participant; everyone in `entries` is present, with 0 if they won nothing. */
  wonCents: Map<ProfileId, Cents>;
  /** Cents lost to rounding, or prizes whose position doesn't exist with so few participants. */
  undistributedCents: Cents;
}

/**
 * Splits `totalCents` 50 / 35 / 15 between 1st, 7th and second-to-last.
 * Tied participants whose position range contains a prize position split that prize.
 */
export function distributePrizes(totalCents: Cents, entries: readonly StandingEntry[]): Distribution {
  const n = entries.length;
  const groups = rankEntries(entries);
  const wonCents = new Map<ProfileId, Cents>(entries.map((e) => [e.profileId, 0]));
  const awards: Award[] = [];
  let distributed = 0;

  for (const rule of JACKPOT_PRIZE_RULES) {
    const position = rule.position(n);
    const group = groups.find((g) => g.from <= position && position <= g.to);
    if (!group) continue;

    const amountCents = Math.floor((totalCents * rule.percent) / 100);
    const perPersonCents = Math.floor(amountCents / group.profileIds.length);
    for (const id of group.profileIds) {
      wonCents.set(id, (wonCents.get(id) ?? 0) + perPersonCents);
    }
    distributed += perPersonCents * group.profileIds.length;
    awards.push({ kind: rule.kind, position, amountCents, profileIds: group.profileIds, perPersonCents });
  }

  return { awards, wonCents, undistributedCents: totalCents - distributed };
}

export interface RoundSettlement {
  potCents: Cents;
  /** 75 % of the pot. */
  weeklyPrizeCents: Cents;
  /** Everyone tied for the most points. */
  winnerIds: ProfileId[];
  perWinnerCents: Cents;
  /** Weekly prize per participant; everyone in `entries` is present. */
  wonCents: Map<ProfileId, Cents>;
  /** 25 % of the pot plus rounding leftovers from the weekly prize. */
  jackpotCents: Cents;
  /** Participants who got every pick right (only when `maxPoints` is known). */
  perfectIds: ProfileId[];
}

export interface SettleRoundOptions {
  entryFeeCents?: Cents;
  /** Points for a perfect round: scorable matches in Liga MX / NFL, 10 in F1. */
  maxPoints?: number;
}

/** Every enrolled participant is in `entries`, including those who made no picks (0 points). */
export function settleRound(
  entries: readonly StandingEntry[],
  { entryFeeCents = ENTRY_FEE_CENTS, maxPoints }: SettleRoundOptions = {},
): RoundSettlement {
  const potCents = entries.length * entryFeeCents;
  const baseJackpot = Math.floor((potCents * JACKPOT_PERCENT) / 100);
  const weeklyPrizeCents = potCents - baseJackpot;

  const winnerIds = rankEntries(entries)[0]?.profileIds ?? [];
  const perWinnerCents = winnerIds.length > 0 ? Math.floor(weeklyPrizeCents / winnerIds.length) : 0;
  const wonCents = new Map<ProfileId, Cents>(entries.map((e) => [e.profileId, 0]));
  for (const id of winnerIds) wonCents.set(id, perWinnerCents);

  const perfectIds =
    maxPoints && maxPoints > 0 ? entries.filter((e) => e.points === maxPoints).map((e) => e.profileId) : [];

  return {
    potCents,
    weeklyPrizeCents,
    winnerIds,
    perWinnerCents,
    wonCents,
    jackpotCents: potCents - perWinnerCents * winnerIds.length,
    perfectIds,
  };
}

/**
 * $1,000 from the jackpot for each perfect round. If the jackpot can't cover everyone,
 * what's left is split equally. Returns the amount per person.
 */
export function perfectRoundBonus(
  jackpotBalanceCents: Cents,
  perfectCount: number,
  bonusCents: Cents = PERFECT_ROUND_BONUS_CENTS,
): Cents {
  if (perfectCount === 0) return 0;
  return Math.min(bonusCents, Math.floor(Math.max(0, jackpotBalanceCents) / perfectCount));
}
