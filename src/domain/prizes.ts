/**
 * Round payouts and season jackpot. See docs/RULES.md §4–5.
 */
import { rankEntries, type StandingEntry } from "./standings";
import { ENTRY_FEE_CENTS, type Cents, type ProfileId } from "./types";

export type PrizeKind = "winner" | "lucky_seven" | "bobby";

interface PrizeRule {
  kind: PrizeKind;
  percent: number;
  position: (participants: number) => number;
}

export const PRIZE_RULES: readonly PrizeRule[] = [
  { kind: "winner", percent: 50, position: () => 1 },
  { kind: "lucky_seven", percent: 35, position: () => 7 },
  { kind: "bobby", percent: 15, position: (n) => n - 1 },
];

export const JACKPOT_PERCENT = 30;

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

  for (const rule of PRIZE_RULES) {
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

export interface RoundSettlement extends Distribution {
  potCents: Cents;
  payoutCents: Cents;
  /** 30 % of the pot plus anything left undistributed. */
  jackpotCents: Cents;
}

/** Every enrolled participant is in `entries`, including those who made no picks (0 points). */
export function settleRound(
  entries: readonly StandingEntry[],
  entryFeeCents: Cents = ENTRY_FEE_CENTS,
): RoundSettlement {
  const potCents = entries.length * entryFeeCents;
  const baseJackpot = Math.floor((potCents * JACKPOT_PERCENT) / 100);
  const payoutCents = potCents - baseJackpot;
  const distribution = distributePrizes(payoutCents, entries);

  return {
    ...distribution,
    potCents,
    payoutCents,
    jackpotCents: baseJackpot + distribution.undistributedCents,
  };
}
