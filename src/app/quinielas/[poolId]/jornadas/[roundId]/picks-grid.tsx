import type { RoundDetail } from "@/lib/rounds";
import { LivePicksGrid } from "./live-picks-grid";

/** Everyone's picks for the matches that already locked, marked against the results. */
export function PicksGrid({ round, currentPlayerId }: { round: RoundDetail; currentPlayerId: string }) {
  const now = new Date();
  const events = round.events
    .map((e, i) => ({ ...e, number: i + 1 }))
    .filter((e) => e.lockAt <= now)
    .map((e) => ({
      id: e.id,
      number: e.number,
      externalId: e.externalId,
      home: e.home,
      away: e.away,
      startsAt: e.startsAt.toISOString(),
      result: e.result,
    }));
  if (events.length === 0) return null;

  return (
    <LivePicksGrid
      sport={round.sport}
      events={events}
      players={round.players}
      picks={round.picks}
      currentPlayerId={currentPlayerId}
    />
  );
}
