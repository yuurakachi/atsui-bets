"use client";

import { useState, useTransition } from "react";
import type { Sport } from "@/domain";
import { fetchMatches, type EspnMatch } from "@/lib/espn";
import { createRound, saveResults, type ActionResult } from "./actions";

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

export function RoundLoader(props: { poolId: string; sport: Sport; nextName: string; from: string; to: string }) {
  const [from, setFrom] = useState(props.from);
  const [to, setTo] = useState(props.to);
  const [name, setName] = useState(props.nextName);
  const [matches, setMatches] = useState<EspnMatch[] | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const search = () =>
    startTransition(async () => {
      setResult(null);
      try {
        setMatches(await fetchMatches(props.sport, from, to));
      } catch (e) {
        setResult({ ok: false, message: (e as Error).message });
      }
    });

  const create = () =>
    startTransition(async () => {
      const r = await createRound(props.poolId, name, matches ?? []);
      setResult(r);
      if (r.ok) setMatches(null);
    });

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="text-muted">Desde</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2" />
        </label>
        <label className="text-sm">
          <span className="text-muted">Hasta</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2" />
        </label>
      </div>
      <button type="button" onClick={search} disabled={pending} className="mt-3 w-full rounded-lg border border-border px-4 py-2.5 font-medium transition hover:border-accent disabled:opacity-60">
        {pending && !matches ? "Buscando…" : "Buscar partidos en ESPN"}
      </button>

      {matches && (
        <div className="mt-4">
          {matches.length === 0 ? (
            <p className="text-sm text-muted">No hay partidos en esas fechas.</p>
          ) : (
            <>
              <ol className="space-y-1 text-sm">
                {matches.map((m, i) => (
                  <li key={m.externalId} className="flex justify-between gap-2">
                    <span>
                      {i + 1}. {m.home} vs {m.away}
                    </span>
                    <span className="shrink-0 text-muted">{kickoff.format(new Date(m.startsAt))}</span>
                  </li>
                ))}
              </ol>
              <label className="mt-4 block text-sm">
                <span className="text-muted">Nombre de la jornada</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2" />
              </label>
              <button type="button" onClick={create} disabled={pending} className="mt-3 w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-foreground disabled:opacity-60">
                {pending ? "Creando…" : `Crear ${name} con ${matches.length} partidos`}
              </button>
            </>
          )}
        </div>
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
  from: string;
  to: string;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

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
      <Message result={result} />
    </div>
  );
}
