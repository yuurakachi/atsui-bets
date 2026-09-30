import "server-only";
import { cache } from "react";
import {
  F1_PICK_POSITIONS,
  ligaMxRoundLock,
  nextDefaultCutoff,
  nflGameLock,
  orderByPosition,
  perfectRoundBonus,
  rankEntries,
  roundFinishedAt,
  scoreF1Pick,
  scoreMatchPicks,
  settleRound,
  type MatchOutcome,
  type MatchResult,
  type Sport,
} from "@/domain";
import { playerName } from "./format";
import { createClient } from "./supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface NewEvent {
  externalId: string;
  home: string;
  away: string;
  startsAt: Date;
}

/** Lock time per event, following docs/RULES.md §3. */
export function lockTimes(sport: Sport, events: readonly NewEvent[]): Date[] {
  const firstKickoff = new Date(Math.min(...events.map((e) => e.startsAt.getTime())));
  return events.map((e) => (sport === "liga_mx" ? ligaMxRoundLock(firstKickoff) : nflGameLock(e.startsAt)));
}

export interface RoundDetail {
  id: string;
  poolId: string;
  sport: Sport;
  name: string;
  status: "scheduled" | "completed" | "cancelled";
  events: {
    id: string;
    home: string;
    away: string;
    startsAt: Date;
    lockAt: Date;
    result: MatchResult | null;
  }[];
  players: { id: string; name: string }[];
  /** Picks this player is allowed to see: their own, everyone's after the lock, all for pool admins. */
  picks: { eventId: string; playerId: string; selection: MatchOutcome }[];
}

export const getRoundDetail = cache(async (poolId: string, roundId: string): Promise<RoundDetail | null> => {
  const supabase = await createClient();
  const { data: round } = await supabase
    .from("rounds")
    .select("id, pool_id, name, status, pool:pools(sport)")
    .eq("id", roundId)
    .eq("pool_id", poolId)
    .maybeSingle();
  if (!round?.pool) return null;

  const [{ data: events }, { data: enrollments }] = await Promise.all([
    supabase
      .from("events")
      .select("id, home_team, away_team, starts_at, lock_at, result")
      .eq("round_id", roundId)
      .order("starts_at"),
    supabase.from("enrollments").select("player:players(id, display_name, nickname)").eq("pool_id", poolId),
  ]);
  const { data: picks } = await supabase
    .from("match_picks")
    .select("event_id, player_id, selection")
    .in("event_id", (events ?? []).map((e) => e.id));

  return {
    id: round.id,
    poolId: round.pool_id,
    sport: round.pool.sport,
    name: round.name,
    status: round.status,
    events: (events ?? []).map((e) => ({
      id: e.id,
      home: e.home_team ?? "?",
      away: e.away_team ?? "?",
      startsAt: new Date(e.starts_at),
      lockAt: new Date(e.lock_at),
      result: (e.result as MatchResult | null) ?? null,
    })),
    players: (enrollments ?? [])
      .flatMap((e) => (e.player ? [{ id: e.player.id, name: playerName(e.player) }] : []))
      .sort((a, b) => a.name.localeCompare(b.name)),
    picks: (picks ?? []).map((p) => ({ eventId: p.event_id, playerId: p.player_id, selection: p.selection })),
  };
});

export interface UpcomingRound {
  id: string;
  poolId: string;
  sport: Sport;
  name: string;
  firstLockAt: Date;
  /** Every event has locked. */
  closed: boolean;
  /** Picks to make: one per match, or ten positions per F1 race. */
  events: number;
  /** Picks still open that the player hasn't made. */
  missing: number;
}

/** Rounds more than this far after a pool's next deadline aren't shown yet (F1 loads the whole season). */
const UPCOMING_WINDOW_MS = 4 * 24 * 60 * 60 * 1000;

/**
 * Scheduled rounds of the given pools, with how many open picks the player is missing:
 * rounds waiting for results, and those of each pool's next deadline.
 */
