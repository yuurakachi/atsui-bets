"use client";

import { useTransition } from "react";
import { markPeriodSettled } from "./actions";

export function SettleButton({ periodId }: { periodId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("¿Ya se cobró y se pagó todo? Esto cierra el corte.")) return;
        startTransition(() => markPeriodSettled(periodId));
      }}
      className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground transition disabled:opacity-60"
    >
      {pending ? "Cerrando…" : "Marcar corte como liquidado"}
    </button>
  );
}
