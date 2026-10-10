-- A player can let someone else enter their picks in a pool (a couple, for instance).
-- The delegate plays by the player's own rules: only before the lock. Entries are
-- audited like any other on-behalf pick, because entered_by differs from player_id.

create table public.pick_delegates (
  pool_id uuid not null references public.pools (id) on delete cascade,
  -- Whose picks they are.
  player_id uuid not null references public.players (id) on delete cascade,
  -- Who may enter them.
  delegate_id uuid not null references public.players (id) on delete cascade,
  primary key (pool_id, player_id, delegate_id),
  check (player_id <> delegate_id)
);

create index pick_delegates_delegate_idx on public.pick_delegates (delegate_id);

create trigger audit after insert or update or delete on public.pick_delegates
for each row execute function public.audit();

alter table public.pick_delegates enable row level security;

create policy "players can read" on public.pick_delegates for select to authenticated
  using (public.current_player_id() is not null);
create policy "pool admins write" on public.pick_delegates for all to authenticated
  using (public.is_pool_admin(pool_id)) with check (public.is_pool_admin(pool_id));

grant select, insert, update, delete on public.pick_delegates to authenticated;
grant all on public.pick_delegates to service_role;

create function public.is_pick_delegate(p_pool_id uuid, p_player_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pick_delegates
    where pool_id = p_pool_id
      and player_id = p_player_id
      and delegate_id = public.current_player_id()
  )
$$;

grant execute on function public.is_pick_delegate(uuid, uuid) to authenticated, service_role;

-- Picks can be written before the lock by the player or their delegate, or by an
-- admin of that pool at any time.
create or replace function public.can_write_pick(p_event_id uuid, p_player_id uuid, p_entered_by uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select p_entered_by = public.current_player_id()
    and public.is_enrolled(public.pool_of_event(p_event_id), p_player_id)
    and (
      (
        (
          p_player_id = public.current_player_id()
          or public.is_pick_delegate(public.pool_of_event(p_event_id), p_player_id)
        )
        and not public.event_is_locked(p_event_id)
      )
      or public.is_pool_admin(public.pool_of_event(p_event_id))
    )
$$;

-- A delegate sees the picks they enter, also before the lock.
create or replace function public.can_read_pick(p_event_id uuid, p_player_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.current_player_id() is not null and (
    p_player_id = public.current_player_id()
    or public.event_is_locked(p_event_id)
    or public.is_pool_admin(public.pool_of_event(p_event_id))
    or public.is_pick_delegate(public.pool_of_event(p_event_id), p_player_id)
  )
$$;
