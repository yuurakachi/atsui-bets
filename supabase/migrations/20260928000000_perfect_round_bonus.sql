-- Perfect rounds pay $1,000 from the season jackpot (docs/RULES.md §4). Kept apart from
-- prize_cents, the weekly prize, so the jackpot balance can be derived:
--   jackpot = opening + sum(rounds.jackpot_cents) - sum(round_results.bonus_cents)
alter table public.round_results
  add column bonus_cents integer not null default 0 check (bonus_cents >= 0);

comment on column public.round_results.prize_cents is 'Weekly prize (75 % of the pot, split among first place).';
comment on column public.round_results.bonus_cents is 'Perfect-round bonus paid from the season jackpot.';
comment on column public.rounds.jackpot_cents is 'Contribution to the season jackpot: 25 % of the pot plus rounding leftovers.';
