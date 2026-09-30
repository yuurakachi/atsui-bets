import Link from "next/link";
import type { UpcomingRound } from "@/lib/rounds";

const lockFormat = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Call to action for a round that's open for picks. */
export function UpcomingRoundCard({ round, poolName }: { round: UpcomingRound; poolName?: string }) {
  const { closed } = round;
  const complete = round.missing === 0;

  return (
    <Link
      href={`/quinielas/${round.poolId}/jornadas/${round.id}`}
      className={`block rounded-xl border px-4 py-3 transition ${
        complete || closed ? "border-border bg-surface hover:border-accent" : "border-accent bg-accent/10"
      }`}
    >
      <p className="text-xs font-medium text-accent">{poolName ?? "Jornada abierta"}</p>
      <p className="flex items-center justify-between gap-3">
        <span className="font-semibold">{round.name.replace(/^J(\d+)$/, "Jornada $1")}</span>
        <span className="text-sm font-medium">
          {closed ? "Cerrada" : complete ? "✓ Pics listos" : `Te faltan ${round.missing} pics`}
        </span>
      </p>
      <p className="text-sm text-muted">
        {closed ? "Pics cerrados · ver resultados" : `Cierra ${lockFormat.format(round.firstLockAt)}`}
      </p>
    </Link>
  );
}
