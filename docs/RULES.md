# Atsui bets — Game rules

This document is the source of truth for scoring, deadlines and money. The code in
`src/domain` implements exactly these rules; if they ever disagree, this document wins
and the code is a bug.

Terminology:

- **Pool** (*quiniela*): one sport for one season, e.g. "Liga MX Apertura 2026".
- **Round** (*jornada*): the unit that is scored and paid. A Liga MX matchday, an NFL
  week, an F1 Grand Prix, or an F1 Sprint.
- **Event**: a single match or race inside a round.
- **Pick**: a participant's prediction for one event.

## 1. Enrollment

- Participants enroll in a pool **before the season starts** and stay enrolled for the
  whole season. Nobody joins mid-season; they wait for the next one.
- Every enrolled participant **pays every round**, whether or not they submit picks.
- Missing picks score 0 points, but the participant still counts in the standings
  (including for the second-to-last prize).
- Different pools can have different participants. A person may play one, two or all
  three sports.

## 2. Picks and scoring

| | Liga MX | NFL | F1 (GP and Sprint) |
|---|---|---|---|
| Pick | Home / Draw / Away per match | Winner per game | Driver for each of P1–P10 |
| Points | 1 per correct result | 1 per correct winner | 1 per driver in the exact position |
| Max per round | number of matches | number of games | 10 |

Details:

- **Liga MX**: regular season only; the playoffs (*liguilla*) are not played.
  A match postponed outside its matchday does not count (nobody scores it).
- **NFL**: an NFL game that ends in a tie awards no points. No tiebreakers.
- **F1**: a driver can be picked only once per round. Results follow the official
  classification; if it changes afterwards (e.g. a disqualification) an admin re-scores
  the round. A Sprint weekend produces **two rounds** (Sprint and GP), each paid and
  scored independently.

## 3. Pick deadlines

All times are **America/Mexico_City**.

| Pool | Lock |
|---|---|
| Liga MX | Whole round locks at 23:59 the day **before** the round's first match |
| NFL | Each game locks individually 5 minutes before kickoff |
| F1, Sprint weekend | Sprint and GP picks both lock **Thursday 15:00** |
| F1, regular weekend | GP picks lock **Friday 15:00** |

Other participants' picks are hidden until the pick is locked.

## 4. Money per round

The same rules apply to Liga MX, NFL and F1.

- Every enrolled participant contributes **$100 MXN** per round.
- `pot = participants × 100`
- **75 %** of the pot is the **weekly prize**, paid to the round's winner.
- **25 %** goes to the pool's season **jackpot** (*acumulado*).

### Weekly prize

Only first place wins. If several participants tie for the most points, they **split
the weekly prize equally**.

### Perfect round

A participant who gets **every pick of a round right** wins **$1,000 MXN from the
jackpot**, on top of the weekly prize.

- Liga MX: every match of the matchday that counts (postponed matches are excluded).
- NFL: every game of the week that has a winner (ties and cancelled games are excluded).
- F1: all ten positions exact.
- If several people have a perfect round, each one gets $1,000. If the jackpot holds
  less than what is owed, whatever is left is split equally among them.

### Rounding

Amounts are computed in cents. When a split is not exact, each share is rounded down
to the cent and the leftover cents go to the jackpot.

## 5. Season jackpot

`jackpot = 25 % of every round's pot − perfect-round bonuses paid`

At the end of the season the jackpot is paid out using the **season standings** (sum of
points over all rounds):

| Prize | Position | Share of the jackpot |
|---|---|---|
| Winner | 1st | 50 % |
| Lucky seven | 7th | 35 % |
| Bobby | second-to-last (N − 1) | 15 % |

### Ties

Participants tied on points occupy a *range* of positions. If that range contains a
prize position, the tied participants **split that prize equally**. If the range
contains several prize positions, they split the sum of those prizes.

Examples with 15 participants:

- Two people tied for the most points occupy positions 1–2 → they split the 50 %.
- Three people tied at positions 6–8 → the range contains 7 → they split the 35 %.
- Positions 13–15 tied → the range contains 14 (N − 1) → they split the 15 %.

## 6. Monthly settlement

Money does not change hands per round. The family meets once a month, on the weekend
of the first week of the month, and settles everything since the previous meeting.

**Each pool is settled on its own**, by that pool's sub-admin: every enrolled
participant pays $100 for each round of the period, the weekly prizes of those rounds
are paid out, and the rest is kept for the pool's jackpot.

- Each pool has its own settlement periods. Each period has a **cutoff**: Saturday 00:00 of the meeting weekend
  (default: the first Saturday of the month; admins can change it).
- A round belongs to a period only if it has **completely finished before the cutoff**
  (before Saturday). Otherwise it moves to the next period. For example, a Liga MX
  matchday that ends on Sunday of the meeting weekend is settled the following month.
- A round's finish time is the estimated end of its last event: kickoff + 2 h for
  Liga MX, kickoff + 3.5 h for NFL, start + 2 h for F1. Admins can move a round to
  another period by hand if needed.
- For each person in the pool the settlement shows:
  - **Owes**: $100 × rounds in the period
  - **Won**: weekly prizes and perfect-round bonuses won in the period
  - **Net**: won − owes (positive = collects, negative = pays)
- The pool's sub-admin (or the admin) marks the period as settled; the action is
  recorded in the audit log.

## 7. Roles

| Role | Can |
|---|---|
| Admin | Everything, including naming and removing sub-admins |
| Sub-admin | Manage **their assigned pool**: enrollments, results, entering picks on behalf of a participant, and closing its monthly settlement |
| Participant | Submit their own picks, view standings and money |

Every admin action (pick entered on someone's behalf, result corrected, payment
recorded, period settled) is written to the audit log with who and when.
