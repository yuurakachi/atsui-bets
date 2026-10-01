"use client";

import { useEffect, useState } from "react";
import { TIME_ZONE, type MatchOutcome, type MatchResult, type Sport } from "@/domain";
import { fetchMatches, type EspnMatch } from "@/lib/espn";
import { liveOutcome } from "@/lib/live";
import { kickoffSlots } from "@/lib/slots";
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
  /** Kickoff window picked by hand; until then, the latest one that locked. */
  const [chosenSlot, setChosenSlot] = useState<string | null>(null);

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
  // Points are always the whole round's, whichever window is on screen.
  const rows = players
    .map((player) => ({ ...player, points: events.filter((e) => isHit(player.id, e.id)).length }))
    .sort((a, b) => (anyKnown ? b.points - a.points : 0) || a.name.localeCompare(b.name));
  const matchOf = (e: GridEvent) => (e.externalId ? live.get(e.externalId) : undefined);

  // An NFL week doesn't fit on a phone: show one kickoff window at a time.
  const nfl = sport === "nfl";
  const slots = nfl ? kickoffSlots(events) : [];
  const slot = slots.find((s) => s.key === chosenSlot) ?? slots.at(-1);
  const shown = slot ? slot.events : events;
  const isLive = (e: GridEvent) => matchOf(e)?.state === "in";
  const columns = `4.5rem repeat(${shown.length}, minmax(1.375rem, 1fr)) 1.75rem`;
  const selectedEvent = shown.find((e) => e.id === selected);
  /** Teams in the order they are shown: visitor first in the NFL. */
  const sides = (e: GridEvent) => (nfl ? [e.away, e.home] : [e.home, e.away]);

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted uppercase">
        Pics de todos
        {anyLive && (
          <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 font-sans text-[0.65rem] font-bold tracking-normal text-accent">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" />
            EN VIVO
          </span>
        )}
      </h2>
      {slots.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {slots.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setChosenSlot(s.key)}
              aria-pressed={s === slot}
              className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${
                s === slot ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface"
              }`}
            >
              {s.events.some(isLive) && (
                <span className={`size-1.5 animate-pulse rounded-full ${s === slot ? "bg-accent-foreground" : "bg-accent"}`} />
              )}
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface">
        <div className="min-w-fit">
          <div className="grid items-end gap-0.5 border-b border-border px-2 py-2 text-xs font-medium text-muted" style={{ gridTemplateColumns: columns }}>
            <span>Jugador</span>
            {shown.map((e) => {
              const match = matchOf(e);
              const [first, second] = sides(e);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setSelected(selected === e.id ? null : e.id)}
                  aria-label={`${e.home} contra ${e.away}`}
                  aria-pressed={selected === e.id}
                  className={`flex flex-col items-center gap-0.5 rounded py-0.5 ${selected === e.id ? "bg-gold/25" : ""}`}
                >
                  <Badge team={first} />
                  <Badge team={second} />
                  <span className={`text-[0.6rem] leading-3 tabular-nums ${match?.state === "in" ? "font-bold text-accent" : ""}`}>
                    {match?.score
                      ? nfl
                        ? `${match.score.away}-${match.score.home}`
                        : `${match.score.home}-${match.score.away}`
                      : " "}
                  </span>
                </button>
              );
            })}
            <span className="text-right">Pts</span>
          </div>
          {selectedEvent && (
            <p className="border-b border-border bg-gold/15 px-2 py-1.5 text-center text-xs">
              <MatchLine event={selectedEvent} match={matchOf(selectedEvent)} outcome={outcomes.get(selectedEvent.id)} awayFirst={nfl} />
            </p>
          )}
          {rows.map((player) => (
            <div
              key={player.id}
              className={`grid items-center gap-0.5 border-b border-border px-2 py-1 text-sm last:border-0 ${
                player.id === currentPlayerId ? "bg-gold/15" : ""
              }`}
              style={{ gridTemplateColumns: columns }}
            >
              <span className="truncate font-medium">{player.name}</span>
              {shown.map((e) => {
                const pick = pickOf.get(`${player.id}:${e.id}`);
                const known = outcomes.get(e.id);
                const hit = isHit(player.id, e.id);
                const style = !pick || !known
                  ? ""
                  : hit
                    ? known.final
                      ? "bg-positive/25 ring-1 ring-positive ring-inset"
                      : "ring-1 ring-positive ring-inset"
                    : known.final
                      ? "opacity-45 grayscale dark:opacity-60"
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
              <span className="text-right font-display text-lg leading-none font-bold tabular-nums">{player.points}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        {nfl
          ? "Arriba, visitante y local de cada juego; toca una columna para ver el juego. Cada casilla es el equipo que escogió. Los puntos son de toda la semana."
          : "Arriba, local y visitante de cada partido; toca una columna para ver el partido. Cada casilla es el equipo que escogió (E = empate)."}
        {anyKnown &&
          " Verde relleno: acertó. Solo borde verde: va acertando en vivo. Apagado: falló. Los puntos oficiales quedan cuando el admin actualiza resultados."}
      </p>
      <ol className="mt-3 grid gap-x-4 gap-y-0.5 text-xs text-muted sm:grid-cols-2">
        {shown.map((e) => (
          <li key={e.id}>
            <MatchLine event={e} match={matchOf(e)} outcome={outcomes.get(e.id)} awayFirst={nfl} />
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
  awayFirst,
}: {
  event: GridEvent;
  match: EspnMatch | undefined;
  outcome: ReturnType<typeof liveOutcome> | undefined;
  /** NFL: "visitor @ home". */
  awayFirst: boolean;
}) {
  const result = outcome?.final ? outcome.outcome : null;
  const score = match?.score;
  return (
    <>
      {awayFirst ? event.away : event.home}
      {score
        ? ` ${awayFirst ? score.away : score.home}–${awayFirst ? score.home : score.away} `
        : awayFirst
          ? " @ "
          : " vs "}
      {awayFirst ? event.home : event.away}
      {match?.state === "in" && <span className="font-medium text-accent"> · {match.clock}</span>}
      {result && (
        <span className="text-foreground">
          {" · "}
          {result === "void" ? "no cuenta" : result === "draw" ? "empate" : `ganó ${result === "home" ? event.home : event.away}`}
        </span>
      )}
    </>
  );
}
