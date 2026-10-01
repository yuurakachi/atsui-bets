import { TIME_ZONE, type Sport } from "@/domain";

export interface ReminderInput {
  sport: Sport;
  poolName: string;
  roundName: string;
  /** When the first open event locks. */
  lockAt: Date;
  url: string;
  /** Players with open picks left, and how many they're missing. */
  missing: { name: string; count: number }[];
  /** Open events being chased: the whole round, or in the NFL the games of the next day with any. */
  openEvents: number;
  /** Enrolled players. */
  players: number;
}

const day = new Intl.DateTimeFormat("es-MX", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });
const time = new Intl.DateTimeFormat("es-MX", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const ICONS: Record<Sport, string> = { liga_mx: "⚽", nfl: "🏈", f1: "🏎️" };

const localDay = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });

/** The events that lock on the same Mexico City day as the earliest one. */
export function nextDayEvents<T extends { lockAt: Date }>(events: readonly T[]): T[] {
  if (events.length === 0) return [];
  const first = localDay.format(new Date(Math.min(...events.map((e) => e.lockAt.getTime()))));
  return events.filter((e) => localDay.format(e.lockAt) === first);
}

export function roundTitle(name: string): string {
  return name.replace(/^J(\d+)$/, "Jornada $1");
}

/** Group chat message (WhatsApp formatting) announcing a round or chasing missing picks. */
export function reminderMessage(input: ReminderInput): string {
  const date = day.format(input.lockAt).replace(",", "");
  const hour = time.format(input.lockAt);
  // NFL games lock one by one, so each reminder chases one day's games.
  const deadline =
    input.sport !== "nfl"
      ? `Los pics cierran el *${date} a las ${hour}*.`
      : input.openEvents === 1
        ? `El juego del *${date}* cierra a las *${hour}*.`
        : `Los ${input.openEvents} juegos del *${date}* cierran uno por uno; el primero a las *${hour}*.`;
  const header = `${ICONS[input.sport]} *${input.poolName} · ${roundTitle(input.roundName)}*`;

  if (input.missing.length === 0) {
    return [header, "✅ Ya todos tienen sus pics.", deadline].join("\n");
  }
  const nobodyStarted =
    input.missing.length >= input.players && input.missing.every((m) => m.count >= input.openEvents);
  if (nobodyStarted) {
    return [header, "¡Ya están abiertos los pics!", deadline, "", `👉 ${input.url}`].join("\n");
  }

  const names = input.missing
    .map((m) => (m.count < input.openEvents ? `${m.name} (le faltan ${m.count})` : m.name))
    .join(", ");
  return [header, deadline, "", `Faltan: ${names}`, "", `👉 ${input.url}`].join("\n");
}
