"use server";

import { requirePlayer } from "@/lib/dal";
import { sendToSubscriptions } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Saves this phone for the signed-in player and sends a test notification to it. */
export async function savePushSubscription(input: PushSubscriptionInput): Promise<{ ok: boolean; message: string }> {
  await requirePlayer();
  // The server sends notifications to this address: only a push service's https URL.
  if (!input.endpoint.startsWith("https://")) return { ok: false, message: "Suscripción no válida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: input.endpoint,
    p_p256dh: input.p256dh,
    p_auth: input.auth,
  });
  if (error) return { ok: false, message: "No se pudo guardar. Intenta de nuevo." };

  const { data: saved } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("endpoint", input.endpoint);
  const sent = await sendToSubscriptions(
    supabase,
    saved ?? [],
    { title: "🔔 Notificaciones activadas", body: "Así te van a llegar los avisos de Atsui bets.", url: "/" },
    60 * 60,
  );
  return sent > 0
    ? { ok: true, message: "Listo. Te mandamos un aviso de prueba." }
    : { ok: true, message: "Activadas, pero el aviso de prueba no salió. Avísale al admin." };
}

/** Forgets this phone: it stops getting notifications. */
export async function removePushSubscription(endpoint: string): Promise<void> {
  await requirePlayer();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
