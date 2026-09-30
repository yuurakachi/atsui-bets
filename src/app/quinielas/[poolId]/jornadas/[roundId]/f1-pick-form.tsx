"use client";

import { useRef, useState } from "react";
import { F1_PICK_POSITIONS } from "@/domain";
import { F1OrderPicker, type PickerDriver } from "@/app/f1-order-picker";
import { saveF1Picks } from "./actions";

type Pick = (string | null)[];

interface Props {
  poolId: string;
  roundId: string;
  drivers: PickerDriver[];
  /** Computed on the server when the page renders. */
  locked: boolean;
  currentPlayerId: string;
  /** Present only for the pool's admins: whose picks they're entering. */
  players?: { id: string; name: string }[];
  picks: Record<string, Pick>;
  /** Sprint picks of the same weekend, offered as a starting point for the GP. */
  sprintPicks: Record<string, Pick> | null;
}

const empty = (): Pick => Array.from({ length: F1_PICK_POSITIONS }, () => null);

/** P1–P10 picks, saved automatically after every change. */
export function F1PickForm({ poolId, roundId, drivers, locked, currentPlayerId, players, picks: initial, sprintPicks }: Props) {
  const [playerId, setPlayerId] = useState(currentPlayerId);
  const [picks, setPicks] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  // Latest unsaved pick per player; saves run one at a time so the last change wins.
  const queue = useRef(new Map<string, Pick>());
  const running = useRef(false);

  const mine = picks[playerId] ?? empty();
  const onBehalf = playerId !== currentPlayerId;
  const readOnly = locked && !players;
  const done = mine.filter(Boolean).length;
  const sprint = sprintPicks?.[playerId];

  const flush = async () => {
    if (running.current) return;
    running.current = true;
    setStatus("saving");
    let failure: string | null = null;
    while (queue.current.size > 0) {
      const [id, pick] = queue.current.entries().next().value!;
      queue.current.delete(id);
      const result = await saveF1Picks(poolId, roundId, id, pick);
      failure = result.ok ? null : result.message;
    }
    running.current = false;
    setError(failure);
    setStatus(failure ? "idle" : "saved");
  };

  const update = (next: Pick) => {
    setPicks((p) => ({ ...p, [playerId]: next }));
    queue.current.set(playerId, next);
    void flush();
  };

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

      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {done === F1_PICK_POSITIONS ? "✓ Pics completos" : `Llevas ${done} de ${F1_PICK_POSITIONS}`}
          {status === "saving" && " · guardando…"}
          {status === "saved" && !error && " · guardado"}
        </p>
        {!readOnly && sprint?.some(Boolean) && (
          <button
            type="button"
            onClick={() => {
              if (done > 0 && !confirm("¿Reemplazar estos pics con los del Sprint?")) return;
              update([...sprint]);
            }}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm transition hover:border-accent"
          >
            Copiar del Sprint
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <F1OrderPicker key={playerId} drivers={drivers} value={mine} onChange={update} disabled={readOnly} />
    </div>
  );
}
