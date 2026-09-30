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
| NFL | ESPN public scoreboard API (`football/nfl`) | Schedule, kickoff times, winners |
| Liga MX | ESPN public scoreboard API (`soccer/mex.1`) | Matchdays, kickoff times, results |
| F1 | Jolpica (Ergast successor) | Calendar, sprint weekends, classified results |

API-Football was the first choice for Liga MX, but its free plan doesn't cover the
current season. ESPN's endpoint is unofficial and has blocked some server-side
requests, so the admin screens can also fetch it from the admin's browser, and results
can always be entered by hand.

Admins can always enter or correct results by hand; automatic imports are a
convenience, never the only path.

## Data model

The schema lives in [`supabase/migrations`](../supabase/migrations).

```
players             id, display_name, nickname, email, user_id → auth.users, is_admin
pools               id, sport (liga_mx | nfl | f1), season, status, entry_fee_cents,
                    jackpot_opening_cents
pool_admins         pool_id, player_id                       -- sub-admins per pool
enrollments         pool_id, player_id                       -- season-long membership
settlement_periods  id, pool_id, cutoff_at, settled_at, settled_by   -- one set per pool
rounds              id, pool_id, name, kind (matchday | week | gp | sprint), ordinal,
                    status, settlement_period_id, pot_cents, jackpot_cents
events              id, round_id, external_id, name, home_team, away_team,
                    starts_at, lock_at, result (home | draw | away | void)
f1_drivers          id, season, code, name, team
f1_classification   event_id, position, driver_id
match_picks         event_id, player_id, selection, entered_by, updated_at
f1_picks            event_id, player_id, position (1–10), driver_id, entered_by, updated_at
round_results       round_id, player_id, points, position, prize_cents
audit_log           id, actor_id, action, entity, entity_id, payload, created_at
```

Notes:

- **Players exist before they log in.** Admins create players with an email; when that
  person signs in for the first time, their account is linked automatically. This is
  what lets admins import past standings and enter picks for people who never use the
  app. `user_id` always follows `email` and can't be set by hand.
- **Every event has its own `lock_at`**, computed by `src/domain/deadlines.ts`. For
  Liga MX all events of a matchday share it; for NFL each game has its own. This keeps
  the pick permissions identical for every sport.
- `entered_by` differs from `player_id` when an admin enters a pick on someone's
  behalf; those picks are audited.
- `round_results` and the round's pot/jackpot are derived from picks and results, but
  stored so history is fast to read and past seasons can be imported without picks.
- Imported rounds from before the app existed have results but no events or picks.

## Permissions (Row Level Security)

Enforced in Postgres, so they hold no matter which client talks to the database.

- Anonymous visitors and signed-in users who are not a registered player see nothing.
- Players read their own picks at any time and others' picks only after the lock.
- Players write only their own picks, only in pools they're enrolled in, and only
  before the lock.
- Sub-admins write enrollments, rounds, events, results and on-behalf picks only for
  the pools they manage, and can add players.
- Sub-admins also create and close their pool's settlement periods.
- Only the admin manages pools, sub-admins and admin rights.
- The audit log is written by triggers only; admins and sub-admins can read it.
- Server jobs (results import, scoring) use the secret key and bypass RLS.

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
5. **Settlement** (per pool) — monthly settlement: owes / won / net per person.
6. **Admin** — enrollments, payments, on-behalf picks, results, data import, audit log,
   and a ready-to-send WhatsApp reminder naming who still has open picks (never what
   anyone picked).

## Delivery plan

1. Foundation: project setup, schema, auth, roles, audit log, domain rules with tests.
2. Liga MX end to end, including import of the current season's standings.
3. F1, including sprint weekends.
4. Money: payments, monthly settlement, jackpots.
5. NFL (replacing Yahoo Fantasy).
6. Polish: push notifications, stats.
