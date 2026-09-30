import Link from "next/link";
import { notFound } from "next/navigation";
import { canManagePool, requirePlayer } from "@/lib/dal";
import { formatMoney } from "@/lib/format";
import { getPoolOverview } from "@/lib/pools";
import { getRoundDetail } from "@/lib/rounds";
import type { MatchOutcome } from "@/domain";
import { PickForm } from "./pick-form";
import { PicksGrid } from "./picks-grid";

const lockFormat = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

const title = (name: string) => name.replace(/^J(\d+)$/, "Jornada $1");

export default async function RoundPage({ params }: PageProps<"/quinielas/[poolId]/jornadas/[roundId]">) {
  const { poolId, roundId } = await params;
  const player = await requirePlayer();
  const [pool, detail, manager] = await Promise.all([
    getPoolOverview(poolId),
    getRoundDetail(poolId, roundId),
    canManagePool(poolId),
  ]);
  if (!detail) notFound();
  const round = pool.rounds.find((r) => r.id === roundId);

  if (!round) {
    const picks: Record<string, Record<string, MatchOutcome>> = {};
    for (const p of detail.picks) (picks[p.playerId] ??= {})[p.eventId] = p.selection;
    const enrolled = detail.players.some((p) => p.id === player.id);
    const firstLock = new Date(Math.min(...detail.events.map((e) => e.lockAt.getTime())));
    const now = new Date();
    const sameLock = detail.events.every((e) => e.lockAt.getTime() === firstLock.getTime());

    return (
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
        <Link href={`/quinielas/${pool.id}`} className="text-sm text-muted hover:text-foreground">
          ← {pool.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{title(detail.name)}</h1>
        <p className="mt-1 text-muted">
          {sameLock
            ? `Los pics cierran el ${lockFormat.format(firstLock)}`
            : "Cada partido cierra 5 minutos antes de empezar"}
        </p>

        <div className="mt-6">
          {enrolled || manager ? (
            <PickForm
              poolId={pool.id}
              roundId={detail.id}
              allowDraw={detail.sport !== "nfl"}
              currentPlayerId={player.id}
              players={manager ? detail.players : undefined}
              picks={picks}
              events={detail.events.map((e) => ({
                id: e.id,
                home: e.home,
                away: e.away,
                startsAt: e.startsAt.toISOString(),
                locked: e.lockAt <= now,
              }))}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-muted">
              No estás inscrito en esta quiniela.
            </p>
          )}
        </div>

        <PicksGrid round={detail} currentPlayerId={player.id} />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <Link href={`/quinielas/${pool.id}`} className="text-sm text-muted hover:text-foreground">
        ← {pool.name}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{title(round.name)}</h1>

      <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
        <Stat label="Bolsa" value={formatMoney(round.potCents)} />
        <Stat label="Premio" value={formatMoney(round.potCents - round.jackpotCents)} />
        <Stat label="Al acumulado" value={formatMoney(round.jackpotCents)} />
      </dl>
      {!round.settled && (
        <p className="mt-3 text-center text-sm text-muted">Se liquida en la próxima reunión.</p>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="grid grid-cols-[2rem_1fr_3rem_5.5rem] gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted">
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
                r.playerId === player.id ? "bg-accent/10" : ""
              }`}
            >
              <span className="text-sm text-muted tabular-nums">{r.position}</span>
              <span className="truncate font-medium">{r.name}</span>
              <span className="text-right font-semibold tabular-nums">{r.points}</span>
              <span className={`text-right text-sm tabular-nums ${r.prizeCents + r.bonusCents > 0 ? "font-semibold text-accent" : "text-muted"}`}>
                {r.prizeCents + r.bonusCents > 0 ? formatMoney(r.prizeCents + r.bonusCents) : "—"}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <PicksGrid round={detail} currentPlayerId={player.id} />
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
