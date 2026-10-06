/**
 * Personal statistics. Read-only views over rounds that were already scored and paid
 * under docs/RULES.md: nothing here decides points or money.
 */
import { JACKPOT_PRIZE_RULES, type PrizeKind } from "./prizes";
import { F1_PICK_POSITIONS, type F1Pick, type MatchOutcome, type MatchResult } from "./scoring";
import { rankEntries, type StandingEntry } from "./standings";
import { localDateOf } from "./time";
import type { Cents, ProfileId, Sport } from "./types";

export interface Gap {
  position: number;
  /** Points of whoever holds that position today. */
  points: number;
  /** The player's points minus those: negative means behind. */
  diff: number;
}

/** Distance to a position that takes part of the jackpot: 1st, 7th or second-to-last. */
export interface PrizeGap extends Gap {
  kind: PrizeKind;
}

export interface StandingSummary {
  /** First position of the player's range: tied players share it. */
  position: number;
  tied: boolean;
  participants: number;
  points: number;
  gaps: PrizeGap[];
  /** When the player leads alone: the group right behind them. */
  chaser: Gap | null;
}

/** Where a player stands in the season and how far the jackpot positions are. */
export function standingSummary(entries: readonly StandingEntry[], profileId: ProfileId): StandingSummary | null {
  const groups = rankEntries(entries);
  const index = groups.findIndex((g) => g.profileIds.includes(profileId));
  if (index < 0) return null;
  const own = groups[index];
  const gapTo = (position: number, points: number): Gap => ({ position, points, diff: own.points - points });

  const gaps = JACKPOT_PRIZE_RULES.flatMap((rule) => {
    const position = rule.position(entries.length);
    const holder = groups.find((g) => g.from <= position && position <= g.to);
    return holder ? [{ kind: rule.kind, ...gapTo(position, holder.points) }] : [];
  });

  const next = groups[index + 1];
  const leadsAlone = own.from === 1 && own.profileIds.length === 1;
  return {
    position: own.from,
    tied: own.profileIds.length > 1,
    participants: entries.length,
    points: own.points,
    gaps,
    chaser: leadsAlone && next ? gapTo(next.from, next.points) : null,
  };
}

export interface RoundScore {
  profileId: ProfileId;
  points: number;
  /** Weekly prize. */
  prizeCents: Cents;
  /** Perfect-round bonus. */
  bonusCents: Cents;
}

export interface SeasonRound {
  id: string;
  entryFeeCents: Cents;
  /** Everyone enrolled, with 0 points if they made no picks. */
  scores: readonly RoundScore[];
}

export interface RoundLine {
  roundId: string;
  points: number;
  /** Everyone's points and how many played: the group's average, without rounding. */
  groupPoints: number;
  participants: number;
  /** The most points anyone scored in the round. */
  bestPoints: number;
  /** Took the weekly prize, and whether it was split with someone. */
  won: boolean;
  shared: boolean;
  wonCents: Cents;
  feeCents: Cents;
  /** Won minus entry fees, from the first round up to this one. */
  netCents: Cents;
  /** Position in the season standings after this round (first of the tied range). */
  standing: number;
}

/**
 * A player's season round by round, in the order given. Rounds the player isn't part
 * of are left out, like in the monthly statement.
 */
export function roundHistory(rounds: readonly SeasonRound[], profileId: ProfileId): RoundLine[] {
  const totals = new Map<ProfileId, number>();
  for (const round of rounds) for (const score of round.scores) totals.set(score.profileId, 0);

  const lines: RoundLine[] = [];
  let netCents = 0;
  for (const round of rounds) {
    for (const score of round.scores) totals.set(score.profileId, totals.get(score.profileId)! + score.points);
    const own = round.scores.find((s) => s.profileId === profileId);
    if (!own) continue;

    const entries = [...totals].map(([id, points]) => ({ profileId: id, points }));
    const wonCents = own.prizeCents + own.bonusCents;
    netCents += wonCents - round.entryFeeCents;
    lines.push({
      roundId: round.id,
      points: own.points,
      groupPoints: round.scores.reduce((acc, s) => acc + s.points, 0),
      participants: round.scores.length,
      bestPoints: Math.max(...round.scores.map((s) => s.points)),
      won: own.prizeCents > 0,
      shared: own.prizeCents > 0 && round.scores.filter((s) => s.prizeCents > 0).length > 1,
      wonCents,
      feeCents: round.entryFeeCents,
      netCents,
      standing: rankEntries(entries).find((g) => g.profileIds.includes(profileId))!.from,
    });
  }
  return lines;
}

/** A round at or above the group's average counts towards the streak. */
function atOrAboveAverage(line: RoundLine): boolean {
  return line.points * line.participants >= line.groupPoints;
}

export interface HistorySummary {
  rounds: number;
  points: number;
  /** Points per round, for display. */
  average: number;
  groupAverage: number;
  /** Rounds where the player took the weekly prize; `sharedWins` of them were split. */
  wins: number;
  sharedWins: number;
  best: { points: number; roundIds: string[] } | null;
  worst: { points: number; roundIds: string[] } | null;
  /** Most rounds in a row at or above the group's average. */
  longestStreak: { length: number; fromRoundId: string; toRoundId: string } | null;
  /** The same streak counted back from the last round; 0 if it was below average. */
  currentStreak: number;
}

