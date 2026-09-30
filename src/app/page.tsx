import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { requirePlayer } from "@/lib/dal";
import { getUpcomingRounds } from "@/lib/rounds";
import { UpcomingRoundCard } from "./upcoming-round-card";
import { createClient } from "@/lib/supabase/server";
import type { Sport } from "@/domain";

const SPORT_LABEL: Record<Sport, string> = {
  liga_mx: "Liga MX",
  nfl: "NFL",
  f1: "Fórmula 1",
};

export default async function HomePage() {
  const player = await requirePlayer();
  const supabase = await createClient();
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("pool:pools(id, name, sport, status)")
    .eq("player_id", player.id);

  const pools = (enrollments ?? []).map((e) => e.pool).filter((p) => p !== null);
  const upcoming = await getUpcomingRounds(pools.map((p) => p.id), player.id);
  const poolName = new Map(pools.map((p) => [p.id, p.name]));

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Atsui bets</p>
          <h1 className="text-2xl font-bold">Hola, {player.nickname ?? player.displayName}</h1>
        </div>
        <div className="flex items-center gap-2">
          {player.isAdmin && (
            <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
              Admin
            </span>
          )}
          <form action={signOut}>
            <button type="submit" className="rounded-lg px-2 py-1 text-sm text-muted hover:text-foreground">
              Salir
            </button>
          </form>
        </div>
      </header>

      {upcoming.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Tus pics</h2>
          <div className="mt-3 space-y-2">
            {upcoming.map((round) => (
              <UpcomingRoundCard key={round.id} round={round} poolName={poolName.get(round.poolId)} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Tus quinielas</h2>
        {pools.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-muted">
            Aún no estás inscrito en ninguna quiniela.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pools.map((pool) => (
              <li key={pool.id}>
                <Link
                  href={`/quinielas/${pool.id}`}
                  className="block rounded-xl border border-border bg-surface px-4 py-3 transition hover:border-accent"
                >
                  <p className="text-xs font-medium text-accent">{SPORT_LABEL[pool.sport]}</p>
                  <p className="font-medium">{pool.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
