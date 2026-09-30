import Link from "next/link";
import type { PrizeKind } from "@/domain";
import { canManagePool, requirePlayer } from "@/lib/dal";
import { formatMoney, formatMoneyCompact, formatNet } from "@/lib/format";
import { getPoolOverview } from "@/lib/pools";
import { getUpcomingRounds } from "@/lib/rounds";
import { UpcomingRoundCard } from "@/app/upcoming-round-card";

const JACKPOT_LABEL: Record<PrizeKind, string> = {
  winner: "1°",
  lucky_seven: "Lucky 7",
  bobby: "Bobby",
};

export default async function PoolPage({ params }: PageProps<"/quinielas/[poolId]">) {
  const { poolId } = await params;
  const player = await requirePlayer();
  const [pool, manager, upcoming] = await Promise.all([
    getPoolOverview(poolId),
    canManagePool(poolId),
    getUpcomingRounds([poolId], player.id),
  ]);
  const rounds = [...pool.rounds].reverse();

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Inicio
      </Link>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{pool.name}</h1>
        {manager && (
          <Link
            href={`/quinielas/${pool.id}/admin`}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition hover:border-accent"
          >
            Administrar
          </Link>
        )}
      </div>

      {upcoming.length > 0 && (
        <section className="mt-6 space-y-2">
          {upcoming.map((round) => (
            <UpcomingRoundCard key={round.id} round={round} />
          ))}
        </section>
      )}

      <section className="mt-6 rounded-2xl bg-accent px-5 py-4 text-accent-foreground">
        <p className="text-sm font-medium opacity-80">Acumulado de la temporada</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{formatMoney(pool.jackpotBalanceCents)}</p>
        <p className="mt-1 text-sm opacity-80">Se reparte al final: 1° 50 %, lucky 7 35 %, bobby 15 %.</p>
      </section>

      <Link
        href={`/quinielas/${pool.id}/corte`}
        className="mt-3 flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 transition hover:border-accent"
      >
        <span>
          <span className="block font-medium">Corte del mes</span>
          <span className="block text-sm text-muted">Quién paga y quién cobra en la próxima reunión</span>
        </span>
        <span aria-hidden="true" className="text-muted">→</span>
      </Link>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Tabla general</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="grid grid-cols-[1.5rem_1fr_2.25rem_4.25rem_4.25rem] gap-1.5 border-b border-border px-3 py-2 text-xs font-medium text-muted">
            <span>#</span>
            <span>Jugador</span>
            <span className="text-right">Pts</span>
            <span className="text-right">Ganado</span>
            <span className="text-right">Neto</span>
          </div>
          <ol>
            {pool.season.map((row) => (
              <li
                key={row.playerId}
                className={`grid grid-cols-[1.5rem_1fr_2.25rem_4.25rem_4.25rem] items-center gap-1.5 border-b border-border px-3 py-2.5 last:border-0 ${
                  row.playerId === player.id ? "bg-accent/10" : ""
                }`}
              >
                <span className="text-sm text-muted tabular-nums">{row.position}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{row.name}</span>
                  {row.jackpotPrize && (
                    <span
                      title={`Hoy se llevaría ${formatMoney(row.jackpotPrize.cents)} del acumulado`}
                      className="shrink-0 rounded-full border border-accent/50 px-1.5 py-0.5 text-[0.65rem] font-semibold text-accent"
                    >
                      {JACKPOT_LABEL[row.jackpotPrize.kind]}
                    </span>
                  )}
                </span>
                <span className="text-right font-semibold tabular-nums">{row.points}</span>
                <span className="text-right text-sm text-muted tabular-nums">{formatMoneyCompact(row.wonCents)}</span>
                <span
                  className={`text-right text-sm font-medium tabular-nums ${
                    row.netCents > 0 ? "text-emerald-600 dark:text-emerald-400" : row.netCents < 0 ? "text-red-500" : ""
                  }`}
                >
                  {formatNet(row.netCents)}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-2 text-xs text-muted">
          Ganado: premios semanales y bonos de jornada perfecta. Neto: lo ganado menos lo pagado
          ({formatMoneyCompact(pool.season[0]?.paidCents ?? 0)} en la temporada). El acumulado aún no cuenta;
          las etiquetas marcan quién se lo llevaría si la temporada terminara hoy.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Jornadas</h2>
        <ul className="mt-3 space-y-2">
          {rounds.map((round) => {
            const winners = round.results.filter((r) => r.prizeCents > 0);
            return (
              <li key={round.id}>
                <Link
                  href={`/quinielas/${pool.id}/jornadas/${round.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition hover:border-accent"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">{round.name}</span>
                      {!round.settled && (
                        <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[0.65rem] font-medium">
                          Pago pendiente
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-sm text-muted">
                      Gana {winners.map((w) => w.name).join(", ") || "—"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm font-medium tabular-nums">
                    {winners[0] ? formatMoney(winners[0].prizeCents) : "—"}
                    {winners.length > 1 && <span className="block text-xs text-muted">c/u</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
