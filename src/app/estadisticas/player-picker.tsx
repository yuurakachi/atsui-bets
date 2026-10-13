"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export interface PickerOption {
  id: string;
  name: string;
  href: string;
}

/** Switches whose statistics are on screen, without going back through a pool. */
export function PlayerPicker({ options, currentId }: { options: PickerOption[]; currentId: string }) {
  const router = useRouter();
  const [loading, startTransition] = useTransition();

  return (
    <label className="mt-4 block rounded-xl border border-border bg-surface px-4 py-3 text-sm">
      <span className="flex items-baseline justify-between gap-3 text-muted">
        Viendo a
        <span aria-live="polite" className="text-xs">
          {loading && "Cargando…"}
        </span>
      </span>
      <select
        defaultValue={currentId}
        onChange={(e) => {
          const option = options.find((o) => o.id === e.target.value);
          if (option) startTransition(() => router.push(option.href));
        }}
        aria-busy={loading}
        className={`mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-base ${loading ? "opacity-60" : ""}`}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
