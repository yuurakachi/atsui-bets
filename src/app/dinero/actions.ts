"use server";

import { revalidatePath } from "next/cache";
import { requirePlayer } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

/** Marks the meeting's money as collected and paid. Admin only (also enforced by RLS). */
export async function markPeriodSettled(periodId: string) {
  const player = await requirePlayer();
  if (!player.isAdmin) throw new Error("Solo el admin puede cerrar el corte.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("settlement_periods")
    .update({ settled_at: new Date().toISOString(), settled_by: player.id })
    .eq("id", periodId)
    .is("settled_at", null);
  if (error) throw new Error(error.message);

  revalidatePath("/dinero");
}
