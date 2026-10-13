import "server-only";
import { cache } from "react";
import {
  F1_PICK_POSITIONS,
  f1PickStats,
  matchPickStats,
  orderByPosition,
  roundHistory,
  standingSummary,
  summarizeHistory,
  type Cents,
  type F1PickStats,
  type HistorySummary,
  type MatchPickStats,
  type MatchResult,
  type RoundLine,
  type RoundMoney,
  type Sport,
  type StandingSummary,
} from "@/domain";
import { playerName } from "./format";
import { getPoolOverview, type PoolOverview, type SeasonRow } from "./pools";
import { getOpenPeriod, type PeriodStatement } from "./settlement";
import { createClient } from "./supabase/server";

export interface StatsPlayer {
  id: string;
  name: string;
}

export const getStatsPlayer = cache(async (playerId: string): Promise<StatsPlayer | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("players")
    .select("id, display_name, nickname")
    .eq("id", playerId)
    .maybeSingle();
  return data ? { id: data.id, name: playerName(data) } : null;
});

/** Everyone enrolled in a pool the viewer can see, by name: whose statistics can be opened. */
export const getStatsPlayers = cache(async (): Promise<StatsPlayer[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("player:players(id, display_name, nickname), pool:pools(status)");
  const names = new Map<string, string>();
  for (const e of data ?? []) {
    if (e.player && e.pool && e.pool.status !== "upcoming") names.set(e.player.id, playerName(e.player));
  }
  return [...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
});

export interface StatsRound extends RoundLine {
  name: string;
  /** Position among the round's players. */
  position: number;
}

export interface NextMeeting {
  cutoffAt: Date;
  rounds: number;
  /** Positive: collects at the meeting. Negative: pays. */
  netCents: Cents;
}

export interface PoolStats {
  id: string;
  name: string;
  sport: Sport;
  standing: StandingSummary;
  wonCents: Cents;
  paidCents: Cents;
  netCents: Cents;
  jackpotPrize: SeasonRow["jackpotPrize"];
  rounds: StatsRound[];
  summary: HistorySummary;
  /** Each round's own net with the meeting that settles it, in round order. */
  money: RoundMoney[];
  /** The player's line in the pool's open settlement period, if it has rounds to pay. */
  nextMeeting: NextMeeting | null;
}

/** The entry fee and the settlement period of each round: what the pool overview doesn't carry. */
export interface PoolMoney {
  entry_fee_cents: Cents;
  rounds: { id: string; period: { cutoff_at: string; settled_at: string | null } | null }[];
}

/**
 * One player's season in one pool, read with the viewer's session. Built on the same
 * numbers as the standings and the monthly settlement, so the totals always agree.
 * Null if the player isn't enrolled.
 */
export const getPoolStats = cache(async (playerId: string, poolId: string): Promise<PoolStats | null> => {
  const supabase = await createClient();
  const [pool, period, { data: money }] = await Promise.all([
    getPoolOverview(poolId),
    getOpenPeriod(poolId),
    supabase
      .from("pools")
      .select("entry_fee_cents, rounds(id, period:settlement_periods(cutoff_at, settled_at))")
      .eq("id", poolId)
      .maybeSingle(),
  ]);
  return money ? buildPoolStats(playerId, pool, money, period) : null;
});

export function buildPoolStats(
  playerId: string,
  pool: PoolOverview,
  money: PoolMoney,
  period: PeriodStatement | null,
): PoolStats | null {
  const row = pool.season.find((r) => r.playerId === playerId);
  const standing = standingSummary(
    pool.season.map((r) => ({ profileId: r.playerId, points: r.points })),
    playerId,
  );
  if (!row || !standing) return null;

  // Everyone enrolled pays and is ranked every round, with or without a result row.
  const enrolled = pool.season.map((r) => r.playerId);
  const history = roundHistory(
    pool.rounds.map((round) => ({
      id: round.id,
      entryFeeCents: money.entry_fee_cents,
      scores: enrolled.map((id) => {
        const result = round.results.find((r) => r.playerId === id);
        return {
          profileId: id,
          points: result?.points ?? 0,
          prizeCents: result?.prizeCents ?? 0,
          bonusCents: result?.bonusCents ?? 0,
        };
      }),
    })),
    playerId,
  );

  const roundOf = new Map(pool.rounds.map((r) => [r.id, r]));
  const rounds = history.map((line) => {
    const round = roundOf.get(line.roundId)!;
    return {
      ...line,
      name: round.name,
      position: round.results.find((r) => r.playerId === playerId)?.position ?? line.participants,
    };
  });
  const periodOf = new Map(money.rounds.map((r) => [r.id, r.period]));
  const ownLine = period?.lines.find((l) => l.profileId === playerId);

  return {
    id: pool.id,
    name: pool.name,
    sport: pool.sport,
    standing,
    wonCents: row.wonCents,
    paidCents: row.paidCents,
    netCents: row.netCents,
    jackpotPrize: row.jackpotPrize,
    rounds,
    summary: summarizeHistory(history),
    money: history.map((line) => {
      const settlement = periodOf.get(line.roundId);
      return {
        cutoffAt: settlement ? new Date(settlement.cutoff_at) : null,
        settled: settlement?.settled_at != null,
        netCents: line.wonCents - line.feeCents,
      };
    }),
    nextMeeting:
      period && ownLine ? { cutoffAt: period.cutoffAt, rounds: ownLine.rounds, netCents: ownLine.netCents } : null,
  };
}

const SPORT_ORDER: Sport[] = ["liga_mx", "nfl", "f1"];

/** The player's pools that the viewer can see, except the ones still being set up. */
export const getPlayerPools = cache(async (playerId: string): Promise<PoolStats[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("pool:pools(id, status)")
    .eq("player_id", playerId);
  const poolIds = (data ?? []).flatMap((e) => (e.pool && e.pool.status !== "upcoming" ? [e.pool.id] : []));
  const pools = await Promise.all(poolIds.map((id) => getPoolStats(playerId, id)));
  return pools
    .filter((p) => p !== null)
    .sort((a, b) => SPORT_ORDER.indexOf(a.sport) - SPORT_ORDER.indexOf(b.sport) || a.name.localeCompare(b.name));
});

export type PickStats =
  | { sport: "liga_mx" | "nfl"; stats: MatchPickStats }
  | { sport: "f1"; stats: F1PickStats };

export type PoolPickStats = PickStats & {
  /** Names of the completed rounds that have picks stored for this player, in order. */
  covered: string[];
};

/**
 * How the player's picks did in the pool's completed rounds. Rounds imported from before
 * the app have points but no picks, so only some rounds are covered. Row level security
 * decides which picks the viewer may read; completed rounds are always locked.
 */
export const getPickStats = cache(async (playerId: string, poolId: string): Promise<PoolPickStats> => {
  const supabase = await createClient();
  const pool = await getPoolOverview(poolId);
  const roundIds = pool.rounds.map((r) => r.id);
  const withPicks = new Set<string>();
  const covered = () => pool.rounds.filter((r) => withPicks.has(r.id)).map((r) => r.name);

  if (pool.sport !== "f1") {
    const { data: picks } = roundIds.length
      ? await supabase
          .from("match_picks")
          .select("selection, event:events!inner(result, round_id)")
          .eq("player_id", playerId)
          .in("event.round_id", roundIds)
      : { data: [] };
    for (const p of picks ?? []) withPicks.add(p.event.round_id);
    const stats = matchPickStats(
      pool.sport,
      (picks ?? []).map((p) => ({ selection: p.selection, result: p.event.result as MatchResult | null })),
    );
    return { sport: pool.sport, stats, covered: covered() };
  }

  const { data: picks } = roundIds.length
    ? await supabase
        .from("f1_picks")
        // Named relationship: picks also point at the round they were repeated from.
        .select("position, driver_id, event:events!f1_picks_event_id_fkey!inner(id, round_id)")
        .eq("player_id", playerId)
        .in("event.round_id", roundIds)
    : { data: [] };
  const eventIds = [...new Set((picks ?? []).map((p) => p.event.id))];
  const { data: classification } = eventIds.length
    ? await supabase
        .from("f1_classification")
        .select("event_id, position, driver_id")
        .in("event_id", eventIds)
        .lte("position", F1_PICK_POSITIONS)
    : { data: [] };

  const order = (rows: { position: number; driver_id: string }[]) =>
    orderByPosition(rows.map((r) => ({ position: r.position, driverId: r.driver_id })));
  const races = eventIds.flatMap((eventId) => {
    const official = (classification ?? []).filter((c) => c.event_id === eventId);
    if (official.length === 0) return [];
    const own = (picks ?? []).filter((p) => p.event.id === eventId);
    withPicks.add(own[0].event.round_id);
    return [{ pick: order(own), classification: order(official) }];
  });
  return { sport: "f1", stats: f1PickStats(races), covered: covered() };
});
