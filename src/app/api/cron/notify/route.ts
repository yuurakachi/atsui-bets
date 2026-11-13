import { sendDueNotifications } from "@/lib/notify";
import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 30;

/**
 * Sends the phone notifications that are due. Supabase pg_cron calls it within the minute
 * when picks lock in 10 minutes or a round was scored; the results job calls it every 30
 * minutes for "picks are open". Only callers with CRON_SECRET get in.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await sendDueNotifications(createServiceClient(), new Date()));
}
