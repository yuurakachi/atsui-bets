import { F1_PICK_POSITIONS, scoreF1Pick } from "@/domain";
import type { F1RoundDetail } from "@/lib/f1";

const POSITIONS = Array.from({ length: F1_PICK_POSITIONS }, (_, i) => i);
const COLUMNS = `4rem repeat(${F1_PICK_POSITIONS}, minmax(1.625rem, 1fr)) 1.75rem`;
// The name column stays put while the positions scroll sideways on narrow phones.
const STICKY = "sticky left-0 z-10 -ml-2 bg-surface pl-2";

/** Everyone's P1–P10 once the round locked, marked against the official classification. */
export function F1PicksGrid({ round, currentPlayerId }: { round: F1RoundDetail; currentPlayerId: string }) {
  if (!round.event || round.event.lockAt > new Date()) return null;
  // Rounds imported from before the app only have points.
  if (round.status === "completed" && Object.keys(round.picks).length === 0) return null;

  const code = new Map(round.drivers.map((d) => [d.id, d.code]));
  const official = round.classification;
  const scored = official.length >= F1_PICK_POSITIONS;
  const rows = round.players
    .map((player) => {
      const pick = round.picks[player.id] ?? [];
      return { ...player, pick, points: scored ? scoreF1Pick(pick, official) : null };
    })
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || a.name.localeCompare(b.name));

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Pics de todos</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface">
        <div className="min-w-fit font-mono text-[0.7rem]">
          <div
            className="grid gap-0.5 border-b border-border px-2 py-2 font-sans text-xs font-medium text-muted"
            style={{ gridTemplateColumns: COLUMNS }}
          >
            <span className={STICKY}>Jugador</span>
            {POSITIONS.map((i) => (
              <span key={i} className="text-center">
                P{i + 1}
              </span>
            ))}
            <span className="text-right">Pts</span>
          </div>
          {scored && (
            <div
              className="grid items-center gap-0.5 border-b border-border bg-foreground/5 px-2 py-1.5"
              style={{ gridTemplateColumns: COLUMNS }}
            >
              <span className={`${STICKY} font-sans text-sm font-semibold`}>Oficial</span>
              {POSITIONS.map((i) => (
                <span key={i} className="text-center font-bold">
                  {code.get(official[i]) ?? "·"}
                </span>
              ))}
              <span />
            </div>
          )}
          {rows.map((row) => (
            <div
              key={row.id}
              className={`grid items-center gap-0.5 border-b border-border px-2 py-1.5 last:border-0 ${
                row.id === currentPlayerId ? "bg-gold/15" : ""
              }`}
              style={{ gridTemplateColumns: COLUMNS }}
            >
              <span className={`${STICKY} truncate font-sans text-sm font-medium`}>{row.name}</span>
              {POSITIONS.map((i) => {
                const driver = row.pick[i];
                const hit = scored && driver != null && driver === official[i];
                return (
                  <span
                    key={i}
                    className={`rounded text-center leading-6 ${
                      hit ? "bg-positive/25 font-bold ring-1 ring-positive ring-inset" : scored && driver ? "text-muted" : ""
                    }`}
                  >
                    {driver ? (code.get(driver) ?? "?") : "·"}
                  </span>
                );
              })}
              <span className="text-right font-sans text-sm font-semibold tabular-nums">{row.points ?? "—"}</span>
            </div>
          ))}
        </div>
      </div>
      {!scored && <p className="mt-2 text-xs text-muted">Falta la clasificación oficial.</p>}
    </section>
  );
}
