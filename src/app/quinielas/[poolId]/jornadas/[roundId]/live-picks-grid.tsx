"use client";

import { useEffect, useState } from "react";
import { TIME_ZONE, type MatchOutcome, type MatchResult, type Sport } from "@/domain";
import { fetchMatches, type EspnMatch } from "@/lib/espn";
import { liveOutcome } from "@/lib/live";
import { teamBadge } from "@/lib/teams";

const POLL_MS = 60_000;
/** Keep polling a match that should have started but ESPN still shows as upcoming. */
const START_GRACE_MS = 10 * 60_000;

interface GridEvent {
  id: string;
  number: number;
  externalId: string | null;
  home: string;
  away: string;
  startsAt: string;
  /** Official result saved by an admin. */
  result: MatchResult | null;
}

interface Props {
  sport: Sport;
  events: GridEvent[];
  players: { id: string; name: string }[];
  picks: { eventId: string; playerId: string; selection: MatchOutcome }[];
  currentPlayerId: string;
}

const day = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
const nextDay = (iso: string) => {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

/** Everyone's picks, marked against official results or live ESPN scores. */
export function LivePicksGrid({ sport, events, players, picks, currentPlayerId }: Props) {
  const [live, setLive] = useState<Map<string, EspnMatch>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const pending = events.filter((e) => !e.result && e.externalId);
    if (pending.length === 0) return;
    const dates = pending.map((e) => day(new Date(e.startsAt))).sort();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let matches = new Map<string, EspnMatch>();

    const stillPlaying = () =>
      pending.some(
        (e) =>
          matches.get(e.externalId!)?.state !== "post" &&
          new Date(e.startsAt).getTime() <= Date.now() + START_GRACE_MS,
      );

    // Polls while a match is on; paused while the tab is hidden.
    const tick = async () => {
      clearTimeout(timer);
      try {
        const found = await fetchMatches(sport, dates[0], nextDay(dates.at(-1)!));
        matches = new Map(found.map((m) => [m.externalId, m]));
        if (!stopped) setLive(matches);
      } catch {
        // ESPN unavailable: keep showing what we have.
      }
      if (!stopped && !document.hidden && stillPlaying()) timer = setTimeout(tick, POLL_MS);
    };
    const onVisible = () => {
      if (!document.hidden && stillPlaying()) void tick();
      else clearTimeout(timer);
    };

    void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sport, events]);

  const outcomes = new Map(events.map((e) => [e.id, liveOutcome(e.result, e.externalId ? live.get(e.externalId) : undefined)]));
  const pickOf = new Map(picks.map((p) => [`${p.playerId}:${p.eventId}`, p.selection]));
  const isHit = (playerId: string, eventId: string) => {
    const known = outcomes.get(eventId);
    const pick = pickOf.get(`${playerId}:${eventId}`);
    return !!known && !!pick && known.outcome !== "void" && known.outcome === pick;
  };

  const anyKnown = [...outcomes.values()].some(Boolean);
  const anyLive = [...outcomes.values()].some((o) => o && !o.final);
  const rows = players
    .map((player) => ({ ...player, points: events.filter((e) => isHit(player.id, e.id)).length }))
    .sort((a, b) => (anyKnown ? b.points - a.points : 0) || a.name.localeCompare(b.name));
  const columns = `4.5rem repeat(${events.length}, minmax(1.375rem, 1fr)) 1.75rem`;
  const matchOf = (e: GridEvent) => (e.externalId ? live.get(e.externalId) : undefined);
  const selectedEvent = events.find((e) => e.id === selected);

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted uppercase">
        Pics de todos
        {anyLive && (
          <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[0.65rem] font-bold text-red-500">
            <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
            EN VIVO
          </span>
        )}
      </h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface">
        <div className="min-w-fit">
          <div className="grid items-end gap-0.5 border-b border-border px-2 py-2 text-xs font-medium text-muted" style={{ gridTemplateColumns: columns }}>
            <span>Jugador</span>
            {events.map((e) => {
              const match = matchOf(e);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setSelected(selected === e.id ? null : e.id)}
                  aria-label={`${e.home} contra ${e.away}`}
                  aria-pressed={selected === e.id}
                  className={`flex flex-col items-center gap-0.5 rounded py-0.5 ${selected === e.id ? "bg-accent/20" : ""}`}
                >
                  <Badge team={e.home} />
                  <Badge team={e.away} />
                  <span className={`text-[0.6rem] leading-3 tabular-nums ${match?.state === "in" ? "font-bold text-red-500" : ""}`}>
                    {match?.score ? `${match.score.home}-${match.score.away}` : " "}
                  </span>
                </button>
              );
            })}
            <span className="text-right">Pts</span>
          </div>
          {selectedEvent && (
            <p className="border-b border-border bg-accent/10 px-2 py-1.5 text-center text-xs">
              <MatchLine event={selectedEvent} match={matchOf(selectedEvent)} outcome={outcomes.get(selectedEvent.id)} />
            </p>
          )}
          {rows.map((player) => (
            <div
              key={player.id}
              className={`grid items-center gap-0.5 border-b border-border px-2 py-1 text-sm last:border-0 ${
                player.id === currentPlayerId ? "bg-accent/10" : ""
              }`}
              style={{ gridTemplateColumns: columns }}
            >
              <span className="truncate font-medium">{player.name}</span>
              {events.map((e) => {
                const pick = pickOf.get(`${player.id}:${e.id}`);
                const known = outcomes.get(e.id);
                const hit = isHit(player.id, e.id);
                const style = !pick || !known
                  ? ""
                  : hit
                    ? known.final
                      ? "bg-emerald-500/30 ring-1 ring-emerald-500 ring-inset"
                      : "ring-1 ring-emerald-500 ring-inset"
                    : known.final
                      ? "opacity-45 grayscale"
                      : "opacity-60";
                return (
                  <span key={e.id} className={`flex h-7 items-center justify-center rounded ${style}`}>
                    {!pick ? (
                      <span className="text-muted">·</span>
                    ) : pick === "draw" ? (
                      <span title="Empate" className="text-xs font-bold">E</span>
                    ) : (
                      <Badge team={pick === "home" ? e.home : e.away} />
                    )}
                  </span>
                );
              })}
              <span className="text-right font-semibold tabular-nums">{player.points}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        Arriba, local y visitante de cada partido; toca una columna para ver el partido. Cada casilla es
        el equipo que escogió (E = empate).
        {anyKnown &&
          " Verde relleno: acertó. Solo borde verde: va acertando en vivo. Apagado: falló. Los puntos oficiales quedan cuando el admin actualiza resultados."}
      </p>
      <ol className="mt-3 grid gap-x-4 gap-y-0.5 text-xs text-muted sm:grid-cols-2">
        {events.map((e) => (
          <li key={e.id}>
            <MatchLine event={e} match={matchOf(e)} outcome={outcomes.get(e.id)} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Team badge, falling back to the abbreviation when there's no image. */
function Badge({ team }: { team: string }) {
  const badge = teamBadge(team);
  const [failed, setFailed] = useState(false);
  if (!badge.logo || failed) {
    return <span className="text-[0.6rem] leading-[1.125rem] font-bold tracking-tighter text-foreground">{badge.abbr}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny remote badges; not worth the image optimizer
    <img
      src={badge.logo}
      alt={team}
      title={team}
      width={18}
      height={18}
      onError={() => setFailed(true)}
      className="size-[1.125rem] object-contain"
    />
  );
}

function MatchLine({
  event,
  match,
  outcome,
}: {
  event: GridEvent;
  match: EspnMatch | undefined;
  outcome: ReturnType<typeof liveOutcome> | undefined;
}) {
  const result = outcome?.final ? outcome.outcome : null;
  return (
    <>
      {event.home}
      {match?.score ? ` ${match.score.home}–${match.score.away} ` : " vs "}
      {event.away}
      {match?.state === "in" && <span className="font-medium text-red-500"> · {match.clock}</span>}
      {result && (
        <span className="text-foreground">
          {" · "}
          {result === "void" ? "no cuenta" : result === "draw" ? "empate" : `ganó ${result === "home" ? event.home : event.away}`}
        </span>
      )}
    </>
  );
}
