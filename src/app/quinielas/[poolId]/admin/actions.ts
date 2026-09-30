"use server";

import { revalidatePath } from "next/cache";
import type { MatchResult } from "@/domain";
import { canManagePool } from "@/lib/dal";
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

  const events: NewEvent[] = matches.map((m) => ({ ...m, startsAt: new Date(m.startsAt) }));
  const locks = lockTimes(pool.sport, events);
  if (locks.some((lock) => lock.getTime() <= Date.now())) {
    return { ok: false, message: "Algún partido ya cerró sus pics. Elige una jornada futura." };
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
  return { ok: true, message: `${roundName} creada con ${events.length} partidos.` };
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
    const { data, error } = await supabase
      .from("events")
      .update({ result: m.result })
      .eq("round_id", roundId)
      .eq("external_id", m.externalId)
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
