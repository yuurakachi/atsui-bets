"use server";

import { validateF1Pick, type MatchOutcome } from "@/domain";
import { canManagePool, requirePlayer } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export type SaveResult = { ok: true } | { ok: false; message: string };

const OUTCOMES = new Set<unknown>(["home", "draw", "away"]);

/**
 * Saves one pick. Players pick for themselves before the lock; the pool's admins can
 * pick for anyone at any time (audited). Row level security enforces the same rules.
 */
export async function savePick(
  poolId: string,
  roundId: string,
  eventId: string,
  playerId: string,
  selection: MatchOutcome,
): Promise<SaveResult> {
  const player = await requirePlayer();
  if (!OUTCOMES.has(selection)) return { ok: false, message: "Pic inválido." };

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, lock_at, round:rounds!inner(id, pool_id, pool:pools(sport))")
    .eq("id", eventId)
    .eq("round_id", roundId)
    .eq("round.pool_id", poolId)
    .maybeSingle();
  if (!event) return { ok: false, message: "Partido no encontrado." };
  if (event.round.pool?.sport === "nfl" && selection === "draw") {
    return { ok: false, message: "En NFL no hay empate." };
  }

  const onBehalf = playerId !== player.id;
  const manager = onBehalf || new Date(event.lock_at) <= new Date() ? await canManagePool(poolId) : false;
  if (onBehalf && !manager) return { ok: false, message: "Solo puedes hacer tus propios pics." };
  if (new Date(event.lock_at) <= new Date() && !manager) {
    return { ok: false, message: "Este partido ya cerró." };
  }

  const { error } = await supabase
    .from("match_picks")
    .upsert(
      { event_id: eventId, player_id: playerId, selection, entered_by: player.id },
      { onConflict: "event_id,player_id" },
    );
  if (error) return { ok: false, message: "No se pudo guardar. Intenta de nuevo." };
  return { ok: true };
}

/**
 * Saves a whole F1 pick (driver ids for P1–P10, null = empty). Same rules as match
 * picks: players before the lock, the pool's admins for anyone at any time.
 */
export async function saveF1Picks(
  poolId: string,
  roundId: string,
  playerId: string,
  driverIds: (string | null)[],
): Promise<SaveResult> {
  const player = await requirePlayer();
  if (
    !Array.isArray(driverIds) ||
    driverIds.some((d) => d !== null && typeof d !== "string") ||
    validateF1Pick(driverIds).length > 0
  ) {
    return { ok: false, message: "Un piloto solo puede ir en una posición." };
  }

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, lock_at, round:rounds!inner(id, pool_id)")
    .eq("round_id", roundId)
    .eq("round.pool_id", poolId)
    .limit(1)
    .maybeSingle();
  if (!event) return { ok: false, message: "Carrera no encontrada." };

  const locked = new Date(event.lock_at) <= new Date();
  const onBehalf = playerId !== player.id;
  const manager = onBehalf || locked ? await canManagePool(poolId) : false;
  if (onBehalf && !manager) return { ok: false, message: "Solo puedes hacer tus propios pics." };
  if (locked && !manager) return { ok: false, message: "Los pics de esta carrera ya cerraron." };

  const { error } = await supabase.rpc("save_f1_picks", {
    p_event_id: event.id,
    p_player_id: playerId,
    // Empty positions travel as null; the generated types don't know arrays can hold them.
    p_driver_ids: driverIds as string[],
  });
  if (error) return { ok: false, message: "No se pudo guardar. Intenta de nuevo." };
  return { ok: true };
}
