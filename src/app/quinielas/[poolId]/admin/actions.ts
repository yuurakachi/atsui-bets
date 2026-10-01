"use server";

import { revalidatePath } from "next/cache";
import { F1_PICK_POSITIONS, validateF1Pick, type MatchResult } from "@/domain";
import { canManagePool } from "@/lib/dal";
import { f1DriverIds, importF1Season, saveF1Classification } from "@/lib/f1";
import {
  fetchF1Classification,
  fetchF1Season,
  parseF1ExternalId,
  type F1DriverInfo,
  type F1SeasonData,
} from "@/lib/jolpica";
import { lockTimes, scoreRound, type NewEvent } from "@/lib/rounds";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

interface MatchInput {
  externalId: string;
  home: string;
  away: string;
  startsAt: string;
  result: MatchResult | null;
}

const RESULTS = new Set<unknown>(["home", "draw", "away", "void", null]);

function validMatches(matches: unknown): matches is MatchInput[] {
  return (
    Array.isArray(matches) &&
    matches.length > 0 &&
    matches.length <= 20 &&
    matches.every(
      (m) =>
        typeof m?.externalId === "string" &&
        typeof m.home === "string" &&
        typeof m.away === "string" &&
        !Number.isNaN(Date.parse(m.startsAt)) &&
        RESULTS.has(m.result),
    )
  );
}

