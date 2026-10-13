import { notFound } from "next/navigation";
import { requirePlayer } from "@/lib/dal";
import { getPoolOverview } from "@/lib/pools";
import { getPickStats, getPoolStats, getStatsPlayer } from "@/lib/stats";
import { PoolDetail } from "../../pool-detail";

export default async function PoolStatsPage({ params }: PageProps<"/estadisticas/[playerId]/[poolId]">) {
  const { playerId, poolId } = await params;
  const [viewer, player] = await Promise.all([requirePlayer(), getStatsPlayer(playerId)]);
  if (!player) notFound();
  const [pool, picks, overview] = await Promise.all([
    getPoolStats(playerId, poolId),
    getPickStats(playerId, poolId),
    getPoolOverview(poolId),
  ]);
  if (!pool) notFound();
  const players = overview.season.map((row) => ({ id: row.playerId, name: row.name }));
  return <PoolDetail player={player} viewerId={viewer.id} players={players} pool={pool} picks={picks} />;
}
