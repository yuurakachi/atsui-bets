import "server-only";
import { revalidatePath } from "next/cache";
import { resultsDue, type MatchResult } from "@/domain";
import { espnDays, fetchMatchesOn } from "./espn";
import { saveMatchResults } from "./rounds";
import type { createServiceClient } from "./supabase/service";

export interface RoundReport {
  pool: string;
  round: string;
  /** Matches ESPN reported as finished (or postponed). */
  final: number;
  matches: number;
  scored: boolean;
  error?: string;
}

/**
 * Fetches from ESPN the results of every Liga MX and NFL round whose last match should
 * be over, saves them and scores the rounds that are complete. With `dryRun` it only
 * reports what it would save.
 */
export async function updateDueResults(
  supabase: ReturnType<typeof createServiceClient>,
  now: Date,
  { dryRun }: { dryRun: boolean },
): Promise<RoundReport[]> {
  const { data: rounds, error } = await supabase
    .from("rounds")
    .select("id, name, pool:pools!inner(id, name, sport), events(external_id, starts_at, result)")
    .eq("status", "scheduled")
    .in("pool.sport", ["liga_mx", "nfl"]);
  if (error) throw new Error(error.message);

  const reports: RoundReport[] = [];
  for (const round of rounds ?? []) {
    const { sport } = round.pool;
    const events = round.events.map((e) => ({
      externalId: e.external_id,
      startsAt: new Date(e.starts_at),
      result: e.result as MatchResult | null,
    }));
    if (events.length === 0 || !resultsDue(sport, events, now)) continue;

    const report: RoundReport = { pool: round.pool.name, round: round.name, final: 0, matches: events.length, scored: false };
    reports.push(report);
    try {
      const ids = new Set(events.flatMap((e) => (e.externalId ? [e.externalId] : [])));
      const found = (await fetchMatchesOn(sport, espnDays(events.map((e) => e.startsAt)))).filter((m) =>
        ids.has(m.externalId),
      );
      report.final = found.filter((m) => m.result !== null).length;
      if (dryRun) continue;
      report.scored = (await saveMatchResults(supabase, round.id, found)).scored;
      revalidatePath(`/quinielas/${round.pool.id}`, "layout");
    } catch (e) {
      report.error = (e as Error).message;
    }
  }
  return reports;
}
