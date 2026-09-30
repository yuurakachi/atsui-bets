import { TIME_ZONE, type Sport } from "@/domain";

export interface ReminderInput {
  sport: Sport;
  poolName: string;
  roundName: string;
  /** When the first event locks. */
  lockAt: Date;
  url: string;
  /** Players with open picks left, and how many they're missing. */
  missing: { name: string; count: number }[];
  /** Open events in the round. */
  openEvents: number;
  /** Enrolled players. */
  players: number;
}

const day = new Intl.DateTimeFormat("es-MX", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });
const time = new Intl.DateTimeFormat("es-MX", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const ICONS: Record<Sport, string> = { liga_mx: "⚽", nfl: "🏈", f1: "🏎️" };

export function roundTitle(name: string): string {
  return name.replace(/^J(\d+)$/, "Jornada $1");
}

/** Group chat message (WhatsApp formatting) announcing a round or chasing missing picks. */
export function reminderMessage(input: ReminderInput): string {
  const when = `${day.format(input.lockAt).replace(",", "")} a las ${time.format(input.lockAt)}`;
  const deadline =
    input.sport === "nfl" ? `El primer juego cierra el *${when}*.` : `Los pics cierran el *${when}*.`;
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
