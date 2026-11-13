import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendNotification, WebPushError } from "web-push";
import type { PushMessage } from "./notifications";
import type { Database } from "./supabase/database.types";

type Supabase = SupabaseClient<Database>;

export interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** The VAPID keys that sign our notifications; null until they're set in Vercel. */
function vapidDetails() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

/**
 * Sends a notification to these phones and forgets the ones the push service says no
 * longer exist (the app was uninstalled or notifications turned off). `ttlSeconds` is how
 * long the push service keeps trying a phone that's off. Returns how many were sent.
 */
export async function sendToSubscriptions(
  supabase: Supabase,
  subscriptions: readonly StoredSubscription[],
  message: PushMessage & { url: string },
  ttlSeconds: number,
): Promise<number> {
  const vapid = vapidDetails();
  if (!vapid || subscriptions.length === 0) return 0;

  const payload = JSON.stringify(message);
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    subscriptions.map(async (s) => {
      try {
        await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          vapidDetails: vapid,
          TTL: Math.max(0, Math.round(ttlSeconds)),
        });
        sent++;
      } catch (e) {
        if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410)) gone.push(s.id);
        else console.error("push failed", (e as Error).message);
      }
    }),
  );
  if (gone.length > 0) await supabase.from("push_subscriptions").delete().in("id", gone);
  return sent;
}

/** Sends to every phone of these players. */
export async function sendToPlayers(
  supabase: Supabase,
  playerIds: readonly string[],
  message: PushMessage & { url: string },
  ttlSeconds: number,
): Promise<number> {
  if (playerIds.length === 0) return 0;
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("player_id", [...new Set(playerIds)]);
  if (error) throw new Error(error.message);
  return sendToSubscriptions(supabase, data, message, ttlSeconds);
}
