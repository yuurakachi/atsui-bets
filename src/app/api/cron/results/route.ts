import { openNextMatchdays, openNextNflWeeks } from "@/lib/auto-rounds";
import { updateDueResults } from "@/lib/auto-results";
import { sendDueNotifications } from "@/lib/notify";
import { createServiceClient } from "@/lib/supabase/service";

// A due round asks ESPN for a few days and saves a handful of rows.
export const maxDuration = 60;

/**
 * Called every 30 minutes by .github/workflows/results.yml: saves the results of the
 * rounds whose last match is over, then opens the next Liga MX matchday and NFL week once
 * the current one is over. Only callers with CRON_SECRET get in. Add ?dryRun=1 to see what it would
 * do without saving anything.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.has("dryRun");
  const supabase = createServiceClient();
  const rounds = await updateDueResults(supabase, new Date(), { dryRun });
  const matchdays = await openNextMatchdays(supabase, new Date(), { dryRun });
  const weeks = await openNextNflWeeks(supabase, new Date(), { dryRun });
  // Announces what this run opened or scored; a failure here doesn't undo the results.
  const notifications = dryRun
    ? null
    : await sendDueNotifications(supabase, new Date()).catch((e: Error) => ({ error: e.message }));
  const failed = [...rounds, ...matchdays, ...weeks].some((r) => r.error);
  return Response.json({ dryRun, rounds, matchdays, weeks, notifications }, { status: failed ? 502 : 200 });
}
