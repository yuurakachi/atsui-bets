import Link from "next/link";
import { notFound } from "next/navigation";
import { canManagePool, requirePlayer } from "@/lib/dal";
import { getPoolOverview } from "@/lib/pools";
import { getRoundDetail } from "@/lib/rounds";
import type { MatchOutcome } from "@/domain";
import { F1Round } from "./f1-round";
import { PickForm } from "./pick-form";
import { PicksGrid } from "./picks-grid";
import { RoundResults } from "./round-results";

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
  if (pool.sport === "f1") {
    return <F1Round pool={pool} roundId={roundId} currentPlayerId={player.id} manager={manager} />;
  }
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
      <main data-sport={pool.sport} className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
        <Link href={`/quinielas/${pool.id}`} className="text-sm text-muted hover:text-foreground">
          ← {pool.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{title(detail.name)}</h1>
        <p className="mt-1 text-muted">
          {sameLock
            ? `Los pics cierran el ${lockFormat.format(firstLock)}`
            : "Cada juego cierra 5 minutos antes de empezar; puedes cambiar tus pics hasta entonces."}
        </p>

        <div className="mt-6">
          {enrolled || manager ? (
            <PickForm
              poolId={pool.id}
              roundId={detail.id}
              nfl={detail.sport === "nfl"}
              now={now.getTime()}
              currentPlayerId={player.id}
              players={manager ? detail.players : undefined}
              picks={picks}
              events={detail.events.map((e) => ({
                id: e.id,
                home: e.home,
                away: e.away,
                startsAt: e.startsAt.toISOString(),
                lockAt: e.lockAt.toISOString(),
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
    <main data-sport={pool.sport} className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <Link href={`/quinielas/${pool.id}`} className="text-sm text-muted hover:text-foreground">
        ← {pool.name}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{title(round.name)}</h1>

      <RoundResults round={round} currentPlayerId={player.id} />

      <PicksGrid round={detail} currentPlayerId={player.id} />
    </main>
  );
}
