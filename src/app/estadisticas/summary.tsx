import Link from "next/link";
import { netByMeeting, TIME_ZONE, type StandingSummary } from "@/domain";
import { formatMoneyCompact, formatNet } from "@/lib/format";
import type { PoolStats, StatsPlayer } from "@/lib/stats";
import { NetChart } from "./charts";
import { countRounds, JACKPOT_LABEL, roundNoun } from "./labels";

const meetingDate = new Intl.DateTimeFormat("es-MX", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
const meetingMonth = new Intl.DateTimeFormat("es-MX", { timeZone: TIME_ZONE, month: "short" });

export const toneOf = (cents: number) => (cents > 0 ? "text-positive" : cents < 0 ? "text-negative" : "");

/** Every pool a player is in: total net, what the next meeting holds, and one card per pool. */
export function StatsSummary({ player, mine, pools }: { player: StatsPlayer; mine: boolean; pools: PoolStats[] }) {
  const wonCents = pools.reduce((acc, p) => acc + p.wonCents, 0);
  const paidCents = pools.reduce((acc, p) => acc + p.paidCents, 0);
  const netCents = wonCents - paidCents;
  const meetings = netByMeeting(pools.flatMap((p) => p.money));
  const dueCents = pools.reduce((acc, p) => acc + (p.nextMeeting?.netCents ?? 0), 0);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Inicio
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{mine ? "Mis estadísticas" : `Estadísticas de ${player.name}`}</h1>

      {pools.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border px-4 py-6 text-center text-muted">
          {mine ? "Aún no estás inscrito en ninguna quiniela." : `${player.name} no juega ninguna quiniela.`}
        </p>
      ) : (
        <>
          <section className="mt-6 rounded-2xl border border-border bg-surface px-5 py-4">
            <p className="text-sm font-medium text-muted">Neto total</p>
            <p className={`font-display text-5xl leading-none font-bold tabular-nums ${toneOf(netCents)}`}>
              {formatNet(netCents)}
            </p>
            <p className="mt-1.5 text-sm text-muted">
              Ganado {formatMoneyCompact(wonCents)} · Pagado {formatMoneyCompact(paidCents)}
            </p>
            {meetings.length > 0 && (
              <>
                <div className="-mx-3 mt-4">
                  <NetChart
                    by="meeting"
                    label={`Neto acumulado después de cada reunión: ${meetings
                      .map((m) => `${m.cutoffAt ? meetingDate.format(m.cutoffAt) : "sin corte"} ${formatNet(m.cumulativeCents)}`)
                      .join(", ")}.`}
                    points={meetings.map((m) => ({
                      label: m.cutoffAt ? meetingMonth.format(m.cutoffAt).replace(".", "") : "—",
                      cents: m.cumulativeCents,
                      pending: !m.settled,
                    }))}
                  />
                </div>
                <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <Legend dot="bg-positive">{mine ? "Cobraste" : "Cobró"}</Legend>
                  <Legend dot="bg-negative">{mine ? "Pagaste" : "Pagó"}</Legend>
                  {meetings.some((m) => !m.settled) && <Legend dot="border-2 border-muted">Pendiente</Legend>}
                </ul>
                <p className="mt-2 text-xs text-muted">Un punto por reunión mensual. El acumulado aún no cuenta.</p>
              </>
            )}
          </section>

          <section className="mt-8">
            <h2>Próxima reunión</h2>
            {pools.every((p) => !p.nextMeeting) ? (
              <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-muted">
                No hay jornadas pendientes de cobrar.
              </p>
            ) : (
              <>
                <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
                  <ul>
                    {pools.map((pool) => (
                      <li key={pool.id} className="border-b border-border">
                        <Link
                          href={`/quinielas/${pool.id}/corte`}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 transition hover:bg-gold/10"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{pool.name}</span>
                            <span className="block text-sm text-muted">
                              {pool.nextMeeting
                                ? `Corte del ${meetingDate.format(pool.nextMeeting.cutoffAt)} · ${countRounds(pool.sport, pool.nextMeeting.rounds)}`
                                : "Nada pendiente"}
                            </span>
                          </span>
                          {pool.nextMeeting ? (
                            <span
                              className={`shrink-0 font-display text-lg font-semibold tabular-nums ${toneOf(pool.nextMeeting.netCents)}`}
                            >
                              {formatNet(pool.nextMeeting.netCents)}
                            </span>
                          ) : (
                            <span className="shrink-0 text-muted">—</span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="flex items-center justify-between gap-3 bg-gold/15 px-4 py-2.5">
                    <span className="font-semibold">
                      {dueCents === 0 ? "Sale a mano" : `${mine ? "Te" : "Le"} toca ${dueCents > 0 ? "cobrar" : "pagar"}`}
                    </span>
                    <span className={`font-display text-xl font-bold tabular-nums ${toneOf(dueCents)}`}>
                      {formatMoneyCompact(Math.abs(dueCents))}
                    </span>
                  </p>
                </div>
                <p className="mt-2 text-xs text-muted">Cada quiniela se paga por separado con su subadmin.</p>
              </>
            )}
          </section>

          <section className="mt-8">
            <h2>{mine ? "Tus quinielas" : "Sus quinielas"}</h2>
            <ul className="mt-3 space-y-2">
              {pools.map((pool) => (
                <li key={pool.id}>
                  <PoolCard pool={pool} playerId={player.id} mine={mine} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

export function Legend({ dot, children }: { dot: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`inline-block size-2 rounded-full ${dot}`} />
      {children}
    </li>
  );
}

function PoolCard({ pool, playerId, mine }: { pool: PoolStats; playerId: string; mine: boolean }) {
  const { standing } = pool;
  return (
    <Link
      href={`/estadisticas/${playerId}/${pool.id}`}
      data-sport={pool.sport}
      className="block rounded-xl border border-l-4 border-border border-l-sport bg-surface px-4 py-3 transition hover:border-accent hover:border-l-sport"
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-xs font-semibold tracking-wider text-sport uppercase">{pool.name}</span>
        <span className="shrink-0 text-sm text-muted">
          {countRounds(pool.sport, pool.rounds.length)} <span aria-hidden="true">→</span>
        </span>
      </span>

      {pool.rounds.length === 0 ? (
        <span className="mt-2 block text-sm text-muted">Aún no hay {roundNoun(pool.sport, 2)} terminadas.</span>
      ) : (
        <>
          <span className="mt-1 flex items-baseline justify-between gap-3">
            <span className="font-display text-2xl leading-tight font-bold uppercase">
              {standing.position}° de {standing.participants}
              {standing.tied && " "}
              {standing.tied && <span className="font-sans text-xs font-normal text-muted normal-case">empate</span>}
            </span>
            <span className="font-display text-2xl leading-tight font-bold tabular-nums">{standing.points} pts</span>
          </span>

          <span className="mt-2 grid grid-cols-3 gap-1.5">
            {gapCells(standing).map((cell) => (
              <span
                key={cell.label}
                className={`rounded-lg border border-border px-1 py-1.5 text-center ${cell.held ? "bg-gold/15" : ""}`}
              >
                <span className="block truncate text-xs text-muted">{cell.label}</span>
                <span className={`block font-display text-xl leading-tight font-bold tabular-nums ${cell.behind ? "text-negative" : ""}`}>
                  {cell.value}
                </span>
              </span>
            ))}
          </span>

          <span className="mt-2.5 flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">
              Neto <span className={`font-semibold tabular-nums ${toneOf(pool.netCents)}`}>{formatNet(pool.netCents)}</span>
            </span>
            {pool.jackpotPrize ? (
              <span className="rounded-full border border-gold/60 px-2 py-0.5 text-xs font-semibold text-gold">
                {JACKPOT_LABEL[pool.jackpotPrize.kind]} · hoy {formatMoneyCompact(pool.jackpotPrize.cents)}
              </span>
            ) : (
              <span className="text-muted">Acumulado: hoy no {mine ? "te" : "le"} toca</span>
            )}
          </span>
        </>
      )}
    </Link>
  );
}

const GAP_LABEL = { winner: "1°", lucky_seven: "7°", bobby: "Penúlt." } as const;

/** Points away from each jackpot position; a lone leader sees who is chasing instead. */
function gapCells(standing: StandingSummary) {
  const signed = (diff: number) => (diff > 0 ? `+${diff}` : String(diff));
  return standing.gaps.map((gap) => {
    if (gap.kind === "winner" && standing.chaser) {
      const { position, points, diff } = standing.chaser;
      return { label: `${position}° · ${points}`, value: signed(diff), held: true, behind: false };
    }
    return {
      label: `${GAP_LABEL[gap.kind]} · ${gap.points}`,
      value: gap.diff !== 0 ? signed(gap.diff) : gap.kind === "winner" && standing.tied ? "Empate" : "Aquí",
      held: gap.diff === 0,
      behind: gap.kind === "winner" && gap.diff < 0,
    };
  });
}
