import type { PrizeKind, Sport } from "@/domain";
import type { StatsPlayer } from "@/lib/stats";
import type { PickerOption } from "./player-picker";

export const SPORT_LABEL: Record<Sport, string> = {
  liga_mx: "Liga MX",
  nfl: "NFL",
  f1: "Fórmula 1",
};

export const JACKPOT_LABEL: Record<PrizeKind, string> = {
  winner: "1°",
  lucky_seven: "Lucky 7",
  bobby: "Bobby",
};

const ROUND_NOUN: Record<Sport, [one: string, many: string]> = {
  liga_mx: ["jornada", "jornadas"],
  nfl: ["semana", "semanas"],
  f1: ["carrera", "carreras"],
};

/** What a round is called in each sport: "jornada", "semana" or "carrera". */
export function roundNoun(sport: Sport, count = 1): string {
  return ROUND_NOUN[sport][count === 1 ? 0 : 1];
}

/** "3 jornadas", "1 carrera". */
export function countRounds(sport: Sport, count: number): string {
  return `${count} ${roundNoun(sport, count)}`;
}

/**
 * The people the viewer can switch to: themselves first, then everyone else by name.
 * `current` is always offered, even if they aren't in the list.
 */
export function pickerOptions(
  players: readonly StatsPlayer[],
  current: StatsPlayer,
  viewerId: string,
  href: (playerId: string) => string,
): PickerOption[] {
  const all = players.some((p) => p.id === current.id) ? players : [...players, current];
  return [...all]
    .sort((a, b) => Number(b.id === viewerId) - Number(a.id === viewerId) || a.name.localeCompare(b.name, "es"))
    .map((p) => ({ id: p.id, name: p.id === viewerId ? `${p.name} (yo)` : p.name, href: href(p.id) }));
}

/** A round's name short enough for a chart axis: "J10", "S3", or its number in the season. */
export function shortRoundLabel(name: string, index: number): string {
  if (/^J\d+$/.test(name)) return name;
  const week = /^Semana (\d+)$/.exec(name);
  return week ? `S${week[1]}` : String(index + 1);
}
