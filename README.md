# Atsui bets

A family prediction-pool app for **Liga MX**, **NFL** and **Formula 1**.

Every week our family plays three separate pools: NFL picks lived in Yahoo Fantasy, while
Liga MX and F1 picks were sent over WhatsApp to one person who kept the standings and the
money by hand. Atsui bets replaces all of that with a single mobile-first web app:
everyone submits their picks in one place, picks lock automatically, results are imported
from public sports APIs, and standings, prizes and the monthly money settlement are
computed for us.

> **Status:** in development. The rules engine is implemented and tested; the database,
> auth and UI are next. See the [roadmap](#roadmap).

## Features

- **Three sports, one app** — Liga MX (home / draw / away), NFL (winner) and F1
  (P1–P10, Sprints included).
- **Per-pool membership** — each sport has its own participants; people can play one,
  two or all three.
- **Automatic deadlines** — per-sport lock rules in Mexico City time, from whole-matchday
  locks to per-game locks five minutes before kickoff.
- **Prize engine** — each round's pot pays a weekly prize to the winner and feeds a
  season jackpot, which pays a bonus for perfect rounds and is split at the end of the
  season between 1st, *lucky seven* and *bobby* (second-to-last), with fair tie
  splitting and cent-exact rounding.
- **Monthly settlement** — one statement per person per month: what they owe, what they
  won, and the net amount to pay or collect at the family meeting.
- **Admins and sub-admins** — sub-admins manage their own sport, can enter picks on
  someone's behalf, and every admin action is recorded in an audit log.

The full rules are in [docs/RULES.md](docs/RULES.md).

## Tech stack

| | |
|---|---|
| App | Next.js (App Router), React, TypeScript, installable PWA |
| Styling | Tailwind CSS |
| Data & auth | Supabase (Postgres, Auth, Row Level Security) |
| Jobs | Supabase `pg_cron` + Edge Functions |
| Hosting | Vercel |
| Tests | Vitest |
| Data sources | ESPN (Liga MX, NFL), Jolpica (F1) |

Design notes, data model and permissions: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Project structure

```
src/
  app/        Next.js routes (UI in Spanish)
  domain/     Pure, framework-free rules: scoring, standings, prizes, deadlines, settlement
docs/         Game rules and architecture
```

The `domain` layer has no dependencies on Next.js or the database, so every rule that
touches points or money is covered by unit tests.

## Getting started

Requires Node.js 24+.

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # rules engine tests
npm run lint
```

## Roadmap

- [x] Game rules and architecture
- [x] Rules engine: scoring, tie-aware prizes, deadlines, monthly settlement
- [x] Database schema, auth and roles (Supabase)
- [x] Liga MX end to end: import of the current season, fixtures from ESPN, picks,
      automatic scoring, standings
- [x] Monthly settlement per pool
- [x] Admin screen for players and emails
- [x] "Who's missing" WhatsApp reminders
- [ ] Formula 1 with Sprint weekends
- [ ] NFL (replacing Yahoo Fantasy)
- [ ] Push notifications
