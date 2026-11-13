import { TIME_ZONE, type Cents, type Sport } from "@/domain";
import { formatMoney } from "./format";
import { roundTitle } from "./reminders";

/** What a phone notification shows. */
export interface PushMessage {
  title: string;
  body: string;
}

const ICONS: Record<Sport, string> = { liga_mx: "⚽", nfl: "🏈", f1: "🏎️" };

const day = new Intl.DateTimeFormat("es-MX", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });
const time = new Intl.DateTimeFormat("es-MX", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const list = (names: readonly string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;

export function openedMessage(input: {
  sport: Sport;
  poolName: string;
  roundNames: string[];
  firstLockAt: Date;
}): PushMessage {
  const when = `el ${day.format(input.firstLockAt).replace(",", "")} a las ${time.format(input.firstLockAt)}`;
  // Liga MX and NFL lock match by match; an F1 weekend locks all at once.
  const lock = input.sport === "f1" ? `Cierran ${when}.` : `El primer ${input.sport === "nfl" ? "juego" : "partido"} cierra ${when}.`;
  return {
    title: `${ICONS[input.sport]} ${input.poolName} · ${list(input.roundNames.map(roundTitle))}`,
    body: `¡Ya están abiertos los pics! ${lock}`,
  };
}

const picks = (n: number, noun: boolean) => (n === 1 ? `falta 1${noun ? " pic" : ""}` : `faltan ${n}${noun ? " pics" : ""}`);

export function closingMessage(input: {
  lockAt: Date;
  own: { pool: string; missing: number }[];
  /** Players whose picks the recipient enters. */
  others: { name: string; pool: string; missing: number }[];
}): PushMessage {
  const lines = [
    ...input.own.map((m, i) => `Te ${picks(m.missing, i === 0)} en ${m.pool}.`),
    ...input.others.map((m) => `A ${m.name} le ${picks(m.missing, true)} en ${m.pool}.`),
  ];
  return { title: `⏰ Los pics cierran a las ${time.format(input.lockAt)}`, body: lines.join(" ") };
}

export function winnerMessage(input: {
  sport: Sport;
  poolName: string;
  roundName: string;
  winners: string[];
  points: number;
  prizeEachCents: Cents;
  perfect: string[];
  bonusEachCents: Cents;
}): PushMessage {
  const pts = `${input.points} ${input.points === 1 ? "pt" : "pts"}`;
  const each = (several: boolean) => (several ? " c/u" : "");
  const lines = [
    input.winners.length === 1
      ? `Ganó ${input.winners[0]} con ${pts}: ${formatMoney(input.prizeEachCents)}.`
      : `Empate de ${list(input.winners)} con ${pts}: ${formatMoney(input.prizeEachCents)} c/u.`,
  ];
  if (input.perfect.length > 0) {
    lines.push(
      `🎯 Jornada perfecta de ${list(input.perfect)}: ${formatMoney(input.bonusEachCents)}${each(input.perfect.length > 1)} del acumulado.`,
    );
  }
  return { title: `🏆 ${input.poolName} · ${roundTitle(input.roundName)}`, body: lines.join(" ") };
}
