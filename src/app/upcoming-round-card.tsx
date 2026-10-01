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
      data-sport={round.sport}
      className={`block rounded-xl border border-l-4 border-l-sport bg-surface px-4 py-3 transition hover:border-accent hover:border-l-sport ${
        complete || closed ? "border-border" : "border-accent/50 shadow-sm"
      }`}
    >
      <p className="text-xs font-semibold tracking-wider text-sport uppercase">{poolName ?? "Jornada abierta"}</p>
      <p className="flex items-baseline justify-between gap-3">
        <span className="font-display text-xl font-bold uppercase">{round.name.replace(/^J(\d+)$/, "Jornada $1")}</span>
        <span
          className={`shrink-0 text-sm font-semibold ${
            closed ? "text-muted" : complete ? "text-positive" : "text-accent"
          }`}
        >
          {closed
            ? "Cerrada"
            : complete
              ? "✓ Pics listos"
              : round.sport === "f1"
                ? `Llevas ${round.events - round.missing} de ${round.events}`
                : `Te faltan ${round.missing} pics`}
        </span>
      </p>
      <p className="text-sm text-muted">
        {closed ? "Pics cerrados · ver resultados" : `Cierra ${lockFormat.format(round.firstLockAt)}`}
      </p>
    </Link>
  );
}
