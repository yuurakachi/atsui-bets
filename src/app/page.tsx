import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { requirePlayer } from "@/lib/dal";
import { getUpcomingRounds } from "@/lib/rounds";
import { Logo } from "./logo";
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
      <header className="flex items-center gap-3">
        <Logo className="h-auto w-24 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm text-muted">
            Bienvenido
            {player.isAdmin && (
              <span className="rounded-full border border-gold/60 px-1.5 text-[0.65rem] font-semibold text-gold">
                Admin
              </span>
            )}
          </p>
          <h1 className="script truncate">Hola, {player.nickname ?? player.displayName}</h1>
          <span aria-hidden="true" className="swoosh mt-1 ml-2 w-28" />
        </div>
        <form action={signOut} className="self-start">
          <button type="submit" className="rounded-lg px-2 py-1 text-sm text-muted hover:text-foreground">
            Salir
          </button>
        </form>
      </header>

      {upcoming.length > 0 && (
        <section className="mt-8">
          <h2>Tus pics</h2>
          <div className="mt-3 space-y-2">
            {upcoming.map((round) => (
              <UpcomingRoundCard key={round.id} round={round} poolName={poolName.get(round.poolId)} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2>Tus quinielas</h2>
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
                  data-sport={pool.sport}
                  className="flex items-center justify-between gap-3 rounded-xl border border-l-4 border-border border-l-sport bg-surface px-4 py-3 transition hover:border-accent hover:border-l-sport"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold tracking-wider text-sport uppercase">
                      {SPORT_LABEL[pool.sport]}
                    </span>
                    <span className="block truncate font-display text-xl font-bold uppercase">{pool.name}</span>
                  </span>
                  <span aria-hidden="true" className="text-muted">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
