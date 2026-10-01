import "server-only";
import { cache } from "react";
import {
  F1_PICK_POSITIONS,
  f1SeasonRounds,
  matchF1Rounds,
  orderByPosition,
  type F1RoundKind,
  type F1RoundPlan,
} from "@/domain";
import { playerName } from "./format";
import { f1ExternalId, type F1DriverInfo, type F1SeasonData } from "./jolpica";
import { scoreRound } from "./rounds";
import { createClient } from "./supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Positions stored for the official classification (only P1–P10 are scored). */
const CLASSIFICATION_POSITIONS = 20;

export interface F1Driver {
  id: string;
  code: string;
  name: string;
  team: string | null;
  active: boolean;
}

export const getF1Drivers = cache(async (season: string): Promise<F1Driver[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("f1_drivers")
    .select("id, code, name, team, active")
    .eq("season", season)
    .order("team")
    .order("name");
  return data ?? [];
});

export interface SeasonImport {
  created: number;
  updated: number;
  /** Races that already happened and aren't in the app: they come from the season import. */
  skipped: number;
  drivers: number;
  /** Open rounds whose race is no longer in the calendar: cancelled, for the admin to remove. */
  missing: string[];
  /** New races that couldn't be created because another race holds their place in the calendar. */
  blocked: string[];
}

/**
 * Loads a season from Jolpica data: upserts its drivers and creates the rounds that are
 * still open for picks (a Sprint weekend makes two). Existing rounds keep their picks;
 * open ones get their times refreshed. Past races are never created here, so nobody
 * gets a round with zero picks by accident. Nothing is ever removed: a race that left
 * the calendar is reported, and an admin removes it.
 */
export async function importF1Season(supabase: Supabase, poolId: string, data: F1SeasonData): Promise<SeasonImport> {
  const { data: pool } = await supabase.from("pools").select("sport, season").eq("id", poolId).single();
  if (pool?.sport !== "f1") throw new Error("Esta quiniela no es de F1.");
  if (pool.season !== data.season) throw new Error(`La quiniela es de la temporada ${pool.season}.`);

  const { error: driversError } = await supabase.from("f1_drivers").upsert(
    data.drivers.map((d) => ({ season: data.season, code: d.code, name: d.name, team: d.team, active: d.active })),
    { onConflict: "season,code" },
  );
  if (driversError) throw new Error(driversError.message);

  const { data: existing } = await supabase
    .from("rounds")
    .select("id, kind, ordinal, status, name, events(id, external_id, starts_at, lock_at)")
    .eq("pool_id", poolId);
  const now = Date.now();
  const { matches, orphans } = matchF1Rounds(f1SeasonRounds(data.races), existing ?? []);
  const result: SeasonImport = {
    created: 0,
    updated: 0,
    skipped: 0,
    drivers: data.drivers.filter((d) => d.active).length,
    missing: orphans.filter((r) => r.status === "scheduled").map((r) => r.name),
    blocked: [],
  };

  const eventRow = (roundId: string, plan: F1RoundPlan) => ({
    round_id: roundId,
    external_id: f1ExternalId(data.season, plan.raceRound, plan.kind),
    name: plan.name,
    starts_at: plan.startsAt.toISOString(),
    lock_at: plan.lockAt.toISOString(),
  });

  const toCreate: F1RoundPlan[] = [];
  for (const { plan, round, blocked } of matches) {
    if (!round) {
      if (plan.lockAt.getTime() <= now) result.skipped++;
      else if (blocked) result.blocked.push(plan.name);
      else toCreate.push(plan);
      continue;
    }
    const event = round.events[0];
    const row = eventRow(round.id, plan);
    if (!event) {
      // A round imported from before the app: attach its race so it shows dates.
      const { error } = await supabase.from("events").insert(row);
      if (error) throw new Error(error.message);
      result.updated++;
      continue;
    }
    // A removed race keeps its name: if another race now sits in its place, it isn't this round.
    if (round.status === "cancelled" && round.name !== plan.name) {
      if (plan.lockAt.getTime() > now) result.blocked.push(plan.name);
      continue;
    }
    // The calendar was renumbered: results are fetched by race number, so follow it.
    const renumbered = event.external_id !== row.external_id;
    const open = round.status === "scheduled" && new Date(event.lock_at).getTime() > now;
    const rescheduled =
      open &&
      (new Date(event.starts_at).getTime() !== plan.startsAt.getTime() ||
        new Date(event.lock_at).getTime() !== plan.lockAt.getTime() ||
        round.name !== plan.name);
    if (!renumbered && !rescheduled) continue;
    const { error } = await supabase
      .from("events")
      .update({
        external_id: row.external_id,
        ...(rescheduled && { starts_at: row.starts_at, lock_at: row.lock_at, name: row.name }),
      })
      .eq("id", event.id);
    if (error) throw new Error(error.message);
    if (rescheduled) await supabase.from("rounds").update({ name: plan.name }).eq("id", round.id);
    result.updated++;
  }

  if (toCreate.length > 0) {
    const { data: created, error } = await supabase
      .from("rounds")
      .insert(toCreate.map((p) => ({ pool_id: poolId, name: p.name, kind: p.kind, ordinal: p.ordinal })))
      .select("id, kind, ordinal");
    if (error) throw new Error(error.message);
    const planOf = new Map(toCreate.map((p) => [`${p.kind}:${p.ordinal}`, p]));
    const { error: eventsError } = await supabase
      .from("events")
      .insert(created.map((r) => eventRow(r.id, planOf.get(`${r.kind}:${r.ordinal}`)!)));
    if (eventsError) {
      await supabase.from("rounds").delete().in("id", created.map((r) => r.id));
      throw new Error(eventsError.message);
    }
    result.created = created.length;
  }
  return result;
}

