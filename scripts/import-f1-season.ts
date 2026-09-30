/**
 * Imports the F1 season played before the app: creates the pool, enrolls the players,
 * names the sub-admin and loads every round already raced (Sprints included) with its
 * points, prizes, perfect-round bonuses, jackpot share and settlement period.
 *
 * CSV: one row per player; the first column is the player's nickname, then one column
 * per round in calendar order (each Sprint is its own column, before its GP), and an
 * optional TOTAL column used as a checksum. Column titles are free text: rounds are
 * matched by order, and the mapping is printed so it can be checked.
 *
 *   npx tsx scripts/import-f1-season.ts --csv data/private/f1.csv --season 2026 \
 *     --name "Fórmula 1 2026" --sub-admin Nickname --paid 18 --jackpot 12345.67 \
 *     --out data/private/f1.sql [--calendar data/private/f1-2026.json]
 *   npx supabase db query --linked -f data/private/f1.sql
 *
 * --paid      the first N rounds were already settled at a family meeting.
 * --jackpot   the jackpot the family has on paper (pesos): the import stops if the
 *             computed one differs.
 * --calendar  Jolpica's season schedule saved from the browser
 *             (https://api.jolpi.ca/ergast/f1/2026.json?limit=100), if Node can't reach it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  F1_PICK_POSITIONS,
  f1SeasonRounds,
  nextDefaultCutoff,
  perfectRoundBonus,
  rankEntries,
  roundFinishedAt,
  settleRound,
  type StandingEntry,
} from "../src/domain";
import { f1ExternalId, fetchF1Season, parseSchedule } from "../src/lib/jolpica";

const { values: args } = parseArgs({
  options: {
    csv: { type: "string" },
    season: { type: "string" },
    name: { type: "string" },
    "sub-admin": { type: "string" },
    paid: { type: "string", default: "0" },
    jackpot: { type: "string" },
    calendar: { type: "string" },
    out: { type: "string" },
  },
});
for (const required of ["csv", "season", "name", "out"] as const) {
  if (!args[required]) throw new Error(`Missing --${required}`);
}
const season = args.season!;

const pesos = (cents: number) => (cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const sql = (value: string) => `'${value.replaceAll("'", "''")}'`;

// --- Calendar -------------------------------------------------------------------------------

// Node scripts here compile to CommonJS, which has no top-level await.
async function main() {
  const races = args.calendar
    ? parseSchedule(JSON.parse(readFileSync(args.calendar, "utf8")))
    : (await fetchF1Season(season)).races;
  const calendar = f1SeasonRounds(races);
  console.log(`Calendario ${season}: ${races.length} carreras, ${calendar.length} jornadas con Sprints.`);

  // --- CSV ------------------------------------------------------------------------------------

  const [header, ...rows] = readFileSync(args.csv!, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(",").map((cell) => cell.trim()));
  const totalIndex = header.findIndex((h) => h.toUpperCase() === "TOTAL");
  const columns = header
    .map((title, index) => ({ title, index }))
    .filter(({ index }) => index > 0 && index !== totalIndex);

  const players = rows.map((row) => row[0]);
  if (new Set(players.map((p) => p.toLowerCase())).size !== players.length) {
    throw new Error("Duplicate player names in the CSV.");
  }
  for (const row of rows) {
    for (const { title, index } of columns) {
      const points = Number(row[index]);
      if (!Number.isInteger(points) || points < 0 || points > F1_PICK_POSITIONS) {
        throw new Error(`${row[0]}, ${title}: "${row[index]}" is not 0–${F1_PICK_POSITIONS} points.`);
      }
    }
    if (totalIndex !== -1) {
      const sum = columns.reduce((acc, { index }) => acc + Number(row[index]), 0);
      if (sum !== Number(row[totalIndex])) throw new Error(`${row[0]}: rounds add up to ${sum}, TOTAL says ${row[totalIndex]}.`);
    }
  }

  if (columns.length > calendar.length) throw new Error(`${columns.length} columns but only ${calendar.length} rounds.`);
  const paid = Number(args.paid);
  if (!Number.isInteger(paid) || paid < 0 || paid > columns.length) throw new Error(`--paid must be 0–${columns.length}.`);

  // --- Rounds -----------------------------------------------------------------------------------

  const now = Date.now();
  let jackpot = 0;
  let jackpotPaid = 0;
  const settledCutoffs = new Set<number>();
  const report: string[] = [];
  const wonByPlayer = new Map(players.map((p) => [p, 0]));

  const rounds = columns.map(({ title, index }, i) => {
    const plan = calendar[i];
    const finishedAt = roundFinishedAt("f1", [plan.startsAt]);
    if (finishedAt.getTime() > now) throw new Error(`Column ${title} maps to ${plan.name}, which hasn't finished.`);

    const entries: StandingEntry[] = rows.map((row) => ({ profileId: row[0], points: Number(row[index]) }));
    const settlement = settleRound(entries, { maxPoints: F1_PICK_POSITIONS });
    const bonus = perfectRoundBonus(jackpot, settlement.perfectIds.length);
    jackpot += settlement.jackpotCents - bonus * settlement.perfectIds.length;
    if (i < paid) jackpotPaid = jackpot;

    const positions = new Map<string, number>();
    for (const group of rankEntries(entries)) for (const id of group.profileIds) positions.set(id, group.from);
    for (const [player, cents] of settlement.wonCents) {
      const won = cents + (settlement.perfectIds.includes(player) ? bonus : 0);
      wonByPlayer.set(player, wonByPlayer.get(player)! + won);
    }

    // Paid rounds were settled at their meeting. Unpaid ones go to the next meeting that
    // hasn't happened yet (and isn't already closed).
    let cutoff = nextDefaultCutoff(finishedAt);
    if (i < paid) settledCutoffs.add(cutoff.getTime());
    else {
      if (cutoff.getTime() <= now) cutoff = nextDefaultCutoff(new Date(now));
      while (settledCutoffs.has(cutoff.getTime())) cutoff = nextDefaultCutoff(cutoff);
    }

    report.push(
      `${title.padEnd(10)} → ${plan.name.padEnd(22)} bolsa ${pesos(settlement.potCents)}, gana ` +
        `${settlement.winnerIds.join(", ")} (${pesos(settlement.perWinnerCents)} c/u)` +
        (settlement.perfectIds.length ? `, perfecta: ${settlement.perfectIds.join(", ")} +${pesos(bonus)}` : "") +
        `  [corte ${cutoff.toISOString().slice(0, 10)}${i < paid ? ", pagado" : ""}]`,
    );

    return { plan, entries, settlement, bonus, positions, cutoff, settled: i < paid };
  });

  console.log(report.join("\n"));
  console.log("\nGanado por jugador:");
  for (const [player, cents] of [...wonByPlayer].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${player.padEnd(12)} ${pesos(cents)}`);
  }
  console.log(`\nAcumulado: ${pesos(jackpot)} (hasta lo ya pagado: ${pesos(jackpotPaid)})`);

  if (args.jackpot) {
    const expected = Math.round(Number(args.jackpot) * 100);
    if (expected !== jackpot) {
      throw new Error(
        `The family's jackpot is ${pesos(expected)} but the rounds add up to ${pesos(jackpot)} ` +
          `(difference ${pesos(expected - jackpot)}). Check the points, --paid or the perfect rounds.`,
      );
    }
    console.log("✓ Coincide con el acumulado de la familia.");
  }

  // --- SQL --------------------------------------------------------------------------------------

  const cutoffs = [...new Map(rounds.map((r) => [r.cutoff.getTime(), r])).values()];
  const periodStatements = cutoffs
    .map(
      ({ cutoff, settled }) => `
    insert into public.settlement_periods (pool_id, cutoff_at, settled_at, settled_by)
    values (v_pool, ${sql(cutoff.toISOString())}, ${settled ? "now(), v_admin" : "null, null"})
    on conflict (pool_id, cutoff_at) do update
      set settled_at = coalesce(settlement_periods.settled_at, excluded.settled_at),
          settled_by = coalesce(settlement_periods.settled_by, excluded.settled_by)
    returning id into v_period;
    insert into import_periods values (${sql(cutoff.toISOString())}, v_period);`,
    )
    .join("\n");

  const roundStatements = rounds
    .map(({ plan, entries, settlement, bonus, positions, cutoff }) => {
      const values = entries
        .map((e) => {
          const perfect = settlement.perfectIds.includes(e.profileId) ? bonus : 0;
          return `(${sql(e.profileId)}, ${e.points}, ${positions.get(e.profileId)}, ${settlement.wonCents.get(e.profileId)}, ${perfect})`;
        })
        .join(",\n      ");
      const externalId = f1ExternalId(season, plan.raceRound, plan.kind);
      return `
    -- ${plan.name}
    insert into public.rounds (pool_id, name, kind, ordinal, status, pot_cents, jackpot_cents, settlement_period_id)
    values (v_pool, ${sql(plan.name)}, ${sql(plan.kind)}, ${plan.ordinal}, 'completed', ${settlement.potCents},
            ${settlement.jackpotCents}, (select id from import_periods where cutoff = ${sql(cutoff.toISOString())}))
    on conflict (pool_id, kind, ordinal) do update
      set name = excluded.name, status = excluded.status, pot_cents = excluded.pot_cents,
          jackpot_cents = excluded.jackpot_cents, settlement_period_id = excluded.settlement_period_id
    returning id into v_round;

    update public.events set starts_at = ${sql(plan.startsAt.toISOString())}, lock_at = ${sql(plan.lockAt.toISOString())}
    where round_id = v_round and external_id = ${sql(externalId)};
    if not found then
      insert into public.events (round_id, external_id, name, starts_at, lock_at)
      values (v_round, ${sql(externalId)}, ${sql(plan.name)}, ${sql(plan.startsAt.toISOString())}, ${sql(plan.lockAt.toISOString())});
    end if;

    delete from public.round_results where round_id = v_round;
    insert into public.round_results (round_id, player_id, points, position, prize_cents, bonus_cents)
    select v_round, ip.player_id, x.points, x.position, x.prize, x.bonus
    from (values
        ${values}
    ) as x (name, points, position, prize, bonus)
    join import_players ip on ip.name = x.name;`;
    })
    .join("\n");

  const playerStatements = players
    .map(
      (name) => `
    select id into v_player from public.players
    where lower(coalesce(nickname, display_name)) = lower(${sql(name)}) limit 1;
    if v_player is null then
      insert into public.players (display_name, nickname) values (${sql(name)}, ${sql(name)})
      returning id into v_player;
      raise notice 'New player: %', ${sql(name)};
    end if;
    insert into import_players values (${sql(name)}, v_player);
    insert into public.enrollments (pool_id, player_id) values (v_pool, v_player)
    on conflict do nothing;`,
    )
    .join("\n");

  const subAdmin = args["sub-admin"]
    ? `
    select id into v_player from public.players
    where lower(coalesce(nickname, display_name)) = lower(${sql(args["sub-admin"])}) limit 1;
    if v_player is null then raise exception 'Sub-admin % not found', ${sql(args["sub-admin"])}; end if;
    insert into public.pool_admins (pool_id, player_id) values (v_pool, v_player) on conflict do nothing;`
    : "";

  writeFileSync(
    args.out!,
    `-- Generated by scripts/import-f1-season.ts from ${args.csv}
  do $$
  declare
    v_pool uuid;
    v_round uuid;
    v_player uuid;
    v_period uuid;
    v_admin uuid := (select id from public.players where is_admin order by created_at limit 1);
  begin
    insert into public.pools (sport, season, name, status)
    values ('f1', ${sql(season)}, ${sql(args.name!)}, 'active')
    on conflict (sport, season) do update set name = excluded.name
    returning id into v_pool;

    create temp table import_players (name text primary key, player_id uuid not null) on commit drop;
    create temp table import_periods (cutoff timestamptz primary key, id uuid not null) on commit drop;
  ${playerStatements}
  ${subAdmin}
  ${periodStatements}
  ${roundStatements}
  end;
  $$;
  `,
  );
  console.log(`SQL escrito en ${args.out}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
