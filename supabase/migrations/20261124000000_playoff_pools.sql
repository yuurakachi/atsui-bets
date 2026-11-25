-- Playoff pools, like the Liga MX liguilla: a one-time buy-in instead of a fee per round,
-- players sign themselves up until the pool's first match locks, and rounds are loaded
-- by hand (they don't follow the regular season's shape).

alter table public.pools drop constraint pools_entry_fee_cents_check;
alter table public.pools
  add constraint pools_entry_fee_cents_check check (entry_fee_cents >= 0),
  -- Paid once per player; all of it goes to the prizes at the end (1st, 7th, second-to-last).
  add column buy_in_cents integer not null default 0 check (buy_in_cents >= 0),
  -- Registered players can join it themselves until its first match locks.
  add column self_signup boolean not null default false,
  -- No automatic rounds: the admin loads each phase.
  add column playoffs boolean not null default false;

-- When sign-up closes: the first lock of any match in the pool (null while there is none).
create function public.pool_first_lock(p_pool_id uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select min(e.lock_at) from public.events e join public.rounds r on r.id = e.round_id
  where r.pool_id = p_pool_id
$$;

-- A registered player joins a pool that takes sign-ups, before its first match locks.
create function public.join_pool(p_pool_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_player uuid := public.current_player_id();
  v_first_lock timestamptz;
begin
  if v_player is null then
    raise exception 'Only registered players can join a pool';
  end if;
  if not exists (select 1 from public.pools where id = p_pool_id and self_signup and status = 'active') then
    raise exception 'This pool does not take sign-ups';
  end if;
  v_first_lock := public.pool_first_lock(p_pool_id);
  if v_first_lock is not null and now() >= v_first_lock then
    raise exception 'Sign-up closed when the first match locked';
  end if;
  insert into public.enrollments (pool_id, player_id) values (p_pool_id, v_player)
  on conflict do nothing;
end;
$$;

grant execute on function public.pool_first_lock(uuid) to authenticated, service_role;
grant execute on function public.join_pool(uuid) to authenticated, service_role;
