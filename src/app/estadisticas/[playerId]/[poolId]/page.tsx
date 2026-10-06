import { notFound } from "next/navigation";
import { requirePlayer } from "@/lib/dal";
import { getPickStats, getPoolStats, getStatsPlayer } from "@/lib/stats";
import { PoolDetail } from "../../pool-detail";

export default async function PoolStatsPage({ params }: PageProps<"/estadisticas/[playerId]/[poolId]">) {
  const { playerId, poolId } = await params;
  const [viewer, player] = await Promise.all([requirePlayer(), getStatsPlayer(playerId)]);
  if (!player) notFound();
  const [pool, picks] = await Promise.all([getPoolStats(playerId, poolId), getPickStats(playerId, poolId)]);
  if (!pool) notFound();
  return <PoolDetail player={player} mine={player.id === viewer.id} pool={pool} picks={picks} />;
}
