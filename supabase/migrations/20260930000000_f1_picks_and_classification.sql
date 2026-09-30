-- F1 pool (docs/RULES.md §2): P1–P10 picks and the official classification are saved
-- as a whole ordered list, so a driver can move from one position to another without
-- tripping the one-driver-per-round constraint halfway through.

-- Drivers who aren't racing any more (replaced mid-season, one-off stand-ins) stay in
-- the season for past picks and results, but are no longer offered in the picker.
alter table public.f1_drivers add column active boolean not null default true;

-- Shared checks for an ordered list of drivers of an F1 event.
create function public.check_f1_order(p_event_id uuid, p_driver_ids uuid[], p_positions int)
returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_season text := (
    select p.season from public.pools p
    where p.id = public.pool_of_event(p_event_id) and p.sport = 'f1'
  );
begin
  if v_season is null then
    raise exception 'Not an F1 event';
  end if;
  if coalesce(array_length(p_driver_ids, 1), 0) > p_positions then
    raise exception 'At most % positions', p_positions;
  end if;
  if exists (
    select 1 from unnest(p_driver_ids) d where d is not null group by d having count(*) > 1
  ) then
    raise exception 'A driver can only appear once';
  end if;
  if exists (
    select 1 from unnest(p_driver_ids) d
    where d is not null
      and not exists (select 1 from public.f1_drivers f where f.id = d and f.season = v_season)
  ) then
    raise exception 'Driver from another season';
  end if;
end;
$$;

-- Replaces a player's P1–P10 pick (index 1 = P1, null = empty). Runs as the caller, so
-- row level security applies; only the positions that changed are rewritten, which
-- keeps the audit log of on-behalf picks readable.
create function public.save_f1_picks(p_event_id uuid, p_player_id uuid, p_driver_ids uuid[])
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.can_write_pick(p_event_id, p_player_id, public.current_player_id()) then
    raise exception 'Not allowed to pick for this player or the pick is locked';
  end if;
  perform public.check_f1_order(p_event_id, p_driver_ids, 10);

  delete from public.f1_picks p
  where p.event_id = p_event_id and p.player_id = p_player_id
    and p.driver_id is distinct from p_driver_ids[p.position];

  insert into public.f1_picks (event_id, player_id, position, driver_id, entered_by)
  select p_event_id, p_player_id, t.position, t.driver_id, public.current_player_id()
  from unnest(p_driver_ids) with ordinality as t (driver_id, position)
  where t.driver_id is not null
    and not exists (
      select 1 from public.f1_picks p
      where p.event_id = p_event_id and p.player_id = p_player_id and p.position = t.position
    );
end;
$$;

-- Replaces an event's official classification (index 1 = P1). Pool admins only.
create function public.save_f1_classification(p_event_id uuid, p_driver_ids uuid[])
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_pool_admin(public.pool_of_event(p_event_id)) then
    raise exception 'Only the pool admins can record results';
  end if;
  perform public.check_f1_order(p_event_id, p_driver_ids, 20);

  delete from public.f1_classification c
  where c.event_id = p_event_id and c.driver_id is distinct from p_driver_ids[c.position];

  insert into public.f1_classification (event_id, position, driver_id)
  select p_event_id, t.position, t.driver_id
  from unnest(p_driver_ids) with ordinality as t (driver_id, position)
  where t.driver_id is not null
    and not exists (
      select 1 from public.f1_classification c where c.event_id = p_event_id and c.position = t.position
    );
end;
$$;

revoke execute on function public.check_f1_order(uuid, uuid[], int) from public, anon;
revoke execute on function public.save_f1_picks(uuid, uuid, uuid[]) from public, anon;
revoke execute on function public.save_f1_classification(uuid, uuid[]) from public, anon;
grant execute on function public.check_f1_order(uuid, uuid[], int) to authenticated, service_role;
grant execute on function public.save_f1_picks(uuid, uuid, uuid[]) to authenticated, service_role;
grant execute on function public.save_f1_classification(uuid, uuid[]) to authenticated, service_role;
