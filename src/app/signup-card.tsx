"use client";

import { useState, useTransition } from "react";
import { joinPool } from "./signup-actions";

interface Props {
  poolId: string;
  name: string;
  buyIn: string;
  players: number;
  closes: string | null;
}

/** A pool the player can still join, with the button that signs them up. */
export function SignupCard({ poolId, name, buyIn, players, closes }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const join = () => {
    if (!confirm(`¿Entras a ${name}? La entrada es de ${buyIn}.`)) return;
    startTransition(async () => {
      const result = await joinPool(poolId);
      setMessage(result.message);
    });
  };

  return (
    <div className="rounded-xl border-2 border-gold bg-surface px-4 py-3">
      <p className="font-display text-xl font-bold uppercase">{name}</p>
      <p className="text-sm text-muted">
        Entrada {buyIn} · {players} {players === 1 ? "apuntado" : "apuntados"}
        {closes && ` · cierra ${closes}`}
      </p>
      <button
        type="button"
        onClick={join}
        disabled={pending}
        className="mt-3 w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-foreground transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Apuntándote…" : "Me apunto"}
      </button>
      {message && (
        <p role="alert" className="mt-2 text-sm text-negative">
          {message}
        </p>
      )}
    </div>
  );
}