/** Creates the next round of a pool from the matches the admin reviewed. */
export async function createRound(poolId: string, name: string, matches: MatchInput[]): Promise<ActionResult> {
  if (!(await canManagePool(poolId))) return { ok: false, message: "No tienes permiso para esta quiniela." };
  if (!validMatches(matches)) return { ok: false, message: "Los partidos no son válidos." };
  const roundName = name.trim().slice(0, 30);
  if (!roundName) return { ok: false, message: "Ponle nombre a la jornada." };

  const supabase = await createClient();
  const { data: pool } = await supabase.from("pools").select("sport").eq("id", poolId).single();
  if (!pool || pool.sport === "f1") return { ok: false, message: "Esta quiniela no usa partidos." };

  const { data: last } = await supabase
    .from("rounds")
    .select("ordinal")
    .eq("pool_id", poolId)
    .order("ordinal", { ascending: false })
    .limit(1)
    .maybeSingle();

  // A match plays in one round only. One that didn't count where it was first loaded
  // (postponed) may be loaded again in the round of the week it's played.
  const { data: taken } = await supabase
    .from("events")
    .select("external_id, result, round:rounds!inner(name, pool_id)")
    .eq("round.pool_id", poolId)
    .in("external_id", matches.map((m) => m.externalId));
  const repeated = (taken ?? []).find((e) => e.result !== "void");
  if (repeated) {
    const match = matches.find((m) => m.externalId === repeated.external_id)!;
    return { ok: false, message: `${match.home} vs ${match.away} ya está en ${repeated.round.name}. Quítalo de la lista.` };
  }

  const events: NewEvent[] = matches.map((m) => ({ ...m, startsAt: new Date(m.startsAt) }));
  const locks = lockTimes(pool.sport, events);
  // An NFL week can be loaded once it's under way: games lock one by one, and the ones
  // already locked are left for the pool's admins to enter on behalf.
  const open = locks.filter((lock) => lock.getTime() > Date.now()).length;
  if (pool.sport === "nfl" ? open === 0 : open < locks.length) {
    return {
      ok: false,
      message:
        pool.sport === "nfl"
          ? "Todos los juegos de esa semana ya cerraron."
          : "Algún partido ya cerró sus pics. Elige una jornada futura.",
    };
  }

  const { data: round, error } = await supabase
    .from("rounds")
    .insert({
      pool_id: poolId,
      name: roundName,
      kind: pool.sport === "nfl" ? "week" : "matchday",
      ordinal: (last?.ordinal ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  const { error: eventsError } = await supabase.from("events").insert(
    events.map((e, i) => ({
      round_id: round.id,
      external_id: e.externalId,
      home_team: e.home,
      away_team: e.away,
      starts_at: e.startsAt.toISOString(),
      lock_at: locks[i].toISOString(),
    })),
  );
  if (eventsError) {
    await supabase.from("rounds").delete().eq("id", round.id);
    return { ok: false, message: eventsError.message };
  }

  revalidatePath(`/quinielas/${poolId}`, "layout");
  const noun = pool.sport === "nfl" ? "juegos" : "partidos";
  return { ok: true, message: `${roundName} creada con ${events.length} ${noun}.` };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Updates an enrolled player's nickname and email. Setting the email links their
 * Google account: now if they already signed in once, otherwise on their first sign-in.
 */
export async function updatePlayer(poolId: string, playerId: string, form: FormData): Promise<ActionResult> {
  if (!(await canManagePool(poolId))) return { ok: false, message: "No tienes permiso para esta quiniela." };

  const nickname = String(form.get("nickname") ?? "").trim().slice(0, 30);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!nickname) return { ok: false, message: "El apodo no puede quedar vacío." };
  if (email && !EMAIL.test(email)) return { ok: false, message: "Ese correo no es válido." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("enrollments")
    .select("*", { count: "exact", head: true })
    .eq("pool_id", poolId)
    .eq("player_id", playerId);
  if (!count) return { ok: false, message: "Ese jugador no está en esta quiniela." };

  const { error } = await supabase
    .from("players")
    .update({ nickname, email: email || null })
    .eq("id", playerId);
  if (error) {
    if (error.code === "23505") return { ok: false, message: "Ese correo ya lo tiene otro jugador." };
    if (error.message.includes("registered player")) {
      return { ok: false, message: "Este jugador ya entró a la app; solo el admin puede cambiar su correo." };
    }
    return { ok: false, message: "No se pudo guardar. Intenta de nuevo." };
  }

  revalidatePath(`/quinielas/${poolId}`, "layout");
  return { ok: true, message: "Guardado." };
}

/** Saves final results fetched from ESPN and scores the round once all are in. */
export async function saveResults(poolId: string, roundId: string, matches: MatchInput[]): Promise<ActionResult> {
  if (!(await canManagePool(poolId))) return { ok: false, message: "No tienes permiso para esta quiniela." };
  if (!validMatches(matches)) return { ok: false, message: "Los resultados no son válidos." };

  const supabase = await createClient();
  const { data: round } = await supabase
    .from("rounds")
    .select("id")
    .eq("id", roundId)
    .eq("pool_id", poolId)
    .maybeSingle();
  if (!round) return { ok: false, message: "Jornada no encontrada." };

  let updated = 0;
  for (const m of matches) {
    if (m.result === null) continue;
    // A match marked as not counting stays that way until an admin says it counts again.
    const { data, error } = await supabase
      .from("events")
      .update({ result: m.result })
      .eq("round_id", roundId)
      .eq("external_id", m.externalId)
      .or("result.is.null,result.neq.void")
      .select("id");
    if (error) return { ok: false, message: error.message };
    updated += data.length;
  }

  const scored = await scoreRound(supabase, roundId);
  revalidatePath(`/quinielas/${poolId}`, "layout");
  return {
    ok: true,
    message: scored
      ? `Resultados guardados y jornada calificada.`
      : `${updated} resultados guardados. Faltan partidos por terminar.`,
  };
}

/**
 * Marks a match of a round still waiting for results as not counting (postponed), or
 * undoes it. Scores the round if that was the last result missing.
 */
export async function setEventCounts(
  poolId: string,
  roundId: string,
  eventId: string,
  counts: boolean,
): Promise<ActionResult> {
  if (!(await canManagePool(poolId))) return { ok: false, message: "No tienes permiso para esta quiniela." };

  const supabase = await createClient();
  const { data: round } = await supabase
    .from("rounds")
    .select("id, status")
    .eq("id", roundId)
    .eq("pool_id", poolId)
    .maybeSingle();
  if (!round) return { ok: false, message: "Jornada no encontrada." };
  if (round.status !== "scheduled") return { ok: false, message: "Esa jornada ya está calificada." };

  const { data: updated, error } = await supabase
    .from("events")
    .update({ result: counts ? null : "void" })
    .eq("id", eventId)
    .eq("round_id", roundId)
    .select("id");
  if (error) return { ok: false, message: error.message };
  if (!updated.length) return { ok: false, message: "Partido no encontrado." };

  const scored = counts ? false : await scoreRound(supabase, roundId);
  revalidatePath(`/quinielas/${poolId}`, "layout");
  return {
    ok: true,
    message: counts
      ? "El partido vuelve a contar."
      : scored
        ? "Marcado como no cuenta. Era el último pendiente: jornada calificada."
        : "Marcado como no cuenta.",
  };
}

/** The server couldn't reach Jolpica: the admin's browser fetches it and calls again with the data. */
export type F1ActionResult = ActionResult | { ok: false; message: string; fetchFailed: true };

const isDate = (value: unknown) => !Number.isNaN(new Date(value as string).getTime());

function validSeason(data: unknown, season: string): data is F1SeasonData {
  const d = data as F1SeasonData;
  return (
    d?.season === season &&
    Array.isArray(d.races) &&
    d.races.length <= 40 &&
    d.races.every(
      (r) =>
        Number.isInteger(r?.round) &&
        typeof r.place === "string" &&
        isDate(r.raceStart) &&
        (r.sprintStart === null || isDate(r.sprintStart)),
    ) &&
    Array.isArray(d.drivers) &&
    d.drivers.length <= 60 &&
    d.drivers.every(validDriver)
  );
}

function validDriver(d: unknown): d is F1DriverInfo {
  const driver = d as F1DriverInfo;
  return (
    typeof driver?.code === "string" &&
    driver.code.length <= 5 &&
    typeof driver.name === "string" &&
    (driver.team === null || typeof driver.team === "string")
  );
}

async function f1Pool(poolId: string) {
  const supabase = await createClient();
  const { data: pool } = await supabase.from("pools").select("sport, season").eq("id", poolId).single();
  return { supabase, season: pool?.sport === "f1" ? pool.season : null };
}

/** Loads the season's calendar (Sprints included) and drivers from Jolpica. */
export async function loadF1Season(poolId: string, fromBrowser?: F1SeasonData): Promise<F1ActionResult> {
  if (!(await canManagePool(poolId))) return { ok: false, message: "No tienes permiso para esta quiniela." };
  const { supabase, season } = await f1Pool(poolId);
  if (!season) return { ok: false, message: "Esta quiniela no es de F1." };

  let data = fromBrowser;
  if (!data) {
    try {
      data = await fetchF1Season(season);
    } catch (e) {
      return { ok: false, message: (e as Error).message, fetchFailed: true };
    }
  } else if (!validSeason(data, season)) {
    return { ok: false, message: "Los datos del calendario no son válidos." };
  }

  try {
    const result = await importF1Season(supabase, poolId, {
      ...data,
      races: data.races.map((r) => ({
        ...r,
        raceStart: new Date(r.raceStart),
        sprintStart: r.sprintStart && new Date(r.sprintStart),
      })),
    });
    revalidatePath(`/quinielas/${poolId}`, "layout");
    return {
      ok: true,
      message:
        `${result.created} jornadas nuevas, ${result.updated} actualizadas, ${result.drivers} pilotos activos.` +
        (result.skipped ? ` ${result.skipped} carreras ya corridas no se crearon (van con la importación de la temporada).` : ""),
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Imports a round's official classification from Jolpica and scores the round. */
export async function importF1Results(
  poolId: string,
  roundId: string,
  fromBrowser?: F1DriverInfo[],
): Promise<F1ActionResult> {
  if (!(await canManagePool(poolId))) return { ok: false, message: "No tienes permiso para esta quiniela." };
  const { supabase, season } = await f1Pool(poolId);
  if (!season) return { ok: false, message: "Esta quiniela no es de F1." };

  const { data: event } = await supabase
    .from("events")
    .select("external_id, round:rounds!inner(pool_id)")
    .eq("round_id", roundId)
    .eq("round.pool_id", poolId)
    .limit(1)
    .maybeSingle();
  const race = event?.external_id ? parseF1ExternalId(event.external_id) : null;
  if (!race) return { ok: false, message: "Esta jornada no está ligada a una carrera de Jolpica." };

  let classification = fromBrowser ?? null;
  if (!classification) {
    try {
      classification = await fetchF1Classification(race.season, race.raceRound, race.kind);
    } catch (e) {
      return { ok: false, message: (e as Error).message, fetchFailed: true };
    }
  } else if (!Array.isArray(classification) || classification.length > 30 || !classification.every(validDriver)) {
    return { ok: false, message: "La clasificación no es válida." };
  }
  if (!classification) return { ok: false, message: "Jolpica todavía no tiene la clasificación de esta carrera." };

  try {
    const ids = await f1DriverIds(supabase, season, classification);
    const scored = await saveF1Classification(supabase, roundId, ids);
    revalidatePath(`/quinielas/${poolId}`, "layout");
    const podium = classification.slice(0, 3).map((d) => d.code).join(", ");
    return { ok: true, message: `Podio ${podium}. ${scored ? "Jornada calificada." : "Clasificación guardada."}` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Official P1–P10 entered by hand (Jolpica down or late) and scores the round. */
export async function saveManualClassification(
  poolId: string,
  roundId: string,
  driverIds: (string | null)[],
): Promise<ActionResult> {
  if (!(await canManagePool(poolId))) return { ok: false, message: "No tienes permiso para esta quiniela." };
  if (
    !Array.isArray(driverIds) ||
    driverIds.length !== F1_PICK_POSITIONS ||
    driverIds.some((d) => typeof d !== "string") ||
    validateF1Pick(driverIds).length > 0
  ) {
    return { ok: false, message: "Llena P1 a P10 sin repetir pilotos." };
  }

  const supabase = await createClient();
  const { data: round } = await supabase.from("rounds").select("id").eq("id", roundId).eq("pool_id", poolId).maybeSingle();
  if (!round) return { ok: false, message: "Jornada no encontrada." };
  try {
    const scored = await saveF1Classification(supabase, roundId, driverIds as string[]);
    revalidatePath(`/quinielas/${poolId}`, "layout");
    return { ok: true, message: scored ? "Resultado guardado y jornada calificada." : "Resultado guardado." };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Shows or hides a driver in the pick screen (stand-ins, drivers replaced mid-season). */
export async function setDriverActive(poolId: string, driverId: string, active: boolean): Promise<ActionResult> {
  if (!(await canManagePool(poolId))) return { ok: false, message: "No tienes permiso para esta quiniela." };
  const { supabase, season } = await f1Pool(poolId);
  if (!season) return { ok: false, message: "Esta quiniela no es de F1." };
  const { error } = await supabase
    .from("f1_drivers")
    .update({ active: Boolean(active) })
    .eq("id", driverId)
    .eq("season", season);
  if (error) return { ok: false, message: "No se pudo guardar." };
  revalidatePath(`/quinielas/${poolId}`, "layout");
  return { ok: true, message: active ? "Visible en los pics." : "Oculto en los pics." };
}
