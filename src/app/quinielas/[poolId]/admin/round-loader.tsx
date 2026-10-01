"use client";

import { useState, useTransition } from "react";
import { ligaMxRoundLock, type MatchResult, type Sport } from "@/domain";
import { fetchMatch, fetchMatches, fetchNflWeek, type EspnMatch } from "@/lib/espn";
import { createRound, saveResults, setEventCounts, type ActionResult } from "./actions";

/** Matches in a regular Liga MX matchday. */
const LIGA_MX_MATCHES = 9;

interface PostponedMatch {
  externalId: string;
  home: string;
  away: string;
  /** Round where it was first loaded and didn't count. */
  round: string;
}

const kickoff = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function Message({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p role="status" className={`mt-3 text-sm ${result.ok ? "text-positive" : "text-negative"}`}>
      {result.message}
    </p>
  );
}

export function RoundLoader(props: {
  poolId: string;
  sport: Sport;
  nextName: string;
  from: string;
  to: string;
  /** NFL only: the week to load, asked to ESPN by number instead of by dates. */
  nflWeek?: { season: string; week: number };
  /** Matches already in a round of this pool, by ESPN id, with that round's name. */
  taken: Record<string, string>;
  /** Matches that didn't count in their round and haven't been played in another one. */
  postponed: PostponedMatch[];
}) {
  const { nflWeek, taken } = props;
  const noun = nflWeek ? "juegos" : "partidos";
  const [from, setFrom] = useState(props.from);
  const [to, setTo] = useState(props.to);
  const [name, setName] = useState(props.nextName);
  const [matches, setMatches] = useState<EspnMatch[] | null>(null);
  /** Postponed matches ESPN has outside the searched dates, with their new kickoff if any. */
  const [elsewhere, setElsewhere] = useState<EspnMatch[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const originOf = new Map(props.postponed.map((p) => [p.externalId, p.round]));
  const isPostponed = (m: EspnMatch) => m.result === "void";
  const hasStarted = (m: EspnMatch) => m.state !== "pre" && !isPostponed(m);

  const search = () =>
    startTransition(async () => {
      setResult(null);
      try {
        const found = nflWeek
          ? await fetchNflWeek(nflWeek.season, nflWeek.week)
          : await fetchMatches(props.sport, from, to);
        const inRange = new Set(found.map((m) => m.externalId));
        const moved = (
          await Promise.all(
            props.postponed
              .filter((p) => !inRange.has(p.externalId))
              .map((p) => fetchMatch(props.sport, p.externalId).catch(() => null)),
          )
        ).filter((m): m is EspnMatch => m !== null);
        setMatches(found);
        setElsewhere(moved);
        // Leave out what's already in another round and what ESPN has as postponed.
        setSelected(new Set(found.filter((m) => !taken[m.externalId] && !isPostponed(m)).map((m) => m.externalId)));
      } catch (e) {
        setResult({ ok: false, message: (e as Error).message });
      }
    });

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const chosen = [...(matches ?? []), ...elsewhere]
    .filter((m) => selected.has(m.externalId))
    .sort((x, y) => x.startsAt.localeCompare(y.startsAt));

  const create = () =>
    startTransition(async () => {
      const r = await createRound(props.poolId, name, chosen);
      setResult(r);
      if (r.ok) setMatches(null);
    });

  const row = (m: EspnMatch) => {
    const inRound = taken[m.externalId];
    const origin = originOf.get(m.externalId);
    const note = inRound
      ? `Ya está en ${inRound}`
      : isPostponed(m)
        ? "Pospuesto"
        : hasStarted(m)
          ? "Ya empezó"
          : origin
            ? `Reprogramado · era de ${origin}`
            : null;
    return (
      <li key={m.externalId}>
        <label className={`flex items-start gap-2 ${inRound ? "opacity-50" : ""}`}>
          <input
            type="checkbox"
            checked={selected.has(m.externalId)}
            disabled={!!inRound}
            onChange={() => toggle(m.externalId)}
            className="mt-1 size-4 shrink-0 accent-accent"
          />
          <span className="min-w-0 flex-1">
            <span className="flex justify-between gap-2">
              <span>{nflWeek ? `${m.away} @ ${m.home}` : `${m.home} vs ${m.away}`}</span>
              <span className="shrink-0 text-muted">{kickoff.format(new Date(m.startsAt))}</span>
            </span>
            {note && <span className="block text-xs font-medium text-gold">{note}</span>}
          </span>
        </label>
      </li>
    );
  };

  // Postponed matches ESPN already gave a new date, outside the searched ones.
  const rescheduled = elsewhere.filter((m) => !isPostponed(m) && m.state === "pre");
  const waiting = props.postponed.filter(
    (p) =>
      !(matches ?? []).some((m) => m.externalId === p.externalId) &&
      !rescheduled.some((m) => m.externalId === p.externalId),
  );
  const lock =
    props.sport === "liga_mx" && chosen.length > 0 ? ligaMxRoundLock(new Date(chosen[0].startsAt)) : null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      {!nflWeek && (
        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-muted">Desde</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2" />
          </label>
          <label className="text-sm">
            <span className="text-muted">Hasta</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2" />
          </label>
        </div>
      )}
      <button type="button" onClick={search} disabled={pending} className="w-full rounded-lg border border-border px-4 py-2.5 font-medium transition hover:border-accent disabled:opacity-60">
        {pending && !matches ? "Buscando…" : nflWeek ? `Buscar la Semana ${nflWeek.week} en ESPN` : "Buscar partidos en ESPN"}
      </button>

      {matches && (
        <div className="mt-4">
          {matches.length === 0 && rescheduled.length === 0 ? (
            <p className="text-sm text-muted">{nflWeek ? "ESPN no tiene juegos para esa semana." : "No hay partidos en esas fechas."}</p>
          ) : (
            <>
              <ul className="space-y-2 text-sm">{matches.map(row)}</ul>

              {rescheduled.length > 0 && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                    Reprogramados fuera de estas fechas
                  </p>
                  <p className="mt-1 mb-2 text-xs text-muted">
                    Márcalos para jugarlos en esta jornada. Los pics de toda la jornada cierran el día antes del
                    primer partido.
                  </p>
                  <ul className="space-y-2 text-sm">{rescheduled.map(row)}</ul>
                </div>
              )}

              {props.sport === "liga_mx" && chosen.length !== LIGA_MX_MATCHES && (
                <p role="status" className="mt-4 rounded-lg border border-gold/50 bg-gold/10 px-3 py-2 text-sm">
                  Hay {chosen.length} {chosen.length === 1 ? "partido marcado" : "partidos marcados"}; una jornada
                  normal tiene {LIGA_MX_MATCHES}.{" "}
                  {chosen.length < LIGA_MX_MATCHES
                    ? "Revisa que no falte ninguno (prueba con más fechas)."
                    : "Está bien si entra un partido reprogramado; si no, quita el que sobre."}
                </p>
              )}
              {lock && (
                <p className="mt-3 text-sm text-muted">
                  Los pics cerrarán el <span className="font-medium text-foreground">{kickoff.format(lock)}</span>
                </p>
              )}

              <label className="mt-4 block text-sm">
                <span className="text-muted">Nombre de la jornada</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2" />
              </label>
              <button type="button" onClick={create} disabled={pending || chosen.length === 0} className="mt-3 w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-foreground disabled:opacity-60">
                {pending ? "Creando…" : `Crear ${name} con ${chosen.length} ${noun}`}
              </button>
            </>
          )}
        </div>
      )}

      {waiting.length > 0 && (
        <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
          Pospuestos pendientes: {waiting.map((p) => `${p.home} vs ${p.away} (${p.round})`).join(", ")}.
          {matches ? " ESPN aún no les da nueva fecha." : " Al buscar partidos se revisa si ya tienen nueva fecha."}
        </p>
      )}
      <Message result={result} />
    </div>
  );
}

