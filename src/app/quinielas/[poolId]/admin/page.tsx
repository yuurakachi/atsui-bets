import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TIME_ZONE } from "@/domain";
import { canManagePool } from "@/lib/dal";
import { playerName } from "@/lib/format";
import { reminderMessage, roundTitle } from "@/lib/reminders";
import { getOpenRoundsProgress } from "@/lib/rounds";
import { createClient } from "@/lib/supabase/server";
import { upcomingWeekend } from "./dates";
import { PlayerRow } from "./player-row";
import { ReminderCard } from "./reminder-card";
import { ResultsUpdater, RoundLoader } from "./round-loader";

const isoDay = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });

export default async function PoolAdminPage({ params }: PageProps<"/quinielas/[poolId]/admin">) {
  const { poolId } = await params;
  if (!(await canManagePool(poolId))) notFound();

  const supabase = await createClient();
  const [{ data: pool }, { data: rounds }, { data: enrollments }, openRounds, requestHeaders] = await Promise.all([
    supabase.from("pools").select("id, name, sport").eq("id", poolId).single(),
    supabase
      .from("rounds")
      .select("id, name, ordinal, status, events(external_id, starts_at)")
      .eq("pool_id", poolId)
      .order("ordinal"),
    supabase
      .from("enrollments")
      .select("player:players(id, display_name, nickname, email, user_id)")
      .eq("pool_id", poolId),
    getOpenRoundsProgress(poolId),
    headers(),
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
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const origin = host ? `${requestHeaders.get("x-forwarded-proto") ?? "https"}://${host}` : "";

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <Link href={`/quinielas/${pool.id}`} className="text-sm text-muted hover:text-foreground">
        ← {pool.name}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Administrar</h1>

      <section className="mt-6">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Recordatorios</h2>
        {openRounds.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No hay jornadas con pics abiertos.</p>
        ) : (
          <>
            <p className="mt-1 mb-3 text-sm text-muted">
              Manda el mensaje al grupo de WhatsApp. Solo dice quién falta, nunca los pics de nadie.
            </p>
            <div className="space-y-2">
              {openRounds.map((round) => {
                const done = round.players - round.missing.length;
                return (
                  <ReminderCard
                    key={round.id}
                    title={roundTitle(round.name)}
                    status={round.missing.length === 0 ? "✓ Todos listos" : `${done} de ${round.players} listos`}
                    message={reminderMessage({
                      sport: pool.sport,
                      poolName: pool.name,
                      roundName: round.name,
                      lockAt: round.firstLockAt,
                      url: origin,
                      missing: round.missing,
                      openEvents: round.openEvents,
                      players: round.players,
                    })}
                  />
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="mt-8">
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
