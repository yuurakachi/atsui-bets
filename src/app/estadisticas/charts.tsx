import type { Cents } from "@/domain";
import { formatNet } from "@/lib/format";

/** Charts are drawn 320 units wide and scale with the card, so they fit a 375px phone. */
const W = 320;

/** The x-axis labels that fit a slot: all of them, each round's number, or every fifth number. */
function axisLabels(labels: readonly string[], slot: number): string[] {
  const widest = Math.max(...labels.map((l) => l.length));
  if (slot >= widest * 6.5 + 3) return [...labels];
  const every = slot >= 15 ? 1 : 5;
  return labels.map((_, i) => (i === 0 || (i + 1) % every === 0 ? String(i + 1) : ""));
}

export interface PointsBar {
  label: string;
  points: number;
  groupAverage: number;
  won: boolean;
}

/** Points per round as bars, with a tick at the group's average and gold bars for rounds won. */
export function PointsChart({ bars, label }: { bars: readonly PointsBar[]; label: string }) {
  const top = 20;
  const bottom = 92;
  const left = 4;
  const slot = (W - left * 2) / bars.length;
  const width = Math.min(18, slot * 0.62);
  const unit = (bottom - top) / Math.max(1, ...bars.map((b) => Math.max(b.points, b.groupAverage)));
  const showValues = slot >= Math.max(...bars.map((b) => String(b.points).length)) * 7 + 3;
  const labels = axisLabels(bars.map((b) => b.label), slot);
  const tick = Math.min(slot * 0.9, width + 10) / 2;

  return (
    <svg viewBox={`0 0 ${W} 110`} role="img" aria-label={label} className="block h-auto w-full">
      {bars.map((bar, i) => {
        const center = left + slot * (i + 0.5);
        const height = Math.max(1, bar.points * unit);
        const average = bottom - bar.groupAverage * unit;
        return (
          <g key={i}>
            <rect
              x={center - width / 2}
              y={bottom - height}
              width={width}
              height={height}
              rx={2}
              className={bar.won ? "fill-gold" : "fill-sport/55"}
            />
            <line x1={center - tick} x2={center + tick} y1={average} y2={average} strokeWidth={2} className="stroke-foreground" />
            {showValues && (
              <text x={center} y={12} textAnchor="middle" className="fill-foreground text-[12px] font-semibold">
                {bar.points}
              </text>
            )}
            {labels[i] && (
              <text x={center} y={107} textAnchor="middle" className="fill-muted text-[11px]">
                {labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Position in the season standings after each round; dashed lines mark the jackpot positions. */
export function StandingChart({
  standings,
  participants,
  marks,
  firstLabel,
  lastLabel,
  label,
}: {
  standings: readonly number[];
  participants: number;
  marks: readonly number[];
  firstLabel: string;
  lastLabel: string;
  label: string;
}) {
  const top = 10;
  const bottom = 70;
  const left = 34;
  const right = W - 12;
  const last = standings.length - 1;
  const x = (i: number) => (last === 0 ? right : left + (i * (right - left)) / last);
  const y = (position: number) => top + ((position - 1) * (bottom - top)) / Math.max(1, participants - 1);
  // A prize position too close to the one above would print on top of it.
  const shown = [...new Set(marks)].sort((a, b) => a - b).filter((m, i, all) => i === 0 || y(m) - y(all[i - 1]) >= 12);
  const lastY = y(standings[last]);

  return (
    <svg viewBox={`0 0 ${W} 96`} role="img" aria-label={label} className="block h-auto w-full">
      {shown.map((mark) => (
        <g key={mark}>
          <line x1={left - 8} x2={W - 4} y1={y(mark)} y2={y(mark)} strokeDasharray="3 3" className="stroke-gold/70" />
          <text x={0} y={y(mark) + 4} className="fill-gold text-[11px]">
            {mark}°
          </text>
        </g>
      ))}
      <polyline
        points={standings.map((position, i) => `${x(i)},${y(position)}`).join(" ")}
        fill="none"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-sport"
      />
      <circle cx={x(last)} cy={lastY} r={4} className="fill-gold" />
      <text x={W - 4} y={lastY > 30 ? lastY - 9 : lastY + 17} textAnchor="end" className="fill-foreground text-[12px] font-semibold">
        {standings[last]}°
      </text>
      {last > 0 && (
        <text x={left} y={92} textAnchor="middle" className="fill-muted text-[11px]">
          {firstLabel}
        </text>
      )}
      <text x={right} y={92} textAnchor="middle" className="fill-muted text-[11px]">
        {lastLabel}
      </text>
    </svg>
  );
}

export interface NetPoint {
  label: string;
  /** Net accumulated up to this point. */
  cents: Cents;
  /** Not paid yet: drawn dashed. */
  pending?: boolean;
  /** A round where the player took the weekly prize. */
  won?: boolean;
}

const wholePesos = (cents: Cents) => formatNet(Math.round(cents / 100) * 100);

/**
 * Accumulated net as a line starting at $0. By meeting, each dot is green or red for
 * what was collected or paid there; by round, gold dots mark the rounds won.
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
  const labels = axisLabels(points.map((p) => p.label), step);

  // Amounts are printed at the last point and, when there's room, at the highest and lowest.
  const n = points.length;
  const tags = new Map<number, "above" | "below">();
  const far = (i: number) => Math.abs(x(i) - x(n)) >= 48;
  const lowest = values.indexOf(min, 1);
  const highest = values.indexOf(max, 1);
  if (lowest > 0 && far(lowest)) tags.set(lowest, "below");
  if (highest > 0 && far(highest)) tags.set(highest, "above");
  tags.set(n, values[n] >= values[n - 1] ? "above" : "below");

  return (
    <svg viewBox={`0 0 ${W} 128`} role="img" aria-label={label} className="block h-auto w-full">
      <line x1={left - 8} x2={W - 4} y1={y(0)} y2={y(0)} strokeDasharray="3 3" className="stroke-muted" />
      <text x={0} y={y(0) + 4} className="fill-muted text-[11px]">
        $0
      </text>
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
        const tag = tags.get(i + 1);
        return (
          <g key={i}>
            {point.pending ? (
              <circle cx={cx} cy={cy} r={3.5} strokeWidth={2} className="fill-surface stroke-muted" />
            ) : by === "meeting" ? (
              <circle cx={cx} cy={cy} r={4} className={change > 0 ? "fill-positive" : change < 0 ? "fill-negative" : "fill-muted"} />
            ) : point.won ? (
              <circle cx={cx} cy={cy} r={4} className="fill-gold" />
            ) : (
              n <= 20 && <circle cx={cx} cy={cy} r={2.5} className="fill-foreground" />
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
  );
}
