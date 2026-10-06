import { requirePlayer } from "@/lib/dal";
import { getPlayerPools } from "@/lib/stats";
import { StatsSummary } from "./summary";

export default async function MyStatsPage() {
  const viewer = await requirePlayer();
  const player = { id: viewer.id, name: viewer.nickname ?? viewer.displayName };
  return <StatsSummary player={player} mine pools={await getPlayerPools(player.id)} />;
}
