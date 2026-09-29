import Link from "next/link";
import { TIME_ZONE } from "@/domain";
import { requirePlayer } from "@/lib/dal";
import { formatMoney } from "@/lib/format";
import { getOpenPeriod } from "@/lib/settlement";
import { SettleButton } from "./settle-button";

const dateFormat = new Intl.DateTimeFormat("es-MX", { timeZone: TIME_ZONE, day: "numeric", month: "long" });

export default async function MoneyPage() {
  const player = await requirePlayer();
  const period = await getOpenPeriod();

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Inicio
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Corte del mes</h1>

      {!period || period.rounds.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border px-4 py-6 text-center text-muted">
          No hay jornadas pendientes de cobrar.
        </p>
      ) : (
        <>
          <p className="mt-1 text-muted">
            Reunión del fin de semana del {dateFormat.format(period.cutoffAt)} ·{" "}
            {period.rounds.map((r) => r.name).join(", ")}
          </p>

          <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
            <Stat label="Se cobra" value={formatMoney(period.collectedCents)} />
            <Stat label="Premios" value={formatMoney(period.paidOutCents)} />
            <Stat label="Se guarda" value={formatMoney(period.keptCents)} />
          </dl>

          <section className="mt-8">
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Por persona</h2>
            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
              <div className="grid grid-cols-[1fr_4.5rem_4.5rem_5.5rem] gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted">
                <span>Jugador</span>
                <span className="text-right">Paga</span>
                <span className="text-right">Gana</span>
                <span className="text-right">Neto</span>
              </div>
              <ul>
                {period.lines.map((line) => (
                  <li
                    key={line.profileId}
                    className={`grid grid-cols-[1fr_4.5rem_4.5rem_5.5rem] items-center gap-2 border-b border-border px-3 py-2.5 text-sm last:border-0 ${
                      line.profileId === player.id ? "bg-accent/10" : ""
                    }`}
                  >
                    <span className="truncate font-medium">{line.name}</span>
                    <span className="text-right text-muted tabular-nums">{formatMoney(line.owesCents)}</span>
                    <span className="text-right text-muted tabular-nums">
                      {line.wonCents > 0 ? formatMoney(line.wonCents) : "—"}
                    </span>
                    <span
                      className={`text-right font-semibold tabular-nums ${line.netCents >= 0 ? "text-accent" : ""}`}
                    >
                      {line.netCents > 0 ? "+" : ""}
                      {formatMoney(line.netCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-2 text-xs text-muted">
              Neto positivo: cobra en la reunión. Negativo: paga. Lo que se guarda va al acumulado.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Jornadas del corte</h2>
            <ul className="mt-3 space-y-2">
              {period.rounds.map((round) => (
                <li key={round.id} className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
                  <p className="font-semibold">
                    {round.poolName} · {round.name}
                  </p>
                  <p className="text-muted">
                    {round.participants} jugadores · bolsa {formatMoney(round.potCents)} · premios{" "}
                    {formatMoney(round.prizesCents)} · acumulado {formatMoney(round.jackpotCents)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {player.isAdmin && (
            <div className="mt-8">
              <SettleButton periodId={period.id} />
            </div>
          )}
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-2 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
