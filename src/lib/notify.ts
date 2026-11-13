import "server-only";
import {
  CLOSING_NOTICE_MINUTES,
  F1_PICK_POSITIONS,
  closingBatches,
  quietHours,
  roundOutcome,
  shownRounds,
  type PickSlot,
  type Sport,
} from "@/domain";
import { playerName } from "./format";
import { closingMessage, openedMessage, winnerMessage } from "./notifications";
import { sendToPlayers } from "./push";
import { roundTitle } from "./reminders";
import type { createServiceClient } from "./supabase/service";

type Service = ReturnType<typeof createServiceClient>;

export interface NotifyReport {
  /** Keys of the notices handled in this run (see push_sent). */
  handled: string[];
  /** Phones that got a notification. */
  sent: number;
}

const HOUR = 60 * 60;

/**
 * Sends the notifications that are due: picks are open, picks lock in 10 minutes, and
 * round winners. It reads the state of the database, so rounds created or scored by hand
 * and by the automatic jobs are treated the same. Each notice is claimed in push_sent
 * before it's sent, so it never goes out twice. Pools that aren't active yet (only the
 * admin sees them) have their notices claimed but not sent.
 */
export async function sendDueNotifications(supabase: Service, now: Date): Promise<NotifyReport> {
  const [pools, enrollments, players, scheduled, completed, announced] = await Promise.all([
    supabase.from("pools").select("id, name, sport, status"),
    supabase.from("enrollments").select("pool_id, player_id"),
    supabase.from("players").select("id, display_name, nickname"),
    supabase
      .from("rounds")
      .select("id, pool_id, name, ordinal, events(id, lock_at, result)")
      .eq("status", "scheduled")
      .order("ordinal"),
    supabase.from("rounds").select("id, pool_id, name").eq("status", "completed"),
    supabase.from("push_sent").select("key").like("key", "winner:%"),
  ]);
  for (const r of [pools, enrollments, players, scheduled, completed, announced]) {
    if (r.error) throw new Error(r.error.message);
  }

  const pool = new Map(pools.data!.map((p) => [p.id, p]));
  const active = (poolId: string) => pool.get(poolId)?.status === "active";
  const name = new Map(players.data!.map((p) => [p.id, playerName(p)]));
  const enrolled = (poolId: string) => enrollments.data!.filter((e) => e.pool_id === poolId).map((e) => e.player_id);
  const roundById = new Map(scheduled.data!.map((r) => [r.id, r]));
  const label = (poolId: string, roundIds: string[]) =>
    `${pool.get(poolId)!.name} · ${roundIds.map((id) => roundTitle(roundById.get(id)!.name)).join(" y ")}`;

  const report: NotifyReport = { handled: [], sent: 0 };
  const send = async (playerIds: string[], message: Parameters<typeof sendToPlayers>[2], ttl: number) => {
    report.sent += await sendToPlayers(supabase, playerIds, message, ttl);
  };

  // Open events, without the matches that don't count (postponed).
  const openRounds = scheduled
    .data!.map((r) => {
      const events = r.events
        .filter((e) => e.result !== "void" && new Date(e.lock_at) > now)
        .map((e) => ({ id: e.id, lockAt: new Date(e.lock_at) }));
      const sport: Sport = pool.get(r.pool_id)!.sport;
      return { ...r, poolId: r.pool_id, sport, openEvents: events, firstLockAt: new Date(Math.min(...events.map((e) => e.lockAt.getTime()))) };
    })
    .filter((r) => r.openEvents.length > 0);

  // 1. Picks are open: once the player can see the round, but not at night.
  if (!quietHours(now)) {
    const shown = shownRounds(openRounds, now);
    const claimed = await claim(supabase, shown.map((r) => `opened:${r.id}`));
    const byPool = new Map<string, typeof shown>();
    for (const r of shown.filter((r) => claimed.has(`opened:${r.id}`))) {
      byPool.set(r.pool_id, [...(byPool.get(r.pool_id) ?? []), r]);
    }
    for (const [poolId, rounds] of byPool) {
      report.handled.push(...rounds.map((r) => `opened:${r.id}`));
      if (!active(poolId)) continue;
      const p = pool.get(poolId)!;
      const message = openedMessage({
        sport: p.sport,
        poolName: p.name,
        roundNames: rounds.map((r) => r.name),
        firstLockAt: new Date(Math.min(...rounds.map((r) => r.firstLockAt.getTime()))),
      });
      const url = rounds.length === 1 ? `/quinielas/${poolId}/jornadas/${rounds[0].id}` : `/quinielas/${poolId}`;
      await send(enrolled(poolId), { ...message, url }, 6 * HOUR);
    }
  }

  // 2. Picks lock in 10 minutes: only to whoever is missing one, and their delegates.
  const slots: PickSlot[] = openRounds.flatMap((r) =>
    r.openEvents.map((e) => ({
      eventId: e.id,
      roundId: r.id,
      poolId: r.pool_id,
      lockAt: e.lockAt,
      picksNeeded: r.sport === "f1" ? F1_PICK_POSITIONS : 1,
    })),
  );
  const until = now.getTime() + CLOSING_NOTICE_MINUTES * 60_000;
  const due = slots.filter((s) => s.lockAt.getTime() <= until);
  // Every lock time is claimed, even with nobody missing, so the minute check stops calling.
  const lockTimes = [...new Set(due.map((s) => s.lockAt.getTime()))];
  if (lockTimes.length > 0) {
    const eventIds = due.map((s) => s.eventId);
    const [matchPicks, f1Picks, delegates] = await Promise.all([
      supabase.from("match_picks").select("event_id, player_id").in("event_id", eventIds),
      supabase.from("f1_picks").select("event_id, player_id").in("event_id", eventIds),
      supabase.from("pick_delegates").select("pool_id, player_id, delegate_id"),
    ]);
    for (const r of [matchPicks, f1Picks, delegates]) if (r.error) throw new Error(r.error.message);
    const counts = new Map<string, { eventId: string; playerId: string; count: number }>();
    for (const p of [...matchPicks.data!, ...f1Picks.data!]) {
      const key = `${p.player_id}:${p.event_id}`;
      const entry = counts.get(key) ?? { eventId: p.event_id, playerId: p.player_id, count: 0 };
      entry.count++;
      counts.set(key, entry);
    }

    const batches = closingBatches({
      now,
      slots: due.filter((s) => active(s.poolId)),
      enrollments: enrollments.data!.map((e) => ({ poolId: e.pool_id, playerId: e.player_id })),
      picks: [...counts.values()],
      delegates: delegates.data!.map((d) => ({ poolId: d.pool_id, playerId: d.player_id, delegateId: d.delegate_id })),
    });
    const claimed = await claim(supabase, lockTimes.map((t) => `closing:${t}`));
    for (const lock of lockTimes.filter((t) => claimed.has(`closing:${t}`))) {
      report.handled.push(`closing:${lock}`);
      const notices = batches.find((b) => b.lockAt.getTime() === lock)?.notices ?? [];
      const ttl = (lock - now.getTime()) / 1000;
      for (const n of notices) {
        const message = closingMessage({
          lockAt: n.lockAt,
          own: n.missing
            .filter((m) => m.playerId === n.recipientId)
            .map((m) => ({ pool: label(m.poolId, m.roundIds), missing: m.missing })),
          others: n.missing
            .filter((m) => m.playerId !== n.recipientId)
            .map((m) => ({ name: name.get(m.playerId) ?? "?", pool: label(m.poolId, m.roundIds), missing: m.missing })),
        });
        const rounds = [...new Set(n.missing.flatMap((m) => m.roundIds))];
        const url = rounds.length === 1 ? `/quinielas/${roundById.get(rounds[0])!.pool_id}/jornadas/${rounds[0]}` : "/";
        await send([n.recipientId], { ...message, url }, ttl);
      }
    }
  }

  // 3. Round winners, once a round is scored (automatically or by hand).
  const done = new Set(announced.data!.map((a) => a.key));
  const scored = completed.data!.filter((r) => !done.has(`winner:${r.id}`));
  const claimedWinners = await claim(supabase, scored.map((r) => `winner:${r.id}`));
  for (const r of scored.filter((r) => claimedWinners.has(`winner:${r.id}`))) {
    report.handled.push(`winner:${r.id}`);
    if (!active(r.pool_id)) continue;
    const { data: results, error } = await supabase
      .from("round_results")
      .select("player_id, points, prize_cents, bonus_cents")
      .eq("round_id", r.id);
    if (error) throw new Error(error.message);
    if (results.length === 0) continue;
    const outcome = roundOutcome(
      results.map((x) => ({ playerId: x.player_id, points: x.points, prizeCents: x.prize_cents, bonusCents: x.bonus_cents })),
    );
    const p = pool.get(r.pool_id)!;
    const names = (ids: string[]) => ids.map((id) => name.get(id) ?? "?");
    const message = winnerMessage({
      sport: p.sport,
      poolName: p.name,
      roundName: r.name,
      winners: names(outcome.winnerIds),
      points: outcome.points,
      prizeEachCents: outcome.prizeEachCents,
      perfect: names(outcome.perfectIds),
      bonusEachCents: outcome.bonusEachCents,
    });
    await send(enrolled(r.pool_id), { ...message, url: `/quinielas/${r.pool_id}/jornadas/${r.id}` }, 24 * HOUR);
  }

  return report;
}

/** Marks these notices as sent and returns the ones this run got first: only those are sent. */
async function claim(supabase: Service, keys: readonly string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const { data, error } = await supabase
    .from("push_sent")
    .upsert(keys.map((key) => ({ key })), { onConflict: "key", ignoreDuplicates: true })
    .select("key");
  if (error) throw new Error(error.message);
  return new Set(data.map((d) => d.key));
}
