import Link from "next/link";
import type { Tally } from "@/domain";
import { formatMoneyCompact, formatNet } from "@/lib/format";
import type { PoolPickStats, PoolStats, StatsPlayer } from "@/lib/stats";
import { NetChart, PointsChart, StandingChart } from "./charts";
import { countRounds, pickerOptions, roundNoun, shortRoundLabel, SPORT_LABEL } from "./labels";
import { PlayerPicker } from "./player-picker";
import { Legend, toneOf } from "./summary";

const oneDecimal = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const listOf = new Intl.ListFormat("es-MX", { type: "conjunction" });

/** One player's season in one pool: round by round, standing, money and pick accuracy. */
export function PoolDetail({
  player,
  viewerId,
  players,
  pool,
  picks,
}: {
  player: StatsPlayer;
  viewerId: string;
  /** Everyone who plays this pool: the picker stays in it. */
  players: StatsPlayer[];
  pool: PoolStats;
  picks: PoolPickStats;
}) {
  const mine = player.id === viewerId;
  const options = pickerOptions(players, player, viewerId, (id) => `/estadisticas/${id}/${pool.id}`);
  const { standing, summary, rounds } = pool;
  const noun = roundNoun(pool.sport);
  const nouns = roundNoun(pool.sport, 2);
  const labels = rounds.map((r, i) => shortRoundLabel(r.name, i));
  const nameOf = new Map(rounds.map((r) => [r.roundId, r.name]));
  const names = (ids: string[]) => {
    const all = ids.map((id) => nameOf.get(id)!);
    return all.length > 3 ? `${all.slice(0, 2).join(", ")} y ${all.length - 2} más` : all.join(", ");
  };

  return (
    <main data-sport={pool.sport} className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <Link href={mine ? "/estadisticas" : `/estadisticas/${player.id}`} className="text-sm text-muted hover:text-foreground">
        ← {mine ? "Mis estadísticas" : `Estadísticas de ${player.name}`}
      </Link>
      <p className="mt-2 text-xs font-semibold tracking-wider text-sport uppercase">{SPORT_LABEL[pool.sport]}</p>
      <h1 className="text-2xl font-bold">{pool.name}</h1>
      <p className="mt-1 text-muted">
        {rounds.length > 0 && (
          <>
            {standing.position}° de {standing.participants}
            {standing.tied && " (empate)"} · {standing.points} pts ·{" "}
          </>
        )}
        <Link href={`/quinielas/${pool.id}`} className="underline underline-offset-2 hover:text-foreground">
          Ver quiniela
        </Link>
      </p>
      {options.length > 1 && <PlayerPicker key={player.id} options={options} currentId={player.id} />}

      {rounds.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border px-4 py-6 text-center text-muted">
          Aún no hay {nouns} terminadas.
        </p>
      ) : (
        <>
          <section className="mt-8">
            <h2>
              {noun} por {noun}
            </h2>
            <div className="mt-3 rounded-xl border border-border bg-surface px-2 pt-3 pb-2.5">
              <PointsChart
                label={`Puntos por ${noun} contra el promedio del grupo: ${rounds
                  .map((r) => `${r.name} ${r.points} (grupo ${oneDecimal.format(r.groupPoints / r.participants)})`)
                  .join(", ")}.`}
                bars={rounds.map((r, i) => ({
                  label: labels[i],
                  points: r.points,
                  groupAverage: r.groupPoints / r.participants,
                  won: r.won,
                }))}
              />
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs text-muted">
                <Legend dot="bg-sport/55">{mine ? "Tus puntos" : "Sus puntos"}</Legend>
                <Legend dot="bg-gold">{mine ? "Ganaste" : "Ganó"}</Legend>
                <li className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="inline-block h-0.5 w-3 bg-foreground" />
                  Promedio del grupo
                </li>
              </ul>
            </div>
            <details className="mt-2 rounded-xl border border-border bg-surface">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                Ver las {countRounds(pool.sport, rounds.length)}
              </summary>
              <div className="grid grid-cols-[1fr_2.25rem_2.75rem_4.5rem] gap-1.5 border-y border-border px-4 py-2 text-xs font-semibold tracking-wider text-muted uppercase">
                <span>{noun}</span>
                <span className="text-right">Pts</span>
                <span className="text-right">Lugar</span>
                <span className="text-right">Premio</span>
              </div>
              <ol>
                {rounds.map((round) => (
                  <li key={round.roundId} className="border-b border-border last:border-0">
                    <Link
                      href={`/quinielas/${pool.id}/jornadas/${round.roundId}`}
                      className={`grid grid-cols-[1fr_2.25rem_2.75rem_4.5rem] items-center gap-1.5 px-4 py-2 text-sm ${
                        round.won ? "bg-gold/15" : ""
                      }`}
                    >
                      <span className="truncate font-medium">{round.name}</span>
                      <span className="text-right font-display text-lg leading-none font-bold tabular-nums">{round.points}</span>
                      <span className="text-right text-muted tabular-nums">{round.position}°</span>
                      <span className="text-right text-muted tabular-nums">
                        {round.wonCents > 0 ? formatMoneyCompact(round.wonCents) : "—"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </details>
          </section>

          <dl className="mt-4 grid grid-cols-2 gap-2">
            <Stat label="Promedio" value={oneDecimal.format(summary.average)} note={`grupo ${oneDecimal.format(summary.groupAverage)}`} />
            <Stat
              label={`${nouns} ganadas`}
              value={`${summary.wins} de ${summary.rounds}`}
              note={
                summary.wins === 0
                  ? "Aún ninguna"
                  : `${summary.wins - summary.sharedWins} en solitario · ${summary.sharedWins} ${
                      summary.sharedWins === 1 ? "compartida" : "compartidas"
                    }`
              }
            />
            {summary.best && <Stat label={`Mejor ${noun}`} value={`${summary.best.points} pts`} note={names(summary.best.roundIds)} />}
            {summary.worst && <Stat label={`Peor ${noun}`} value={`${summary.worst.points} pts`} note={names(summary.worst.roundIds)} />}
            {summary.longestStreak && (
              <Stat
                wide
                label="Mejor racha en o arriba del promedio del grupo"
                value={countRounds(pool.sport, summary.longestStreak.length)}
                note={`${
                  summary.longestStreak.length === 1
                    ? nameOf.get(summary.longestStreak.fromRoundId)
                    : `${nameOf.get(summary.longestStreak.fromRoundId)} a ${nameOf.get(summary.longestStreak.toRoundId)}`
                } · racha actual: ${summary.currentStreak}`}
              />
            )}
          </dl>

          <section className="mt-8">
            <h2>Lugar en la tabla</h2>
            <div className="mt-3 rounded-xl border border-border bg-surface px-2 py-3">
              <StandingChart
                label={`Lugar en la tabla general después de cada ${noun}: ${rounds.map((r) => `${r.name} ${r.standing}°`).join(", ")}.`}
                standings={rounds.map((r) => r.standing)}
                participants={standing.participants}
                marks={standing.gaps.map((g) => g.position)}
                firstLabel={labels[0]}
                lastLabel={labels[labels.length - 1]}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              Después de cada {noun}. Las líneas punteadas son los lugares que cobran acumulado: 1°, 7° y penúltimo.
            </p>
          </section>

          <section className="mt-8">
            <h2>Neto</h2>
            <div className="mt-3 rounded-xl border border-border bg-surface px-4 py-3">
              <p className={`font-display text-4xl leading-none font-bold tabular-nums ${toneOf(pool.netCents)}`}>
                {formatNet(pool.netCents)}
              </p>
              <p className="mt-1.5 text-sm text-muted">
                Ganado {formatMoneyCompact(pool.wonCents)} · Pagado {formatMoneyCompact(pool.paidCents)}
              </p>
              <div className="-mx-2 mt-3">
                <NetChart
                  by="round"
                  label={`Neto acumulado después de cada ${noun}: ${rounds.map((r) => `${r.name} ${formatNet(r.netCents)}`).join(", ")}.`}
                  points={rounds.map((r, i) => ({ label: labels[i], cents: r.netCents, won: r.won }))}
                />
              </div>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <Legend dot="bg-gold">
                  <span className="first-letter:uppercase">{noun} ganada</span>
                </Legend>
              </ul>
            </div>
            <p className="mt-2 text-xs text-muted">
              Cada {noun} cuesta {formatMoneyCompact(rounds[0].feeCents)}. El acumulado aún no cuenta
              {pool.jackpotPrize
                ? `; si la temporada terminara hoy, ${mine ? "te llevarías" : "se llevaría"} ${formatMoneyCompact(pool.jackpotPrize.cents)}.`
                : "."}
            </p>
          </section>

          <section className="mt-8">
            <h2>Pics</h2>
            <PickSection picks={picks} pool={pool} />
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, note, wide }: { label: string; value: string; note: string; wide?: boolean }) {
  return (
    <div className={`rounded-xl border border-border bg-surface px-3 py-2.5 ${wide ? "col-span-2" : ""}`}>
      <dt className="text-xs text-muted first-letter:uppercase">{label}</dt>
      <dd className="mt-0.5">
        <span className="block font-display text-2xl leading-tight font-bold tabular-nums">{value}</span>
        <span className="block text-xs text-muted">{note}</span>
      </dd>
    </div>
  );
}

const SELECTION_ROWS = [
  ["home", "Local"],
  ["draw", "Empate"],
  ["away", "Visitante"],
] as const;

/** Pick accuracy, saying first which rounds it covers: imported rounds have no picks stored. */
function PickSection({ picks, pool }: { picks: PoolPickStats; pool: PoolStats }) {
  const total = pool.rounds.length;
  const covered = picks.covered.length;
  const { overall } = picks.stats;
  if (covered === 0 || overall.total === 0) {
    return (
      <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-muted">
        Ninguna {roundNoun(pool.sport)} terminada tiene pics guardados; por ahora solo hay puntos.
      </p>
    );
  }

  const rows: [label: string, tally: Tally][] =
    picks.sport === "f1"
      ? picks.stats.byPosition.map((tally, i) => [`P${i + 1}`, tally])
      : SELECTION_ROWS.filter(([selection]) => picks.sport !== "nfl" || selection !== "draw").map(([selection, label]) => [
          label,
          picks.stats.bySelection[selection],
        ]);

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface px-4 py-3">
      <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted">
        {covered === total
          ? `Basado en ${countRounds(pool.sport, total)}: todas las terminadas.`
          : `Solo ${covered} de ${countRounds(pool.sport, total)} ${covered === 1 ? "tiene" : "tienen"} pics guardados${
              covered <= 3 ? `: ${listOf.format(picks.covered)}` : ""
            }. Las demás solo tienen puntos.`}
      </p>
      <p className="mt-3 flex items-baseline justify-between gap-3">
        <span className="font-medium">Aciertos</span>
        <span>
          <span className="font-display text-2xl leading-none font-bold tabular-nums">{percent(overall)} %</span>{" "}
          <span className="text-sm text-muted tabular-nums">
            {overall.hits} de {overall.total}
          </span>
        </span>
      </p>
      <p className="mt-3 text-xs font-semibold tracking-wider text-muted uppercase">
        {picks.sport === "f1" ? "Por posición" : "Según lo elegido"}
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {rows.map(([label, tally]) => (
          <li key={label} className="grid grid-cols-[4.25rem_1fr_3.75rem] items-center gap-2 text-sm">
            <span className="text-muted">{label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-border">
              <span className="block h-full bg-sport" style={{ width: `${percent(tally)}%` }} />
            </span>
            <span className="text-right text-muted tabular-nums">{tally.total > 0 ? `${tally.hits} de ${tally.total}` : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function percent(tally: Tally): number {
  return tally.total > 0 ? Math.round((tally.hits / tally.total) * 100) : 0;
}
