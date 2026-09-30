"use client";

import { useState, useTransition } from "react";
import { F1_PICK_POSITIONS } from "@/domain";
import { F1OrderPicker, teamColor, type PickerDriver } from "@/app/f1-order-picker";
import { fetchF1Classification, fetchF1Season, parseF1ExternalId } from "@/lib/jolpica";
import {
  importF1Results,
  loadF1Season,
  saveManualClassification,
  setDriverActive,
  type ActionResult,
  type F1ActionResult,
} from "./actions";

function Message({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p role="status" className={`mt-3 text-sm ${result.ok ? "text-accent" : "text-red-500"}`}>
      {result.message}
    </p>
  );
}

/**
 * Asks the server first; if the server can't reach Jolpica, fetches it from this browser
 * and hands the data to the server.
 */
async function withBrowserFallback<T>(
  call: (data?: T) => Promise<F1ActionResult>,
  fetchInBrowser: () => Promise<T | null>,
): Promise<ActionResult> {
  const first = await call();
  if (first.ok || !("fetchFailed" in first)) return first;
  try {
    const data = await fetchInBrowser();
    if (data === null) return { ok: false, message: "Jolpica todavía no tiene la clasificación de esta carrera." };
    const second = await call(data);
    return second.ok ? { ok: true, message: `${second.message} (Jolpica se leyó desde este navegador.)` } : second;
  } catch {
    return { ok: false, message: `${first.message} Tampoco respondió desde este navegador.` };
  }
}

const buttonClass =
  "rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-accent disabled:opacity-60";

export function F1SeasonLoader({ poolId, season }: { poolId: string; season: string }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      setResult(null);
      setResult(await withBrowserFallback((data) => loadF1Season(poolId, data), () => fetchF1Season(season)));
    });

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <button type="button" onClick={load} disabled={pending} className={`w-full ${buttonClass}`}>
        {pending ? "Cargando…" : `Cargar calendario y pilotos ${season} de Jolpica`}
      </button>
      <Message result={result} />
    </div>
  );
}

interface ResultsProps {
  poolId: string;
  roundId: string;
  name: string;
  externalId: string | null;
  /** Already scored: importing again re-scores it (penalties, disqualifications). */
  scored: boolean;
  drivers: PickerDriver[];
}

export function F1ResultsCard({ poolId, roundId, name, externalId, scored, drivers }: ResultsProps) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [manual, setManual] = useState<(string | null)[] | null>(null);
  const [pending, startTransition] = useTransition();
  const race = externalId ? parseF1ExternalId(externalId) : null;

  const importResults = () =>
    startTransition(async () => {
      setResult(null);
      setResult(
        await withBrowserFallback(
          (data) => importF1Results(poolId, roundId, data),
          () => fetchF1Classification(race!.season, race!.raceRound, race!.kind),
        ),
      );
    });

  const saveManual = () =>
    startTransition(async () => {
      const r = await saveManualClassification(poolId, roundId, manual ?? []);
      setResult(r);
      if (r.ok) setManual(null);
    });

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{name}</p>
        <span className="flex gap-2">
          {race && (
            <button type="button" onClick={importResults} disabled={pending} className={buttonClass}>
              {pending && !manual ? "Importando…" : scored ? "Reimportar" : "Importar resultado"}
            </button>
          )}
          {!manual && (
            <button
              type="button"
              onClick={() => setManual(Array.from({ length: F1_PICK_POSITIONS }, () => null))}
              className={buttonClass}
            >
              A mano
            </button>
          )}
        </span>
      </div>
      {manual && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-muted">Clasificación oficial, P1 a P10:</p>
          <F1OrderPicker drivers={drivers} value={manual} onChange={setManual} />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={saveManual}
              disabled={pending || manual.some((d) => d === null)}
              className="flex-1 rounded-lg bg-accent px-3 py-2 font-semibold text-accent-foreground disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar y calificar"}
            </button>
            <button type="button" onClick={() => setManual(null)} className="rounded-lg border border-border px-3 py-2">
              Cancelar
            </button>
          </div>
        </div>
      )}
      <Message result={result} />
    </div>
  );
}

export function F1DriverList({ poolId, drivers }: { poolId: string; drivers: PickerDriver[] }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <ul className="rounded-xl border border-border bg-surface">
        {drivers.map((driver) => (
          <li key={driver.id} className="border-b border-border last:border-0">
            <label className="flex items-center gap-3 px-3 py-2">
              <span className="h-5 w-1 shrink-0 rounded-full" style={{ background: teamColor(driver.team) }} />
              <span className="min-w-0 flex-1">
                <span className="font-mono font-bold">{driver.code}</span> <span className="text-sm">{driver.name}</span>
                <span className="block truncate text-xs text-muted">{driver.team ?? "Sin equipo"}</span>
              </span>
              <input
                type="checkbox"
                defaultChecked={driver.active}
                disabled={pending}
                onChange={(e) => {
                  const active = e.target.checked;
                  startTransition(async () => setResult(await setDriverActive(poolId, driver.id, active)));
                }}
                className="size-5 accent-[var(--accent)]"
                aria-label={`Mostrar a ${driver.name} en los pics`}
              />
            </label>
          </li>
        ))}
      </ul>
      <Message result={result} />
    </div>
  );
}
