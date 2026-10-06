import { notFound } from "next/navigation";
import { requirePlayer } from "@/lib/dal";
import { getPlayerPools, getStatsPlayer } from "@/lib/stats";
import { StatsSummary } from "../summary";

/** Anyone in the family can open anyone's statistics: the same numbers are in the standings. */
export default async function PlayerStatsPage({ params }: PageProps<"/estadisticas/[playerId]">) {
  const { playerId } = await params;
  const [viewer, player] = await Promise.all([requirePlayer(), getStatsPlayer(playerId)]);
  if (!player) notFound();
  return <StatsSummary player={player} mine={player.id === viewer.id} pools={await getPlayerPools(player.id)} />;
}
