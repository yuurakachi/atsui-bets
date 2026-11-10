import "server-only";
import { revalidatePath } from "next/cache";
import { LIGA_MX_MATCHDAYS, TIME_ZONE, matchdayOpensAt, nextMatchday, rescheduledInto } from "@/domain";
import { fetchMatch, fetchMatchDays, fetchMatchesOn, type EspnMatch } from "./espn";
import { createMatchRound } from "./rounds";
import type { createServiceClient } from "./supabase/service";

export interface MatchdayReport {
  pool: string;
  round: string;
  matches: number;
  /** Postponed matches from earlier matchdays that join this one. */
  rescheduled: number;
  created: boolean;
  /** Why it wasn't created and is left for an admin; not a failure. */
  skipped?: string;
  error?: string;
}

/** ESPN days to look at for the next matchday: the next few with matches. */
const DAYS_AHEAD = 6;

const localDay = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });

/**
 * Opens the next matchday of every active Liga MX pool once the current one is over:
 * from 00:00 of the day after its last match. The matchday is the next nine matches where
 * every team plays once, plus postponed matches whose new date falls before it ends.
 * When the matches don't add up it creates nothing and an admin loads it by hand.
 * The first matchday of a season is always loaded by hand.
 */
export async function openNextMatchdays(
  supabase: ReturnType<typeof createServiceClient>,
  now: Date,
  { dryRun }: { dryRun: boolean },
): Promise<MatchdayReport[]> {
  const { data: pools, error } = await supabase
    .from("pools")
    .select("id, name, rounds(name, ordinal, events(external_id, home_team, away_team, starts_at, result))")
    .eq("sport", "liga_mx")
    .eq("status", "active");
  if (error) throw new Error(error.message);

  const reports: MatchdayReport[] = [];
  for (const pool of pools ?? []) {
    const latest = [...pool.rounds].sort((a, b) => b.ordinal - a.ordinal)[0];
    if (!latest || latest.ordinal >= LIGA_MX_MATCHDAYS || latest.events.length === 0) continue;
    const lastKickoff = new Date(Math.max(...latest.events.map((e) => new Date(e.starts_at).getTime())));
    if (now < matchdayOpensAt(lastKickoff)) continue;

    const report: MatchdayReport = {
      pool: pool.name,
      round: `J${latest.ordinal + 1}`,
      matches: 0,
      rescheduled: 0,
      created: false,
    };
    reports.push(report);
    try {
      const events = pool.rounds.flatMap((r) => r.events).filter((e) => e.external_id);
      const taken = new Set(events.filter((e) => e.result !== "void").map((e) => e.external_id!));
      const postponed = new Set(
        events.filter((e) => e.result === "void" && !taken.has(e.external_id!)).map((e) => e.external_id!),
      );

      const today = localDay.format(now);
      const days = (await fetchMatchDays("liga_mx")).filter((d) => d >= today).slice(0, DAYS_AHEAD);
      const playable = (m: EspnMatch) => m.state === "pre" && m.result === null && new Date(m.startsAt) > now;
      const upcoming = (await fetchMatchesOn("liga_mx", days))
        .filter((m) => playable(m) && !taken.has(m.externalId) && !postponed.has(m.externalId))
        .map((m) => ({ ...m, startsAt: new Date(m.startsAt) }));

      const matchday = nextMatchday(upcoming);
      if (!matchday) {
        report.skipped = "Los próximos partidos no forman una jornada de 9 con cada equipo una vez.";
        continue;
      }
      const moved = (await Promise.all([...postponed].map((id) => fetchMatch("liga_mx", id).catch(() => null))))
        .filter((m): m is EspnMatch => m !== null && playable(m))
        .map((m) => ({ ...m, startsAt: new Date(m.startsAt) }));
      const rescheduled = rescheduledInto(moved, matchday, now);
      report.matches = matchday.length + rescheduled.length;
      report.rescheduled = rescheduled.length;
      if (dryRun) continue;

      const created = await createMatchRound(supabase, { id: pool.id, sport: "liga_mx" }, report.round, [
        ...matchday,
        ...rescheduled,
      ]);
      if (!created.ok) {
        report.skipped = created.message;
        continue;
      }
      report.created = true;
      revalidatePath(`/quinielas/${pool.id}`, "layout");
    } catch (e) {
      report.error = (e as Error).message;
    }
  }
  return reports;
}
