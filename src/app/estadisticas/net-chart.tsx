"use client";

import { useState, type PointerEvent } from "react";
import type { Cents } from "@/domain";
import { formatNet } from "@/lib/format";
import { axisLabels, pointAt, W } from "./chart-scale";

export interface NetPoint {
  label: string;
  /** What the readout calls the point: "Reunión del 5 dic", "Jornada 7". */
  title: string;
  /** Net accumulated up to this point. */
  cents: Cents;
  /** Not paid yet: drawn dashed. */
  pending?: boolean;
  /** A round where the player took the weekly prize. */
  won?: boolean;
  /** What the season's close pays, after the last round or meeting. */
  closing?: boolean;
}

const wholePesos = (cents: Cents) => formatNet(Math.round(cents / 100) * 100);
const tone = (cents: Cents) => (cents > 0 ? "text-positive" : cents < 0 ? "text-negative" : "text-muted");

/**
 * Accumulated net as a line starting at $0. By meeting, each dot is green or red for
 * what was collected or paid there; by round, gold dots mark the rounds won. Touching
 * or sliding a finger over the chart picks a point and shows its amounts above it.
 */
export function NetChart({ points, by, label }: { points: readonly NetPoint[]; by: "meeting" | "round"; label: string }) {
  const top = 22;
  const bottom = 92;
  const left = 34;
  const right = W - 12;
  const values = [0, ...points.map((p) => p.cents)];
  const max = Math.max(...values);
  const min = Math.min(...values);
  const step = (right - left) / points.length;
  const x = (i: number) => left + i * step;
  const y = (cents: Cents) => top + ((max - cents) * (bottom - top)) / (max - min || 1);
  const labels = axisLabels(points.map((p) => p.label), step, (i) => points[i].closing === true);

  // Amounts are printed at the last point and, when there's room, at the highest and lowest.
  const n = points.length;
  const tags = new Map<number, "above" | "below">();
  const far = (i: number) => Math.abs(x(i) - x(n)) >= 48;
  const lowest = values.indexOf(min, 1);
  const highest = values.indexOf(max, 1);
  if (lowest > 0 && far(lowest)) tags.set(lowest, "below");
  if (highest > 0 && far(highest)) tags.set(highest, "above");
  tags.set(n, values[n] >= values[n - 1] ? "above" : "below");

  // The last point until the player picks another; kept in range if the points change.
  const [picked, setPicked] = useState<number | null>(null);
  const selected = picked === null ? n - 1 : Math.min(picked, n - 1);
  const chosen = points[selected];
  const change = chosen.cents - values[selected];

  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setPicked(pointAt(((event.clientX - box.left) * W) / box.width, left, step, n));
  };

  return (
    <>
      {/* Always two lines, so nothing jumps while the finger slides. */}
      <div className="px-3 tabular-nums">
        <p className="truncate text-xs text-muted">
          {chosen.title}
          {chosen.pending && " · pendiente"}
        </p>
        <p className="flex items-baseline justify-between gap-3 text-sm font-semibold">
          <span className={tone(change)}>{formatNet(change)}</span>
          <span>Neto {formatNet(chosen.cents)}</span>
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} 128`}
        role="img"
        aria-label={label}
        className="block h-auto w-full touch-pan-y select-none"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pick(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons > 0 || event.pointerType === "mouse") pick(event);
        }}
      >
        <line x1={left - 8} x2={W - 4} y1={y(0)} y2={y(0)} strokeDasharray="3 3" className="stroke-muted" />
        <text x={0} y={y(0) + 4} className="fill-muted text-[11px]">
          $0
        </text>
        <line x1={x(selected + 1)} x2={x(selected + 1)} y1={top - 14} y2={bottom + 18} className="stroke-border" />
        {points.map((point, i) => (
          <line
            key={i}
            x1={x(i)}
            y1={y(values[i])}
            x2={x(i + 1)}
            y2={y(point.cents)}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={point.pending ? "4 4" : undefined}
            className={point.pending ? "stroke-muted" : "stroke-foreground"}
          />
        ))}
        {points.map((point, i) => {
          const cx = x(i + 1);
          const cy = y(point.cents);
          const change = point.cents - values[i];
          // The picked point's amount is already above the chart.
          const tag = i === selected ? undefined : tags.get(i + 1);
          return (
            <g key={i}>
              {i === selected && <circle cx={cx} cy={cy} r={7} fill="none" strokeWidth={1.5} className="stroke-foreground" />}
              {point.pending ? (
                <circle cx={cx} cy={cy} r={3.5} strokeWidth={2} className="fill-surface stroke-muted" />
              ) : by === "meeting" ? (
                <circle cx={cx} cy={cy} r={4} className={change > 0 ? "fill-positive" : change < 0 ? "fill-negative" : "fill-muted"} />
              ) : point.won ? (
                <circle cx={cx} cy={cy} r={4} className="fill-gold" />
              ) : (
                (n <= 20 || i === selected) && <circle cx={cx} cy={cy} r={2.5} className="fill-foreground" />
              )}
              {tag && (
                <text
                  x={cx > right - 30 ? W - 2 : cx}
                  y={tag === "above" ? cy - 8 : cy + 16}
                  textAnchor={cx > right - 30 ? "end" : cx < left + 24 ? "start" : "middle"}
                  className="fill-foreground text-[12px] font-semibold"
                >
                  {wholePesos(point.cents)}
                </text>
              )}
              {labels[i] && (
                <text x={cx} y={124} textAnchor="middle" className="fill-muted text-[11px]">
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </>
  );
}
