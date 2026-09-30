"use client";

import { useEffect, useRef, useState } from "react";

export interface PickerDriver {
  id: string;
  code: string;
  name: string;
  team: string | null;
  active: boolean;
}

const TEAM_COLORS: [RegExp, string][] = [
  [/mclaren/i, "#ff8000"],
  [/ferrari/i, "#e8002d"],
  [/red bull/i, "#3671c6"],
  [/mercedes/i, "#27f4d2"],
  [/aston/i, "#229971"],
  [/alpine/i, "#ff87bc"],
  [/williams/i, "#64c4ff"],
  [/^rb\b|racing bulls/i, "#6692ff"],
  [/haas/i, "#b6babd"],
  [/sauber|audi/i, "#bb0a30"],
  [/cadillac/i, "#c9a64b"],
];

export function teamColor(team: string | null): string {
  return TEAM_COLORS.find(([pattern]) => team && pattern.test(team))?.[1] ?? "var(--border)";
}

const surname = (name: string) => name.split(" ").slice(1).join(" ") || name;

interface Props {
  drivers: PickerDriver[];
  /** Driver ids by position, index 0 = P1; null = empty. */
  value: (string | null)[];
  onChange: (next: (string | null)[]) => void;
  disabled?: boolean;
}

/**
 * P1–P10 picker for phones: tap a position, then a driver in the sheet at the bottom.
 * Choosing a driver who is already placed moves them; the next empty position opens.
 */
export function F1OrderPicker({ drivers, value, onChange, disabled = false }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const slots = useRef<(HTMLButtonElement | null)[]>([]);

  // Keep the position being chosen visible above the sheet (which covers 55 % of the screen).
  useEffect(() => {
    const slot = active === null ? null : slots.current[active];
    if (!slot) return;
    const sheetTop = window.innerHeight * 0.45 - 8;
    const { top, bottom } = slot.getBoundingClientRect();
    if (bottom > sheetTop) window.scrollBy({ top: bottom - sheetTop, behavior: "smooth" });
    else if (top < 0) window.scrollBy({ top: top - 16, behavior: "smooth" });
  }, [active]);
  const byId = new Map(drivers.map((d) => [d.id, d]));
  const options = drivers.filter((d) => d.active || value.includes(d.id));

  const choose = (driverId: string) => {
    if (active === null) return;
    const next = [...value];
    const from = next.indexOf(driverId);
    if (from !== -1) next[from] = next[active] ?? null; // swap with whoever was there
    next[active] = driverId;
    onChange(next);
    const empty = next.findIndex((d, i) => d === null && i > active);
    const anyEmpty = empty !== -1 ? empty : next.indexOf(null);
    setActive(anyEmpty === -1 ? null : anyEmpty);
  };

  const clear = () => {
    if (active === null) return;
    const next = [...value];
    next[active] = null;
    onChange(next);
  };

  return (
    <>
      <ol className={`space-y-1.5 ${active !== null ? "pb-[58vh]" : ""}`}>
        {value.map((driverId, i) => {
          const driver = driverId ? byId.get(driverId) : undefined;
          const selected = active === i;
          return (
            <li key={i}>
              <button
                ref={(el) => {
                  slots.current[i] = el;
                }}
                type="button"
                disabled={disabled}
                onClick={() => setActive(selected ? null : i)}
                aria-pressed={selected}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition disabled:opacity-80 ${
                  selected ? "border-accent bg-accent/10 ring-1 ring-accent" : "border-border bg-surface hover:border-accent"
                }`}
              >
                <span className="w-8 shrink-0 text-sm font-semibold text-muted tabular-nums">P{i + 1}</span>
                {driver ? (
                  <>
                    <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: teamColor(driver.team) }} />
                    <span className="min-w-0 flex-1">
                      <span className="font-mono font-bold">{driver.code}</span>{" "}
                      <span className="text-sm">{surname(driver.name)}</span>
                      {driver.team && <span className="block truncate text-xs text-muted">{driver.team}</span>}
                    </span>
                  </>
                ) : (
                  <span className="flex-1 text-sm text-muted">{disabled ? "—" : "Elegir piloto"}</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {active !== null && !disabled && (
        <div
          role="dialog"
          aria-label={`Elegir piloto para P${active + 1}`}
          className="fixed inset-x-0 bottom-0 z-20 max-h-[55vh] overflow-y-auto rounded-t-2xl border-t border-border bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
        >
          <div className="mx-auto max-w-xl">
            <div className="sticky top-0 -mx-4 mb-2 flex items-center justify-between gap-2 bg-background px-4 py-1">
              <p className="font-semibold">Elige P{active + 1}</p>
              <span className="flex gap-2">
                {value[active] && (
                  <button type="button" onClick={clear} className="rounded-lg border border-border px-3 py-1.5 text-sm">
                    Quitar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActive(null)}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground"
                >
                  Listo
                </button>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {options.map((driver) => {
                const at = value.indexOf(driver.id);
                const here = at === active;
                return (
                  <button
                    key={driver.id}
                    type="button"
                    onClick={() => choose(driver.id)}
                    className={`relative min-h-14 rounded-lg border px-2 py-1.5 text-left transition ${
                      here
                        ? "border-accent bg-accent text-accent-foreground"
                        : at !== -1
                          ? "border-border bg-surface opacity-50"
                          : "border-border bg-surface hover:border-accent"
                    }`}
                    style={{ borderLeft: `4px solid ${teamColor(driver.team)}` }}
                  >
                    <span className="block font-mono text-sm font-bold">{driver.code}</span>
                    <span className="block truncate text-xs">{surname(driver.name)}</span>
                    {at !== -1 && !here && (
                      <span className="absolute top-1 right-1.5 text-[0.65rem] font-semibold">P{at + 1}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