export function ResultsUpdater(props: {
  poolId: string;
  sport: Sport;
  roundId: string;
  name: string;
  externalIds: string[];
  events: { id: string; label: string; result: MatchResult | null }[];
  from: string;
  to: string;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const setCounts = (eventId: string, counts: boolean) =>
    startTransition(async () => {
      setResult(await setEventCounts(props.poolId, props.roundId, eventId, counts));
    });

  const update = () =>
    startTransition(async () => {
      try {
        const ids = new Set(props.externalIds);
        const matches = (await fetchMatches(props.sport, props.from, props.to)).filter((m) => ids.has(m.externalId));
        setResult(await saveResults(props.poolId, props.roundId, matches));
      } catch (e) {
        setResult({ ok: false, message: (e as Error).message });
      }
    });

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{props.name}</p>
        <button type="button" onClick={update} disabled={pending} className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-accent disabled:opacity-60">
          {pending ? "Actualizando…" : "Actualizar resultados"}
        </button>
      </div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-2 text-sm text-muted underline hover:text-foreground">
        {open ? "Ocultar partidos" : "¿Pospusieron un partido?"}
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 text-sm">
          {props.events.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2">
              <span className={e.result === "void" ? "text-muted line-through" : ""}>{e.label}</span>
              {e.result === "void" ? (
                <button type="button" onClick={() => setCounts(e.id, true)} disabled={pending} className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs transition hover:border-accent disabled:opacity-60">
                  Sí cuenta
                </button>
              ) : e.result ? (
                <span className="shrink-0 text-xs text-muted">Terminado</span>
              ) : (
                <button type="button" onClick={() => setCounts(e.id, false)} disabled={pending} className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs transition hover:border-accent disabled:opacity-60">
                  No cuenta
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Message result={result} />
    </div>
  );
}
