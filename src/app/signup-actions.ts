"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlayer } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

/**
 * Signs the player up to a pool that takes sign-ups and opens it. The database checks
 * that sign-up is still open (before the pool's first match locks).
 */
export async function joinPool(poolId: string): Promise<{ message: string }> {
  await requirePlayer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_pool", { p_pool_id: poolId });
  if (error) {
    return {
      message: error.message.includes("closed")
        ? "Ya cerró la inscripción: empezó el primer partido."
        : "No se pudo inscribirte. Intenta de nuevo.",
    };
  }
  revalidatePath("/", "layout");
  redirect(`/quinielas/${poolId}`);
}
