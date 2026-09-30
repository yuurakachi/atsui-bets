/**
 * ESPN's public scoreboard API. Runs in the admin's browser: ESPN rejects some
 * server-side requests but allows cross-origin requests from browsers.
 */
import type { MatchResult, Sport } from "@/domain";

export interface EspnMatch {
  externalId: string;
  home: string;
  away: string;
  startsAt: string;
  /** null while the match isn't final. */
  result: MatchResult | null;
  state: "pre" | "in" | "post";
  score: { home: number; away: number } | null;
  /** Minute while playing ("67'"), or ESPN's short status ("FT"). */
  clock: string;
}

const LEAGUE_PATH: Partial<Record<Sport, string>> = {
  liga_mx: "soccer/mex.1",
  nfl: "football/nfl",
};

/** Names as the family uses them, instead of ESPN's official ones. */
const TEAM_NAMES: Record<string, string> = {
  Guadalajara: "Chivas",
  "Tigres UANL": "Tigres",
  "Pumas UNAM": "Pumas",
  "Atlético de San Luis": "San Luis",
  "FC Juarez": "Juárez",
  "FC Juárez": "Juárez",
  Queretaro: "Querétaro",
  Leon: "León",
  America: "América",
  Mazatlan: "Mazatlán",
};

interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
  winner?: boolean;
  team: { displayName: string };
}

interface EspnEvent {
  id: string;
  date: string;
  competitions: {
    status: {
      displayClock?: string;
      type: { name: string; completed: boolean; state?: string; shortDetail?: string };
    };
    competitors: EspnCompetitor[];
  }[];
}

const VOID_STATUSES = new Set(["STATUS_POSTPONED", "STATUS_CANCELED", "STATUS_ABANDONED", "STATUS_FORFEIT"]);

function resultOf(event: EspnEvent): MatchResult | null {
  const competition = event.competitions[0];
  const status = competition.status.type;
  if (VOID_STATUSES.has(status.name)) return "void";
  if (!status.completed) return null;

  const home = competition.competitors.find((c) => c.homeAway === "home");
  const away = competition.competitors.find((c) => c.homeAway === "away");
  const diff = Number(home?.score) - Number(away?.score);
  if (Number.isNaN(diff)) return null;
  return diff > 0 ? "home" : diff < 0 ? "away" : "draw";
}

function toMatch(event: EspnEvent): EspnMatch {
  const { competitors, status } = event.competitions[0];
  const state = status.type.state === "in" || status.type.state === "post" ? status.type.state : "pre";
  const home = Number(competitors.find((c) => c.homeAway === "home")?.score);
  const away = Number(competitors.find((c) => c.homeAway === "away")?.score);
  const name = (side: "home" | "away") => {
    const official = competitors.find((c) => c.homeAway === side)?.team.displayName ?? "?";
    return TEAM_NAMES[official] ?? official;
  };
  return {
    externalId: `espn:${event.id}`,
    home: name("home"),
    away: name("away"),
    startsAt: new Date(event.date).toISOString(),
    result: resultOf(event),
    state,
    score: state !== "pre" && !Number.isNaN(home) && !Number.isNaN(away) ? { home, away } : null,
    clock: (state === "in" ? status.displayClock : status.type.shortDetail) ?? "",
  };
}

function yyyymmdd(date: string): string {
  return date.replaceAll("-", "");
}

/** Every match between two calendar dates (inclusive, "YYYY-MM-DD"), sorted by kickoff. */
export async function fetchMatches(sport: Sport, from: string, to: string): Promise<EspnMatch[]> {
  const path = LEAGUE_PATH[sport];
  if (!path) throw new Error(`ESPN no tiene partidos para ${sport}.`);

  // ESPN rejects date ranges for soccer, so ask day by day.
  const days: string[] = [];
  for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  if (days.length > 10) throw new Error("Elige un rango de 10 días o menos.");

  const responses = await Promise.all(
    days.map(async (day) => {
      const response = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${yyyymmdd(day)}`,
      );
      if (!response.ok) throw new Error(`ESPN respondió ${response.status}.`);
      return ((await response.json()) as { events?: EspnEvent[] }).events ?? [];
    }),
  );

  const byId = new Map<string, EspnMatch>();
  for (const event of responses.flat()) byId.set(event.id, toMatch(event));
  return [...byId.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
