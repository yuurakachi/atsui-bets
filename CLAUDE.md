@AGENTS.md

# Atsui bets

- `docs/RULES.md` is the source of truth for scoring, deadlines and money. Any change to a
  rule updates that doc and the matching tests in `src/domain`.
- `src/domain` stays pure: no Next.js, Supabase or I/O imports.
- Money is integer cents (MXN). Times are computed in `America/Mexico_City`.
- Docs, code and README in English; the UI is in Spanish.
