import Link from "next/link";
import { notFound } from "next/navigation";
import { TIME_ZONE } from "@/domain";
import { getF1RoundDetail } from "@/lib/f1";
import type { PoolOverview } from "@/lib/pools";
import { F1PickForm } from "./f1-pick-form";
import { F1PicksGrid } from "./f1-picks-grid";
import { RoundResults } from "./round-results";

const dateFormat = new Intl.DateTimeFormat("es-MX", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

interface Props {
  pool: PoolOverview;
  roundId: string;
  currentPlayerId: string;
  manager: boolean;
}

/** An F1 Sprint or GP: P1–P10 picks until the lock, then everyone's picks and the result. */
export async function F1Round({ pool, roundId, currentPlayerId, manager }: Props) {
  const detail = await getF1RoundDetail(pool.id, roundId);
  if (!detail) notFound();
  const scored = pool.rounds.find((r) => r.id === roundId);
  const locked = !detail.event || detail.event.lockAt <= new Date();
  const enrolled = detail.players.some((p) => p.id === currentPlayerId);
  const cancelled = detail.status === "cancelled";

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <Link href={`/quinielas/${pool.id}`} className="text-sm text-muted hover:text-foreground">
        ← {pool.name}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{detail.name}</h1>
      {detail.event && (
        <p className="mt-1 text-muted">
          {detail.kind === "sprint" ? "Sprint" : "Carrera"}: {dateFormat.format(detail.event.startsAt)}
          {!locked && !cancelled && (
            <span className="block">
              Los pics cierran el {dateFormat.format(detail.event.lockAt)}
              {detail.kind === "sprint" && " (junto con el GP)"}
            </span>
          )}
        </p>
      )}

      {scored && <RoundResults round={scored} currentPlayerId={currentPlayerId} />}

      {cancelled && (
        <p className="mt-6 rounded-xl border border-dashed border-border px-4 py-6 text-center text-muted">
          Esta carrera se canceló: no se juega ni se paga.
        </p>
      )}

      {!scored && !cancelled && (!locked || manager) && (
        <div className="mt-6">
          {enrolled || manager ? (
            <F1PickForm
              poolId={pool.id}
              roundId={detail.id}
              drivers={detail.drivers}
              locked={locked}
              currentPlayerId={currentPlayerId}
              players={manager ? detail.players : undefined}
              picks={detail.picks}
              sprintPicks={detail.sprintPicks}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-muted">
              No estás inscrito en esta quiniela.
            </p>
          )}
          {detail.drivers.length === 0 && (
            <p className="mt-3 text-sm text-muted">Todavía no hay pilotos cargados para {detail.season}.</p>
          )}
        </div>
      )}

      <F1PicksGrid round={detail} currentPlayerId={currentPlayerId} />
    </main>
  );
}
