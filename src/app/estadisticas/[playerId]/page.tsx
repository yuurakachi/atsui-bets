import { notFound } from "next/navigation";
import { requirePlayer } from "@/lib/dal";
import { getPlayerPools, getStatsPlayer, getStatsPlayers } from "@/lib/stats";
import { StatsSummary } from "../summary";

/** Anyone in the family can open anyone's statistics: the same numbers are in the standings. */
export default async function PlayerStatsPage({ params }: PageProps<"/estadisticas/[playerId]">) {
  const { playerId } = await params;
  const [viewer, player] = await Promise.all([requirePlayer(), getStatsPlayer(playerId)]);
  if (!player) notFound();
  const [pools, players] = await Promise.all([getPlayerPools(player.id), getStatsPlayers()]);
  return <StatsSummary player={player} viewerId={viewer.id} players={players} pools={pools} />;
}
