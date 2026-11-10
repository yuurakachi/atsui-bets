import { updateDueResults } from "@/lib/auto-results";
import { createServiceClient } from "@/lib/supabase/service";

// A due round asks ESPN for a few days and saves a handful of rows.
export const maxDuration = 60;

/**
 * Called every 30 minutes by .github/workflows/results.yml: saves the results of the
 * rounds whose last match is over. Only callers with CRON_SECRET get in. Add ?dryRun=1
 * to see what it would save without saving anything.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.has("dryRun");
  const rounds = await updateDueResults(createServiceClient(), new Date(), { dryRun });
  const failed = rounds.some((r) => r.error);
  return Response.json({ dryRun, rounds }, { status: failed ? 502 : 200 });
}
