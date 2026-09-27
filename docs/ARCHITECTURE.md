# Atsui bets — Architecture

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js (App Router) + TypeScript, installable as a PWA | One codebase for UI and server actions; feels like a native app on phones |
| Styling | Tailwind CSS | Fast mobile-first UI |
| Database & auth | Supabase (Postgres + Auth + Row Level Security) | Relational data, magic-link / Google login, permissions enforced in the DB |
| Hosting | Vercel | Zero-config Next.js deploys |
| Scheduled jobs | Supabase `pg_cron` + Edge Functions | Fetch fixtures/results and lock rounds on time |
| Tests | Vitest | The scoring and money rules are pure functions with full test coverage |

Everything fits in the free tiers for a group of ~15 people.

## Data sources

| Sport | Source | Used for |
|---|---|---|
| NFL | ESPN public scoreboard API | Schedule, kickoff times, winners |
| Liga MX | API-Football | Matchdays, kickoff times, results |
| F1 | Jolpica (Ergast successor) | Calendar, sprint weekends, classified results |

Admins can always enter or correct results by hand; automatic imports are a
convenience, never the only path.

## Data model

```
profiles            id, display_name, nickname, role (admin | participant)
pools               id, sport (liga_mx | nfl | f1), season, name, status
pool_admins         pool_id, profile_id                      -- sub-admins per pool
enrollments         pool_id, profile_id                      -- season-long membership
rounds              id, pool_id, name, kind (matchday | week | gp | sprint),
                    lock_at (null for per-event locking), settlement_period_id, status
events              id, round_id, external_id, home, away, starts_at, lock_at, result
f1_drivers          id, code, name, team, season
picks               profile_id, event_id, selection, entered_by, updated_at
round_results       round_id, profile_id, points, position, prize_cents
jackpots            pool_id, amount_cents
settlement_periods  id, cutoff_at, settled_at, settled_by
payments            settlement_period_id, profile_id, amount_cents, recorded_by
audit_log           id, actor_id, action, entity, entity_id, payload, created_at
```

Notes:

- An F1 round has one event (the race) and ten picks per participant, one per position
  (`selection` = driver, keyed by position).
- `picks.entered_by` differs from `profile_id` when an admin enters a pick on someone's
  behalf.
- Round results are derived data: they can always be recomputed from picks and event
  results.

## Permissions (Row Level Security)

- Participants read their own picks at any time and others' picks only after the
  pick's lock time.
- Participants write only their own picks and only before the lock time.
- Sub-admins write enrollments, results, payments and on-behalf picks only for the
  pools they are assigned to.
- The admin can do everything.

## Code layout

```
src/
  app/            Next.js routes (UI in Spanish)
  domain/         Pure rules: scoring, standings, prizes, deadlines, settlement
  lib/            Supabase clients, data-source adapters
supabase/
  migrations/     SQL schema and RLS policies
docs/             Rules and architecture
```

## Screens

1. **Home** — pending picks and their deadlines.
2. **Make picks** — one card per match; F1 is an ordered P1–P10 picker.
3. **Round** — everyone's picks (after lock), live results, standings and prize leaders.
4. **Season** — season standings and current jackpot.
5. **Money** — monthly settlement: owes / won / net per person.
6. **Admin** — enrollments, payments, on-behalf picks, results, data import, audit log.

## Delivery plan

1. Foundation: project setup, schema, auth, roles, audit log, domain rules with tests.
2. Liga MX end to end, including import of the current season's standings.
3. F1, including sprint weekends.
4. Money: payments, monthly settlement, jackpots.
5. NFL (replacing Yahoo Fantasy).
6. Polish: push notifications, "remind who's missing" WhatsApp message, stats.
