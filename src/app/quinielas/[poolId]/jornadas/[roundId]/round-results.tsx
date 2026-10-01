import { formatMoney } from "@/lib/format";
import type { PoolRound } from "@/lib/pools";

/** Pot, prize and standings of a scored round. */
export function RoundResults({ round, currentPlayerId }: { round: PoolRound; currentPlayerId: string }) {
  return (
    <>
      <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
        <Stat label="Bolsa" value={formatMoney(round.potCents)} />
        <Stat label="Premio" value={formatMoney(round.potCents - round.jackpotCents)} />
        <Stat label="Al acumulado" value={formatMoney(round.jackpotCents)} />
      </dl>
      {!round.settled && (
        <p className="mt-3 text-center text-sm text-muted">Se liquida en la próxima reunión.</p>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="grid grid-cols-[2rem_1fr_3rem_5.5rem] gap-2 border-b border-border px-3 py-2 text-xs font-semibold tracking-wider text-muted uppercase">
          <span>#</span>
          <span>Jugador</span>
          <span className="text-right">Pts</span>
          <span className="text-right">Premio</span>
        </div>
        <ol>
          {round.results.map((r) => (
            <li
              key={r.playerId}
              className={`grid grid-cols-[2rem_1fr_3rem_5.5rem] items-center gap-2 border-b border-border px-3 py-2.5 last:border-0 ${
                r.playerId === currentPlayerId ? "bg-gold/15" : ""
              }`}
            >
              <span className="text-sm text-muted tabular-nums">{r.position}</span>
              <span className="truncate font-medium">{r.name}</span>
              <span className="text-right font-display text-xl leading-none font-bold tabular-nums">{r.points}</span>
              <span className={`text-right text-sm tabular-nums ${r.prizeCents + r.bonusCents > 0 ? "font-semibold text-gold" : "text-muted"}`}>
                {r.prizeCents + r.bonusCents > 0 ? formatMoney(r.prizeCents + r.bonusCents) : "—"}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-2 py-3">
      <dt className="text-[0.65rem] font-semibold tracking-wider text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 font-display text-xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}
