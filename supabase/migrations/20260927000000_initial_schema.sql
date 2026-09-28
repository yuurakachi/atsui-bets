-- Atsui bets: initial schema.
-- Rules live in docs/RULES.md; this file stores the data and enforces who can touch it.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.sport as enum ('liga_mx', 'nfl', 'f1');
create type public.pool_status as enum ('upcoming', 'active', 'finished');
create type public.round_kind as enum ('matchday', 'week', 'gp', 'sprint');
create type public.round_status as enum ('scheduled', 'completed', 'cancelled');
create type public.match_outcome as enum ('home', 'draw', 'away');

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- A player exists before they ever log in, so admins can enroll them, import past
-- standings and enter picks on their behalf. Logging in with the same email links
-- the auth user to the player (see link_player_on_signup).
create table public.players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  nickname text,
  email text unique check (email = lower(email)),
  user_id uuid unique references auth.users (id) on delete set null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Pools and membership
-- ---------------------------------------------------------------------------

create table public.pools (
  id uuid primary key default gen_random_uuid(),
  sport public.sport not null,
  season text not null,
  name text not null,
  status public.pool_status not null default 'upcoming',
  entry_fee_cents integer not null default 10000 check (entry_fee_cents > 0),
  -- Jackpot carried in when the app starts mid-season.
  jackpot_opening_cents integer not null default 0 check (jackpot_opening_cents >= 0),
  created_at timestamptz not null default now(),
  unique (sport, season)
);

-- Sub-admins: each one manages their own pool.
create table public.pool_admins (
  pool_id uuid not null references public.pools (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  primary key (pool_id, player_id)
);

-- Season-long membership: enrolled players pay and are ranked every round.
create table public.enrollments (
  pool_id uuid not null references public.pools (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (pool_id, player_id)
);

-- ---------------------------------------------------------------------------
-- Settlement periods (monthly family meeting)
-- ---------------------------------------------------------------------------

create table public.settlement_periods (
  id uuid primary key default gen_random_uuid(),
  cutoff_at timestamptz not null unique,
  settled_at timestamptz,
  settled_by uuid references public.players (id)
);

-- ---------------------------------------------------------------------------
-- Rounds and events
-- ---------------------------------------------------------------------------

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools (id) on delete cascade,
  name text not null,
  kind public.round_kind not null,
  ordinal integer not null,
  status public.round_status not null default 'scheduled',
  settlement_period_id uuid references public.settlement_periods (id),
  -- Filled in when the round is scored (see src/domain/prizes.ts).
  pot_cents integer check (pot_cents >= 0),
  jackpot_cents integer check (jackpot_cents >= 0),
  created_at timestamptz not null default now(),
  unique (pool_id, kind, ordinal)
);

-- A match (Liga MX, NFL) or a race (F1). lock_at is always set per event so pick
-- permissions don't depend on the sport: the app computes it with src/domain/deadlines.ts.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  external_id text,
  name text,
  home_team text,
  away_team text,
  starts_at timestamptz not null,
  lock_at timestamptz not null,
  -- Matches only: 'draw' also records an NFL tie; 'void' = postponed / cancelled.
  result text check (result in ('home', 'draw', 'away', 'void')),
  created_at timestamptz not null default now(),
  check (lock_at <= starts_at)
);

create index events_round_id_idx on public.events (round_id);
create unique index events_external_id_idx on public.events (round_id, external_id)
  where external_id is not null;

create table public.f1_drivers (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  code text not null,
  name text not null,
  team text,
  unique (season, code)
);

