"use client";

import { useActionState, useState } from "react";
import { updatePlayer, type ActionResult } from "./actions";

interface Props {
  poolId: string;
  player: { id: string; nickname: string; email: string | null; signedIn: boolean };
}

export function PlayerRow({ poolId, player }: Props) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(
    async (_: ActionResult | null, form: FormData) => {
      const result = await updatePlayer(poolId, player.id, form);
      if (result.ok) setEditing(false);
      return result;
    },
    null,
  );

  if (!editing) {
    return (
      <li className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5 last:border-0">
        <span className="min-w-0">
          <span className="block font-medium">{player.nickname}</span>
          <span className={`block truncate text-sm ${player.email ? "text-muted" : "text-gold"}`}>
            {player.email ?? "Sin correo"}
          </span>
          {state?.ok && <span className="block text-xs text-positive">{state.message}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {player.signedIn && (
            <span title="Ya entró a la app" className="rounded-full bg-positive/15 px-2 py-0.5 text-xs font-medium text-positive">
              Activo
            </span>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-border px-2.5 py-1 text-sm transition hover:border-accent"
          >
            Editar
          </button>
        </span>
      </li>
    );
  }

  return (
    <li className="border-b border-border px-3 py-3 last:border-0">
      <form action={action} className="space-y-2">
        <label className="block text-sm">
          <span className="text-muted">Apodo</span>
          <input
            name="nickname"
            defaultValue={player.nickname}
            required
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Correo de Google (Gmail)</span>
          <input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            defaultValue={player.email ?? ""}
            placeholder="nombre@gmail.com"
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2"
          />
        </label>
        {state && !state.ok && (
          <p role="alert" className="text-sm text-negative">
            {state.message}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-lg bg-accent px-3 py-2 font-semibold text-accent-foreground disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-border px-3 py-2">
            Cancelar
          </button>
        </div>
      </form>
    </li>
  );
}
