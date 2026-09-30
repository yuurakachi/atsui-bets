import type { RoundDetail } from "@/lib/rounds";

const LETTER = { home: "L", draw: "E", away: "V" } as const;

/** Everyone's picks for the matches that already locked, marked against the results. */
export function PicksGrid({ round, currentPlayerId }: { round: RoundDetail; currentPlayerId: string }) {
  const now = new Date();
  const events = round.events.filter((e) => e.lockAt <= now);
  if (events.length === 0) return null;

  const pickOf = new Map(round.picks.map((p) => [`${p.playerId}:${p.eventId}`, p.selection]));
  const columns = `4.5rem repeat(${events.length}, minmax(1.375rem, 1fr))`;

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Pics de todos</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface">
        <div className="min-w-fit">
          <div className="grid gap-0.5 border-b border-border px-2 py-2 text-xs font-medium text-muted" style={{ gridTemplateColumns: columns }}>
            <span>Jugador</span>
            {events.map((e) => (
              <span key={e.id} className="text-center">
                {round.events.indexOf(e) + 1}
              </span>
            ))}
          </div>
          {round.players.map((player) => (
            <div
              key={player.id}
              className={`grid items-center gap-0.5 border-b border-border px-2 py-1.5 text-sm last:border-0 ${
                player.id === currentPlayerId ? "bg-accent/10" : ""
              }`}
              style={{ gridTemplateColumns: columns }}
            >
              <span className="truncate font-medium">{player.name}</span>
              {events.map((e) => {
                const pick = pickOf.get(`${player.id}:${e.id}`);
                const hit = pick && e.result && e.result !== "void" && pick === e.result;
                const miss = pick && e.result && !hit;
                return (
                  <span
                    key={e.id}
                    className={`rounded text-center font-mono text-xs leading-6 ${
                      hit ? "bg-accent font-bold text-accent-foreground" : miss ? "text-muted line-through" : ""
                    }`}
                  >
                    {pick ? LETTER[pick] : "·"}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <ol className="mt-3 grid gap-x-4 gap-y-0.5 text-xs text-muted sm:grid-cols-2">
        {events.map((e) => (
          <li key={e.id}>
            {round.events.indexOf(e) + 1}. {e.home} vs {e.away}
            {e.result && <span className="text-foreground"> · {e.result === "void" ? "no cuenta" : LETTER[e.result]}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
