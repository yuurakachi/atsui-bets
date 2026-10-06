import type { Cents, PrizeKind, Sport } from "@/domain";
import { formatMoney, formatMoneyCompact } from "@/lib/format";

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

/** A round's name short enough for a chart axis: "J10", "S3", or its number in the season. */
export function shortRoundLabel(name: string, index: number): string {
  if (/^J\d+$/.test(name)) return name;
  const week = /^Semana (\d+)$/.exec(name);
  return week ? `S${week[1]}` : String(index + 1);
}

/** Money without ".00" but never with a single decimal: "$3,400", "$562.50". */
export function money(cents: Cents): string {
  return cents % 100 === 0 ? formatMoneyCompact(cents) : formatMoney(cents);
}

/** Signed money: "+$262.50", "-$295", "$0". */
export function net(cents: Cents): string {
  return `${cents > 0 ? "+" : cents < 0 ? "-" : ""}${money(Math.abs(cents))}`;
}
