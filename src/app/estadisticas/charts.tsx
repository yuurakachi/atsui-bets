import { axisLabels, W } from "./chart-scale";

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