export function summarizeHistory(lines: readonly RoundLine[]): HistorySummary {
  const points = lines.reduce((acc, l) => acc + l.points, 0);
  const groupPoints = lines.reduce((acc, l) => acc + l.groupPoints, 0);
  const scores = lines.reduce((acc, l) => acc + l.participants, 0);
  const extreme = (pick: (...values: number[]) => number) => {
    if (lines.length === 0) return null;
    const value = pick(...lines.map((l) => l.points));
    return { points: value, roundIds: lines.filter((l) => l.points === value).map((l) => l.roundId) };
  };

  let longestStreak: HistorySummary["longestStreak"] = null;
  let currentStreak = 0;
  for (let i = 0; i < lines.length; i++) {
    currentStreak = atOrAboveAverage(lines[i]) ? currentStreak + 1 : 0;
    if (currentStreak > (longestStreak?.length ?? 0)) {
      longestStreak = {
        length: currentStreak,
        fromRoundId: lines[i - currentStreak + 1].roundId,
        toRoundId: lines[i].roundId,
      };
    }
  }

  return {
    rounds: lines.length,
    points,
    average: lines.length > 0 ? points / lines.length : 0,
    groupAverage: scores > 0 ? groupPoints / scores : 0,
    wins: lines.filter((l) => l.won).length,
    sharedWins: lines.filter((l) => l.shared).length,
    best: extreme(Math.max),
    worst: extreme(Math.min),
    longestStreak,
    currentStreak,
  };
}

export interface RoundMoney {
  /** Cutoff of the meeting that settles the round; null if it has none yet. */
  cutoffAt: Date | null;
  settled: boolean;
  /** Won minus the entry fee, for this round alone. */
  netCents: Cents;
}

export interface MeetingNet {
  cutoffAt: Date | null;
  /** Every round of the meeting has been paid. */
  settled: boolean;
  rounds: number;
  netCents: Cents;
  /** Net from the first meeting up to this one. */
  cumulativeCents: Cents;
}

/**
 * Net per monthly meeting, across every pool: money changes hands there, not per round
 * (docs/RULES.md §6). Pools keep their own periods, so rounds are grouped by the day of
 * their cutoff. Rounds without a period come last.
 */
export function netByMeeting(rounds: readonly RoundMoney[]): MeetingNet[] {
  const meetings = new Map<string, Omit<MeetingNet, "cumulativeCents">>();
  for (const round of rounds) {
    const day = round.cutoffAt ? localDateOf(round.cutoffAt) : null;
    const key = day ? `${day.year}-${day.month}-${day.day}` : "";
    const meeting = meetings.get(key);
    if (!meeting) {
      meetings.set(key, { cutoffAt: round.cutoffAt, settled: round.settled, rounds: 1, netCents: round.netCents });
      continue;
    }
    meeting.settled &&= round.settled;
    meeting.rounds++;
    meeting.netCents += round.netCents;
  }

  let cumulativeCents = 0;
  return [...meetings.values()]
    .sort((a, b) => (a.cutoffAt?.getTime() ?? Infinity) - (b.cutoffAt?.getTime() ?? Infinity))
    .map((meeting) => ({ ...meeting, cumulativeCents: (cumulativeCents += meeting.netCents) }));
}

export interface Tally {
  hits: number;
  total: number;
}

const emptyTally = (): Tally => ({ hits: 0, total: 0 });

export interface MatchPickResult {
  selection: MatchOutcome;
  /** null while the match hasn't finished. */
  result: MatchResult | null;
}

export interface MatchPickStats {
  overall: Tally;
  bySelection: Record<MatchOutcome, Tally>;
}

/**
 * How often a player's Liga MX / NFL picks were right, overall and by what they picked.
 * Only picks that were made count, on matches that could be scored: postponed matches
 * and NFL ties are left out, like in a perfect round.
 */
export function matchPickStats(sport: Sport, picks: readonly MatchPickResult[]): MatchPickStats {
  const stats: MatchPickStats = {
    overall: emptyTally(),
    bySelection: { home: emptyTally(), draw: emptyTally(), away: emptyTally() },
  };
  for (const pick of picks) {
    if (pick.result === null || pick.result === "void") continue;
    if (sport === "nfl" && pick.result === "draw") continue;
    const hit = pick.selection === pick.result ? 1 : 0;
    for (const tally of [stats.overall, stats.bySelection[pick.selection]]) {
      tally.hits += hit;
      tally.total++;
    }
  }
  return stats;
}

export interface F1RacePick {
  pick: F1Pick;
  /** Official order of driver ids, index 0 is P1; null where it isn't known. */
  classification: readonly (string | null)[];
}

export interface F1PickStats {
  overall: Tally;
  /** Index 0 is P1. */
  byPosition: Tally[];
}

/** How often a player put the right driver in each position, P1–P10. Empty positions don't count. */
export function f1PickStats(races: readonly F1RacePick[]): F1PickStats {
  const byPosition = Array.from({ length: F1_PICK_POSITIONS }, emptyTally);
  for (const race of races) {
    for (let i = 0; i < F1_PICK_POSITIONS; i++) {
      const driver = race.pick[i];
      const official = race.classification[i];
      if (driver == null || official == null) continue;
      byPosition[i].total++;
      if (driver === official) byPosition[i].hits++;
    }
  }
  return {
    overall: {
      hits: byPosition.reduce((acc, t) => acc + t.hits, 0),
      total: byPosition.reduce((acc, t) => acc + t.total, 0),
    },
    byPosition,
  };
}
