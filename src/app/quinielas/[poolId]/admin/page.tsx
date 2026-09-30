import Link from "next/link";
import { notFound } from "next/navigation";
import { TIME_ZONE } from "@/domain";
import { canManagePool } from "@/lib/dal";
import { getF1Drivers } from "@/lib/f1";
import { createClient } from "@/lib/supabase/server";
import { playerName } from "@/lib/format";
import { upcomingWeekend } from "./dates";
import { F1DriverList, F1ResultsCard, F1SeasonLoader } from "./f1-admin";
import { PlayerRow } from "./player-row";
import { ResultsUpdater, RoundLoader } from "./round-loader";

const isoDay = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });

export default async function PoolAdminPage({ params }: PageProps<"/quinielas/[poolId]/admin">) {
  const { poolId } = await params;
  if (!(await canManagePool(poolId))) notFound();

  const supabase = await createClient();
  const [{ data: pool }, { data: rounds }, { data: enrollments }] = await Promise.all([
    supabase.from("pools").select("id, name, sport, season").eq("id", poolId).single(),
    supabase
      .from("rounds")
      .select("id, name, ordinal, status, events(id, external_id, starts_at), period:settlement_periods(settled_at)")
      .eq("pool_id", poolId)
      .order("ordinal"),
    supabase
      .from("enrollments")
      .select("player:players(id, display_name, nickname, email, user_id)")
      .eq("pool_id", poolId),
  ]);
  if (!pool) notFound();

  const last = rounds?.at(-1);
  const nextName = pool.sport === "nfl" ? `Semana ${(last?.ordinal ?? 0) + 1}` : `J${(last?.ordinal ?? 0) + 1}`;
  const weekend = upcomingWeekend(new Date());
  const pending = (rounds ?? []).filter((r) => r.status === "scheduled" && r.events.length > 0);
  const players = (enrollments ?? [])
    .flatMap((e) => (e.player ? [e.player] : []))
    .map((p) => ({ id: p.id, nickname: playerName(p), email: p.email, signedIn: p.user_id !== null }))
    .sort((a, b) => a.nickname.localeCompare(b.nickname));
  const withoutEmail = players.filter((p) => !p.email).length;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <Link href={`/quinielas/${pool.id}`} className="text-sm text-muted hover:text-foreground">
        ← {pool.name}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Administrar</h1>

      {pool.sport === "f1" ? (
        <F1Admin poolId={pool.id} season={pool.season} rounds={rounds ?? []} />
      ) : (
        <>
        <section className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Cargar jornada</h2>
          <p className="mt-1 mb-3 text-sm text-muted">
            Busca los partidos de la próxima jornada en ESPN, revísalos y crea la jornada. Los pics
            cierran solos según las reglas.
          </p>
          <RoundLoader poolId={pool.id} sport={pool.sport} nextName={nextName} from={weekend.from} to={weekend.to} />
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Resultados</h2>
          {pending.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No hay jornadas esperando resultados.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {pending.map((round) => {
                const starts = round.events.map((e) => new Date(e.starts_at).getTime());
                const oneDay = 24 * 60 * 60 * 1000;
                return (
                  <ResultsUpdater
                    key={round.id}
                    poolId={pool.id}
                    sport={pool.sport}
                    roundId={round.id}
                    name={round.name}
                    externalIds={round.events.flatMap((e) => (e.external_id ? [e.external_id] : []))}
                    from={isoDay(new Date(Math.min(...starts) - oneDay))}
                    to={isoDay(new Date(Math.max(...starts) + oneDay))}
                  />
                );
              })}
            </div>
          )}
        </section>
        </>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Jugadores</h2>
        <p className="mt-1 mb-3 text-sm text-muted">
          Pon el correo de Google de cada quien. La primera vez que entre con ese correo, su cuenta queda
          ligada a su jugador.{withoutEmail > 0 && ` Faltan ${withoutEmail} por correo.`}
        </p>
        <ul className="rounded-xl border border-border bg-surface">
          {players.map((p) => (
            <PlayerRow key={p.id} poolId={pool.id} player={p} />
          ))}
        </ul>
      </section>
    </main>
  );
}

interface AdminRound {
  id: string;
  name: string;
  status: "scheduled" | "completed" | "cancelled";
  events: { id: string; external_id: string | null; starts_at: string }[];
  period: { settled_at: string | null } | null;
}

async function F1Admin({ poolId, season, rounds }: { poolId: string; season: string; rounds: AdminRound[] }) {
  const supabase = await createClient();
  const unsettled = rounds.filter((r) => r.status === "completed" && !r.period?.settled_at);
  const [drivers, { data: classified }] = await Promise.all([
    getF1Drivers(season),
    supabase
      .from("f1_classification")
      .select("event_id")
      .eq("position", 1)
      .in("event_id", unsettled.flatMap((r) => r.events.map((e) => e.id))),
  ]);
  const scoredInApp = new Set((classified ?? []).map((c) => c.event_id));
  const now = new Date().getTime();
  const started = (r: AdminRound) => r.events.some((e) => new Date(e.starts_at).getTime() <= now);
  // Waiting for results, then rounds scored in the app whose money isn't settled yet (they
  // can still be re-scored). Rounds imported from before the app have no picks to re-score.
  const results = [
    ...rounds.filter((r) => r.status === "scheduled" && started(r)),
    ...unsettled.filter((r) => r.events.some((e) => scoredInApp.has(e.id))).reverse(),
  ];
  const upcoming = rounds.filter((r) => r.status === "scheduled" && !started(r));

  return (
    <>
      <section className="mt-6">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Temporada {season}</h2>
        <p className="mt-1 mb-3 text-sm text-muted">
          {upcoming.length > 0
            ? `${upcoming.length} jornadas por correr; sigue ${upcoming[0].name}.`
            : "No hay jornadas por correr cargadas."}{" "}
          Cargar de nuevo agrega lo que falte y actualiza horarios; no toca pics ni resultados.
        </p>
        <F1SeasonLoader poolId={poolId} season={season} />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Resultados</h2>
        <p className="mt-1 mb-3 text-sm text-muted">
          Importa la clasificación oficial después de cada carrera. Si cambia (sanción, descalificación),
          reimporta antes del corte.
        </p>
        {results.length === 0 ? (
          <p className="text-sm text-muted">No hay carreras esperando resultados.</p>
        ) : (
          <div className="space-y-2">
            {results.map((round) => (
              <F1ResultsCard
                key={round.id}
                poolId={poolId}
                roundId={round.id}
                name={round.name}
                externalId={round.events[0]?.external_id ?? null}
                scored={round.status === "completed"}
                drivers={drivers}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Pilotos</h2>
        <p className="mt-1 mb-3 text-sm text-muted">
          Solo los marcados salen al hacer pics. Se actualizan con la última carrera al cargar la temporada.
        </p>
        {drivers.length === 0 ? (
          <p className="text-sm text-muted">Carga la temporada para traer a los pilotos.</p>
        ) : (
          <F1DriverList poolId={poolId} drivers={drivers} />
        )}
      </section>
    </>
  );
}