-- Official F1 classification, positions 1–10 are the only ones scored.
create table public.f1_classification (
  event_id uuid not null references public.events (id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  driver_id uuid not null references public.f1_drivers (id),
  primary key (event_id, position),
  unique (event_id, driver_id)
);

-- ---------------------------------------------------------------------------
-- Picks
-- ---------------------------------------------------------------------------

create table public.match_picks (
  event_id uuid not null references public.events (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  selection public.match_outcome not null,
  entered_by uuid not null references public.players (id),
  updated_at timestamptz not null default now(),
  primary key (event_id, player_id)
);

create table public.f1_picks (
  event_id uuid not null references public.events (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  position smallint not null check (position between 1 and 10),
  driver_id uuid not null references public.f1_drivers (id),
  entered_by uuid not null references public.players (id),
  updated_at timestamptz not null default now(),
  primary key (event_id, player_id, position),
  unique (event_id, player_id, driver_id)
);

create index match_picks_player_idx on public.match_picks (player_id);
create index f1_picks_player_idx on public.f1_picks (player_id);

-- ---------------------------------------------------------------------------
-- Results (derived, recomputable from picks; stored so history and imports work)
-- ---------------------------------------------------------------------------

create table public.round_results (
  round_id uuid not null references public.rounds (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  points integer not null check (points >= 0),
  position integer not null check (position >= 1),
  prize_cents integer not null default 0 check (prize_cents >= 0),
  primary key (round_id, player_id)
);

create index round_results_player_idx on public.round_results (player_id);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.players (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies can call them without recursion)
-- ---------------------------------------------------------------------------

create function public.current_player_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.players where user_id = auth.uid()
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.players where user_id = auth.uid()), false)
$$;

create function public.is_any_pool_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.pool_admins where player_id = public.current_player_id()
  )
$$;

create function public.is_pool_admin(p_pool_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.pool_admins
    where pool_id = p_pool_id and player_id = public.current_player_id()
  )
$$;

create function public.pool_of_round(p_round_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select pool_id from public.rounds where id = p_round_id
$$;

create function public.pool_of_event(p_event_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select r.pool_id from public.events e join public.rounds r on r.id = e.round_id
  where e.id = p_event_id
$$;

create function public.event_is_locked(p_event_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select now() >= lock_at from public.events where id = p_event_id), true)
$$;

create function public.is_enrolled(p_pool_id uuid, p_player_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrollments where pool_id = p_pool_id and player_id = p_player_id
  )
$$;

-- Picks can be written by the player themselves before the lock, or by an admin of
-- that pool at any time (on-behalf picks and corrections, always audited).
create function public.can_write_pick(p_event_id uuid, p_player_id uuid, p_entered_by uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select p_entered_by = public.current_player_id()
    and public.is_enrolled(public.pool_of_event(p_event_id), p_player_id)
    and (
      (p_player_id = public.current_player_id() and not public.event_is_locked(p_event_id))
      or public.is_pool_admin(public.pool_of_event(p_event_id))
    )
$$;

create function public.can_read_pick(p_event_id uuid, p_player_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_player_id = public.current_player_id()
    or public.event_is_locked(p_event_id)
    or public.is_pool_admin(public.pool_of_event(p_event_id))
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Link a new auth user to the player invited with the same email.
create function public.link_player_on_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.players
  set user_id = new.id
  where email = lower(new.email) and user_id is null;
  return new;
end;
$$;

create trigger link_player_on_signup
after insert on auth.users
for each row execute function public.link_player_on_signup();

-- user_id is never set by hand: it always follows the player's email. Only the admin
-- can grant admin rights or change the email of a player who already logged in.
-- Server jobs using the secret key (auth.uid() is null) are trusted.
create function public.guard_player() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.email is distinct from old.email then
    new.user_id := (select id from auth.users where lower(email) = new.email limit 1);
  elsif new.user_id is distinct from old.user_id and auth.uid() is not null then
    raise exception 'Linked accounts follow the player email';
  end if;

  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' and new.is_admin then
      raise exception 'Only the admin can create admins';
    elsif tg_op = 'UPDATE' and new.is_admin is distinct from old.is_admin then
      raise exception 'Only the admin can change admin rights';
    elsif tg_op = 'UPDATE' and new.email is distinct from old.email and old.user_id is not null then
      raise exception 'Only the admin can change the email of a registered player';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_player
before insert or update on public.players
for each row execute function public.guard_player();

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger match_picks_touch before update on public.match_picks
for each row execute function public.touch_updated_at();
create trigger f1_picks_touch before update on public.f1_picks
for each row execute function public.touch_updated_at();

-- Generic audit trigger for admin-managed tables.
create function public.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  row_data jsonb;
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
  else
    row_data := to_jsonb(new);
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, payload)
  values (
    public.current_player_id(),
    lower(tg_op),
    tg_table_name,
    coalesce(row_data ->> 'id', row_data ->> 'event_id', row_data ->> 'round_id', row_data ->> 'pool_id'),
    case tg_op
      when 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
      else row_data
    end
  );
  return null;
end;
$$;

create trigger audit after insert or update or delete on public.players
for each row execute function public.audit();
create trigger audit after insert or update or delete on public.pools
for each row execute function public.audit();
create trigger audit after insert or update or delete on public.pool_admins
for each row execute function public.audit();
create trigger audit after insert or update or delete on public.enrollments
for each row execute function public.audit();
create trigger audit after insert or update or delete on public.rounds
for each row execute function public.audit();
create trigger audit after update or delete on public.events
for each row execute function public.audit();
create trigger audit after insert or update or delete on public.f1_classification
for each row execute function public.audit();
create trigger audit after insert or update or delete on public.settlement_periods
for each row execute function public.audit();

-- Picks are only audited when someone else entered or changed them.
create trigger audit_on_behalf after insert or update on public.match_picks
for each row when (new.entered_by <> new.player_id) execute function public.audit();
create trigger audit_on_behalf_delete after delete on public.match_picks
for each row when (old.entered_by <> old.player_id) execute function public.audit();
create trigger audit_on_behalf after insert or update on public.f1_picks
for each row when (new.entered_by <> new.player_id) execute function public.audit();
create trigger audit_on_behalf_delete after delete on public.f1_picks
for each row when (old.entered_by <> old.player_id) execute function public.audit();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Only registered players see anything. Anonymous visitors get nothing.
-- ---------------------------------------------------------------------------

alter table public.players enable row level security;
alter table public.pools enable row level security;
alter table public.pool_admins enable row level security;
alter table public.enrollments enable row level security;
alter table public.settlement_periods enable row level security;
alter table public.rounds enable row level security;
alter table public.events enable row level security;
alter table public.f1_drivers enable row level security;
alter table public.f1_classification enable row level security;
alter table public.match_picks enable row level security;
alter table public.f1_picks enable row level security;
alter table public.round_results enable row level security;
alter table public.audit_log enable row level security;

-- Read access for every registered player.
create policy "players can read" on public.players for select to authenticated
  using (public.current_player_id() is not null);
create policy "players can read" on public.pools for select to authenticated
  using (public.current_player_id() is not null);
create policy "players can read" on public.pool_admins for select to authenticated
  using (public.current_player_id() is not null);
create policy "players can read" on public.enrollments for select to authenticated
  using (public.current_player_id() is not null);
create policy "players can read" on public.settlement_periods for select to authenticated
  using (public.current_player_id() is not null);
create policy "players can read" on public.rounds for select to authenticated
  using (public.current_player_id() is not null);
create policy "players can read" on public.events for select to authenticated
  using (public.current_player_id() is not null);
create policy "players can read" on public.f1_drivers for select to authenticated
  using (public.current_player_id() is not null);
create policy "players can read" on public.f1_classification for select to authenticated
  using (public.current_player_id() is not null);
create policy "players can read" on public.round_results for select to authenticated
  using (public.current_player_id() is not null);

-- Others' picks stay hidden until the pick locks.
create policy "read own or locked picks" on public.match_picks for select to authenticated
  using (public.can_read_pick(event_id, player_id));
create policy "read own or locked picks" on public.f1_picks for select to authenticated
  using (public.can_read_pick(event_id, player_id));

create policy "insert allowed picks" on public.match_picks for insert to authenticated
  with check (public.can_write_pick(event_id, player_id, entered_by));
create policy "update allowed picks" on public.match_picks for update to authenticated
  using (public.can_write_pick(event_id, player_id, public.current_player_id()))
  with check (public.can_write_pick(event_id, player_id, entered_by));
create policy "delete allowed picks" on public.match_picks for delete to authenticated
  using (public.can_write_pick(event_id, player_id, public.current_player_id()));

create policy "insert allowed picks" on public.f1_picks for insert to authenticated
  with check (public.can_write_pick(event_id, player_id, entered_by));
create policy "update allowed picks" on public.f1_picks for update to authenticated
  using (public.can_write_pick(event_id, player_id, public.current_player_id()))
  with check (public.can_write_pick(event_id, player_id, entered_by));
create policy "delete allowed picks" on public.f1_picks for delete to authenticated
  using (public.can_write_pick(event_id, player_id, public.current_player_id()));

-- Admin only.
create policy "admin writes" on public.pools for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin writes" on public.pool_admins for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin writes" on public.settlement_periods for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes" on public.players for delete to authenticated
  using (public.is_admin());

-- Admin and sub-admins (privilege changes are blocked by protect_player_privileges).
create policy "pool admins add players" on public.players for insert to authenticated
  with check (public.is_any_pool_admin());
create policy "pool admins edit players" on public.players for update to authenticated
  using (public.is_any_pool_admin()) with check (public.is_any_pool_admin());
create policy "admins read audit log" on public.audit_log for select to authenticated
  using (public.is_any_pool_admin());

create policy "f1 admins write drivers" on public.f1_drivers for all to authenticated
  using (public.is_admin() or exists (
    select 1 from public.pool_admins pa join public.pools p on p.id = pa.pool_id
    where p.sport = 'f1' and pa.player_id = public.current_player_id()
  ))
  with check (public.is_admin() or exists (
    select 1 from public.pool_admins pa join public.pools p on p.id = pa.pool_id
    where p.sport = 'f1' and pa.player_id = public.current_player_id()
  ));

-- Sub-admins of the pool.
create policy "pool admins write" on public.enrollments for all to authenticated
  using (public.is_pool_admin(pool_id)) with check (public.is_pool_admin(pool_id));
create policy "pool admins write" on public.rounds for all to authenticated
  using (public.is_pool_admin(pool_id)) with check (public.is_pool_admin(pool_id));
create policy "pool admins write" on public.events for all to authenticated
  using (public.is_pool_admin(public.pool_of_round(round_id)))
  with check (public.is_pool_admin(public.pool_of_round(round_id)));
create policy "pool admins write" on public.f1_classification for all to authenticated
  using (public.is_pool_admin(public.pool_of_event(event_id)))
  with check (public.is_pool_admin(public.pool_of_event(event_id)));
create policy "pool admins write" on public.round_results for all to authenticated
  using (public.is_pool_admin(public.pool_of_round(round_id)))
  with check (public.is_pool_admin(public.pool_of_round(round_id)));

-- ---------------------------------------------------------------------------
-- Grants (new tables are not exposed automatically in this project)
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.audit_log from authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- Server-side jobs (results import, scoring) use the secret key.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