export const getUpcomingRounds = cache(async (poolIds: string[], playerId: string): Promise<UpcomingRound[]> => {
  if (poolIds.length === 0) return [];
  const supabase = await createClient();
  const { data: rounds } = await supabase
    .from("rounds")
    .select("id, pool_id, name, ordinal, pool:pools(sport), events(id, lock_at)")
    .in("pool_id", poolIds)
    .eq("status", "scheduled")
    .order("ordinal");

  const eventIds = (rounds ?? []).flatMap((r) => r.events.map((e) => e.id));
  const [{ data: matchPicks }, { data: f1Picks }] = eventIds.length
    ? await Promise.all([
        supabase.from("match_picks").select("event_id").eq("player_id", playerId).in("event_id", eventIds),
        supabase.from("f1_picks").select("event_id").eq("player_id", playerId).in("event_id", eventIds),
      ])
    : [{ data: [] }, { data: [] }];
  const picked = new Map<string, number>();
  for (const p of [...(matchPicks ?? []), ...(f1Picks ?? [])]) picked.set(p.event_id, (picked.get(p.event_id) ?? 0) + 1);
  const now = Date.now();

  const upcoming = (rounds ?? [])
    .filter((r) => r.events.length > 0 && r.pool)
    .map((r) => {
      const sport = r.pool!.sport;
      const perEvent = sport === "f1" ? F1_PICK_POSITIONS : 1;
      const open = r.events.filter((e) => new Date(e.lock_at).getTime() > now);
      return {
        id: r.id,
        poolId: r.pool_id,
        sport,
        name: r.name,
        firstLockAt: new Date(Math.min(...r.events.map((e) => new Date(e.lock_at).getTime()))),
        closed: open.length === 0,
        events: r.events.length * perEvent,
        missing: open.reduce((acc, e) => acc + perEvent - Math.min(perEvent, picked.get(e.id) ?? 0), 0),
      };
    });

  const nextDeadline = new Map<string, number>();
  for (const r of upcoming) {
    if (r.closed) continue;
    const lock = r.firstLockAt.getTime();
    nextDeadline.set(r.poolId, Math.min(lock, nextDeadline.get(r.poolId) ?? lock));
  }
  return upcoming.filter((r) => r.closed || r.firstLockAt.getTime() <= nextDeadline.get(r.poolId)! + UPCOMING_WINDOW_MS);
});

/**
 * Scores a round once every event has a result: points, weekly prize, jackpot share,
 * perfect-round bonus and settlement period. Runs with the caller's session, so only
 * the pool's admins can do it (row level security). Returns false if results are missing.
 * Re-scoring (e.g. an F1 disqualification) keeps the round's settlement period, and is
 * refused once that period's money has been settled.
 */
export async function scoreRound(supabase: Supabase, roundId: string): Promise<boolean> {
  const { data: round } = await supabase
    .from("rounds")
    .select(
      "id, pool_id, settlement_period_id, pool:pools(sport, entry_fee_cents, jackpot_opening_cents), period:settlement_periods(settled_at)",
    )
    .eq("id", roundId)
    .single();
  if (!round?.pool) throw new Error("Jornada no encontrada.");
  if (round.period?.settled_at) throw new Error("Esta jornada ya se liquidó en un corte; no se puede recalificar.");

  const { data: events } = await supabase
    .from("events")
    .select("id, starts_at, result")
    .eq("round_id", roundId);
  if (!events?.length) return false;

  const [{ data: enrollments }, { data: previousRounds }] = await Promise.all([
    supabase.from("enrollments").select("player_id").eq("pool_id", round.pool_id),
    supabase
      .from("rounds")
      .select("id, jackpot_cents")
      .eq("pool_id", round.pool_id)
      .eq("status", "completed")
      .neq("id", roundId),
  ]);
  const playerIds = (enrollments ?? []).map((e) => e.player_id);

  const scoring =
    round.pool.sport === "f1"
      ? await f1Points(supabase, events.map((e) => e.id), playerIds)
      : await matchPoints(supabase, events, playerIds);
  if (!scoring) return false;

  // Jackpot balance before this round, to pay a perfect-round bonus.
  const { data: previousBonuses } = await supabase
    .from("round_results")
    .select("bonus_cents")
    .in("round_id", (previousRounds ?? []).map((r) => r.id));
  const jackpotBalance =
    round.pool.jackpot_opening_cents +
    (previousRounds ?? []).reduce((acc, r) => acc + (r.jackpot_cents ?? 0), 0) -
    (previousBonuses ?? []).reduce((acc, r) => acc + r.bonus_cents, 0);

  const entries = playerIds.map((id) => ({ profileId: id, points: scoring.points.get(id) ?? 0 }));
  const settlement = settleRound(entries, {
    entryFeeCents: round.pool.entry_fee_cents,
    maxPoints: scoring.maxPoints,
  });
  const bonus = perfectRoundBonus(jackpotBalance, settlement.perfectIds.length);
  const positions = new Map<string, number>();
  for (const group of rankEntries(entries)) for (const id of group.profileIds) positions.set(id, group.from);

  const periodId =
    round.settlement_period_id ??
    (await settlementPeriodFor(
      supabase,
      round.pool_id,
      roundFinishedAt(round.pool.sport, events.map((e) => new Date(e.starts_at))),
    ));

  const { error: deleteError } = await supabase.from("round_results").delete().eq("round_id", roundId);
  if (deleteError) throw new Error(deleteError.message);
  const { error: insertError } = await supabase.from("round_results").insert(
    entries.map((e) => ({
      round_id: roundId,
      player_id: e.profileId,
      points: e.points,
      position: positions.get(e.profileId)!,
      prize_cents: settlement.wonCents.get(e.profileId) ?? 0,
      bonus_cents: settlement.perfectIds.includes(e.profileId) ? bonus : 0,
    })),
  );
  if (insertError) throw new Error(insertError.message);

  const { error: roundError } = await supabase
    .from("rounds")
    .update({
      status: "completed",
      pot_cents: settlement.potCents,
      jackpot_cents: settlement.jackpotCents,
      settlement_period_id: periodId,
    })
    .eq("id", roundId);
  if (roundError) throw new Error(roundError.message);
  return true;
}

