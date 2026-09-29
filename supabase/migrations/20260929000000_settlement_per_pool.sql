-- Money is settled per pool: each sport's sub-admin collects and pays their own
-- pool at the monthly meeting (docs/RULES.md §6). Settlement periods move from global
-- to per pool, and the pool's admins can close them.

alter table public.settlement_periods
  add column pool_id uuid references public.pools (id) on delete cascade;

-- Existing periods belong to the pool of the rounds assigned to them.
update public.settlement_periods sp
set pool_id = (select r.pool_id from public.rounds r where r.settlement_period_id = sp.id limit 1);
delete from public.settlement_periods where pool_id is null;

alter table public.settlement_periods
  alter column pool_id set not null,
  drop constraint settlement_periods_cutoff_at_key,
  add constraint settlement_periods_pool_cutoff_key unique (pool_id, cutoff_at);

-- A round can only be settled in a period of its own pool.
create function public.check_round_period() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.settlement_period_id is not null and new.pool_id <> (
    select pool_id from public.settlement_periods where id = new.settlement_period_id
  ) then
    raise exception 'Settlement period belongs to another pool';
  end if;
  return new;
end;
$$;

create trigger check_round_period
before insert or update of settlement_period_id, pool_id on public.rounds
for each row execute function public.check_round_period();

drop policy "admin writes" on public.settlement_periods;
create policy "pool admins write" on public.settlement_periods for all to authenticated
  using (public.is_pool_admin(pool_id)) with check (public.is_pool_admin(pool_id));

revoke execute on function public.check_round_period() from public, anon;
