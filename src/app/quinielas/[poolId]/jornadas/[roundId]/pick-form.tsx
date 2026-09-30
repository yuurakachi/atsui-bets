"use client";

import { useState, useTransition } from "react";
import type { MatchOutcome } from "@/domain";
import { savePick } from "./actions";

interface PickEvent {
  id: string;
  home: string;
  away: string;
  startsAt: string;
  /** Computed on the server when the page renders. */
  locked: boolean;
}

interface Props {
  poolId: string;
  roundId: string;
  allowDraw: boolean;
  events: PickEvent[];
  currentPlayerId: string;
  /** Present only for the pool's admins: whose picks they're entering. */
  players?: { id: string; name: string }[];
  picks: Record<string, Record<string, MatchOutcome>>;
}

const kickoff = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  weekday: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function PickForm({ poolId, roundId, allowDraw, events, currentPlayerId, players, picks: initial }: Props) {
  const [playerId, setPlayerId] = useState(currentPlayerId);
  const [picks, setPicks] = useState(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const mine = picks[playerId] ?? {};
  const onBehalf = playerId !== currentPlayerId;
  const done = events.filter((e) => mine[e.id]).length;

  const choose = (eventId: string, selection: MatchOutcome) => {
    const previous = mine[eventId];
    if (previous === selection) return;
    setError(null);
    setSaving(eventId);
    setPicks((p) => ({ ...p, [playerId]: { ...p[playerId], [eventId]: selection } }));
    startTransition(async () => {
      const result = await savePick(poolId, roundId, eventId, playerId, selection);
      setSaving(null);
      if (!result.ok) {
        setError(result.message);
        setPicks((p) => {
          const next = { ...p[playerId] };
          if (previous) next[eventId] = previous;
          else delete next[eventId];
          return { ...p, [playerId]: next };
        });
      }
    });
  };

  const options: { value: MatchOutcome; label: (e: PickEvent) => string }[] = [
    { value: "home", label: (e) => e.home },
    ...(allowDraw ? [{ value: "draw" as const, label: () => "Empate" }] : []),
    { value: "away", label: (e) => e.away },
  ];

  return (
    <div>
      {players && (
        <label className="mb-4 block rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <span className="text-muted">Capturar pics de</span>
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-base"
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === currentPlayerId ? `${p.name} (yo)` : p.name}
              </option>
            ))}
          </select>
          {onBehalf && <span className="mt-1 block text-xs text-muted">Queda registrado que tú los capturaste.</span>}
        </label>
      )}

      <p className="text-sm text-muted" aria-live="polite">
        {done === events.length ? "✓ Pics completos" : `Llevas ${done} de ${events.length}`}
        {saving && " · guardando…"}
      </p>
      {error && (
        <p role="alert" className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <ol className="mt-3 space-y-3">
        {events.map((event, i) => {
          const locked = event.locked && !players;
          return (
            <li key={event.id} className="rounded-xl border border-border bg-surface p-3">
              <p className="mb-2 flex justify-between text-xs text-muted">
                <span>Partido {i + 1}</span>
                <span>{locked ? "Cerrado" : kickoff.format(new Date(event.startsAt))}</span>
              </p>
              <div className={`grid gap-2 ${allowDraw ? "grid-cols-3" : "grid-cols-2"}`}>
                {options.map((option) => {
                  const selected = mine[event.id] === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={locked}
                      aria-pressed={selected}
                      onClick={() => choose(event.id, option.value)}
                      className={`min-h-12 rounded-lg border px-2 py-2 text-sm font-medium leading-tight transition disabled:opacity-50 ${
                        selected
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border hover:border-accent"
                      }`}
                    >
                      {option.label(event)}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