interface RoundPoints {
  points: Map<string, number>;
  /** Points of a perfect round. */
  maxPoints: number;
}

/** Liga MX / NFL: null until every match has a result. */
async function matchPoints(
  supabase: Supabase,
  events: { id: string; result: string | null }[],
  playerIds: string[],
): Promise<RoundPoints | null> {
  if (events.some((e) => e.result === null)) return null;
  const { data: picks } = await supabase
    .from("match_picks")
    .select("event_id, player_id, selection")
    .in("event_id", events.map((e) => e.id));

  const scored = events.map((e) => ({ id: e.id, result: e.result as MatchResult }));
  const points = new Map(
    playerIds.map((id) => {
      const mine = Object.fromEntries(
        (picks ?? []).filter((p) => p.player_id === id).map((p) => [p.event_id, p.selection]),
      );
      return [id, scoreMatchPicks(scored, mine)];
    }),
  );
  return { points, maxPoints: scored.filter((e) => e.result !== "void").length };
}

/** F1: null until every race of the round has an official classification down to P10. */
async function f1Points(supabase: Supabase, eventIds: string[], playerIds: string[]): Promise<RoundPoints | null> {
  const [{ data: classification }, { data: picks }] = await Promise.all([
    supabase.from("f1_classification").select("event_id, position, driver_id").in("event_id", eventIds),
    supabase.from("f1_picks").select("event_id, player_id, position, driver_id").in("event_id", eventIds),
  ]);

  const order = (rows: { position: number; driver_id: string }[]) =>
    orderByPosition(rows.map((r) => ({ position: r.position, driverId: r.driver_id })));

  const points = new Map(playerIds.map((id) => [id, 0]));
  for (const eventId of eventIds) {
    const official = order((classification ?? []).filter((c) => c.event_id === eventId));
    if (official.some((d) => d === null)) return null;
    for (const id of playerIds) {
      const pick = order((picks ?? []).filter((p) => p.event_id === eventId && p.player_id === id));
      points.set(id, points.get(id)! + scoreF1Pick(pick, official as string[]));
    }
  }
  return { points, maxPoints: F1_PICK_POSITIONS * eventIds.length };
}

/** The pool's first open settlement period after the round finished, created if needed. */
async function settlementPeriodFor(supabase: Supabase, poolId: string, finishedAt: Date): Promise<string> {
  const { data: existing } = await supabase
    .from("settlement_periods")
    .select("id")
    .eq("pool_id", poolId)
    .gt("cutoff_at", finishedAt.toISOString())
    .is("settled_at", null)
    .order("cutoff_at")
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("settlement_periods")
    .insert({ pool_id: poolId, cutoff_at: nextDefaultCutoff(finishedAt).toISOString() })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id;
}
