import { requirePlayer } from "@/lib/dal";
import { getPlayerPools, getStatsPlayers } from "@/lib/stats";
import { StatsSummary } from "./summary";

export default async function MyStatsPage() {
  const viewer = await requirePlayer();
  const player = { id: viewer.id, name: viewer.nickname ?? viewer.displayName };
  const [pools, players] = await Promise.all([getPlayerPools(player.id), getStatsPlayers()]);
  return <StatsSummary player={player} viewerId={viewer.id} players={players} pools={pools} />;
}