/** Ids of the given drivers, adding the ones the season doesn't have yet (stand-ins) as inactive. */
export async function f1DriverIds(supabase: Supabase, season: string, drivers: F1DriverInfo[]): Promise<string[]> {
  const { error } = await supabase.from("f1_drivers").upsert(
    drivers.map((d) => ({ season, code: d.code, name: d.name, team: d.team, active: false })),
    { onConflict: "season,code", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
  const { data } = await supabase
    .from("f1_drivers")
    .select("id, code")
    .eq("season", season)
    .in("code", drivers.map((d) => d.code));
  const idOf = new Map((data ?? []).map((d) => [d.code, d.id]));
  return drivers.map((d) => {
    const id = idOf.get(d.code);
    if (!id) throw new Error(`Piloto ${d.code} no encontrado.`);
    return id;
  });
}

/**
 * Records a round's official classification (driver ids, index 0 = P1) and scores the
 * round. Recording it again after a penalty or disqualification re-scores the round,
 * as long as its money hasn't been settled yet.
 */
export async function saveF1Classification(supabase: Supabase, roundId: string, driverIds: string[]): Promise<boolean> {
  const { data: round } = await supabase
    .from("rounds")
    .select("id, status, period:settlement_periods(settled_at), events(id)")
    .eq("id", roundId)
    .single();
  if (!round?.events[0]) throw new Error("Jornada no encontrada.");
  if (round.period?.settled_at) throw new Error("Esta jornada ya se liquidó en un corte; no se puede recalificar.");
  if (round.status === "completed") {
    // Rounds imported from before the app have points but no picks: scoring them would zero everyone.
    const { count } = await supabase
      .from("f1_picks")
      .select("*", { count: "exact", head: true })
      .eq("event_id", round.events[0].id);
    if (!count) throw new Error("Esta jornada se importó sin pics; su resultado no se puede recalificar.");
  }
  if (driverIds.length < F1_PICK_POSITIONS) throw new Error(`Faltan posiciones: se necesitan al menos ${F1_PICK_POSITIONS}.`);

  const { error } = await supabase.rpc("save_f1_classification", {
    p_event_id: round.events[0].id,
    p_driver_ids: driverIds.slice(0, CLASSIFICATION_POSITIONS),
  });
  if (error) throw new Error(error.message);
  return scoreRound(supabase, roundId);
}

export interface F1RoundDetail {
  id: string;
  poolId: string;
  season: string;
  name: string;
  kind: F1RoundKind;
  status: "scheduled" | "completed" | "cancelled";
  event: { id: string; startsAt: Date; lockAt: Date } | null;
  drivers: F1Driver[];
  players: { id: string; name: string }[];
  /** Picks this player may see, by player: driver ids P1–P10, null where empty. */
  picks: Record<string, (string | null)[]>;
  /** Official classification (driver ids by position), empty until recorded. */
  classification: string[];
  /** On a Sprint weekend's GP: the Sprint picks this player may see, to copy them. */
  sprintPicks: Record<string, (string | null)[]> | null;
}

async function picksOf(supabase: Supabase, eventId: string) {
  const { data } = await supabase.from("f1_picks").select("player_id, position, driver_id").eq("event_id", eventId);
  const byPlayer: Record<string, { position: number; driver_id: string }[]> = {};
  for (const p of data ?? []) (byPlayer[p.player_id] ??= []).push(p);
  return Object.fromEntries(
    Object.entries(byPlayer).map(([playerId, rows]) => [
      playerId,
      orderByPosition(rows.map((r) => ({ position: r.position, driverId: r.driver_id }))),
    ]),
  );
}

export const getF1RoundDetail = cache(async (poolId: string, roundId: string): Promise<F1RoundDetail | null> => {
  const supabase = await createClient();
  const { data: round } = await supabase
    .from("rounds")
    .select("id, pool_id, name, kind, ordinal, status, pool:pools(sport, season), events(id, starts_at, lock_at)")
    .eq("id", roundId)
    .eq("pool_id", poolId)
    .maybeSingle();
  if (round?.pool?.sport !== "f1" || (round.kind !== "gp" && round.kind !== "sprint")) return null;

  const event = round.events[0];
  const [drivers, { data: enrollments }, picks, { data: classification }, { data: sprint }] = await Promise.all([
    getF1Drivers(round.pool.season),
    supabase.from("enrollments").select("player:players(id, display_name, nickname)").eq("pool_id", poolId),
    event ? picksOf(supabase, event.id) : {},
    event
      ? supabase.from("f1_classification").select("position, driver_id").eq("event_id", event.id).order("position")
      : { data: [] },
    round.kind === "gp"
      ? supabase
          .from("rounds")
          .select("events(id)")
          .eq("pool_id", poolId)
          .eq("kind", "sprint")
          .eq("ordinal", round.ordinal - 1)
          .maybeSingle()
      : { data: null },
  ]);
  const sprintEvent = sprint?.events[0];

  return {
    id: round.id,
    poolId: round.pool_id,
    season: round.pool.season,
    name: round.name,
    kind: round.kind,
    status: round.status,
    event: event
      ? { id: event.id, startsAt: new Date(event.starts_at), lockAt: new Date(event.lock_at) }
      : null,
    drivers,
    players: (enrollments ?? [])
      .flatMap((e) => (e.player ? [{ id: e.player.id, name: playerName(e.player) }] : []))
      .sort((a, b) => a.name.localeCompare(b.name)),
    picks,
    classification: (classification ?? []).map((c) => c.driver_id),
    sprintPicks: sprintEvent ? await picksOf(supabase, sprintEvent.id) : null,
  };
});

export interface F1CalendarRound {
  id: string;
  name: string;
  startsAt: Date;
}

/** Rounds still to be raced (or scored), in order. */
export const getF1Calendar = cache(async (poolId: string): Promise<F1CalendarRound[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rounds")
    .select("id, name, pool:pools!inner(sport), events(starts_at)")
    .eq("pool_id", poolId)
    .eq("pool.sport", "f1")
    .eq("status", "scheduled")
    .order("ordinal");
  return (data ?? []).flatMap((r) =>
    r.events[0] ? [{ id: r.id, name: r.name, startsAt: new Date(r.events[0].starts_at) }] : [],
  );
});
