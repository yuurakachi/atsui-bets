"use server";

import { revalidatePath } from "next/cache";
import { requirePlayer } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

/**
 * Marks a pool's monthly money as collected and paid. Allowed for the admin and the
 * pool's sub-admin; the database's row level security enforces it.
 */
export async function markPeriodSettled(poolId: string, periodId: string) {
  const player = await requirePlayer();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("settlement_periods")
    .update({ settled_at: new Date().toISOString(), settled_by: player.id })
    .eq("id", periodId)
    .eq("pool_id", poolId)
    .is("settled_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("No tienes permiso para cerrar este corte, o ya estaba cerrado.");

  revalidatePath(`/quinielas/${poolId}`, "layout");
}
