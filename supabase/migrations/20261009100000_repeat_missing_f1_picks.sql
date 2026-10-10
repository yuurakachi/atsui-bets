-- F1 (docs/RULES.md §3): a player who made no picks before the lock repeats the lineup
-- of their previous round, so forgetting doesn't leave them with zero points.

-- Set on picks that were repeated, pointing at the round they came from.
alter table public.f1_picks
  add column copied_from_event_id uuid references public.events (id) on delete set null;

-- Fills in the picks of every enrolled player who has none for a locked F1 round still
-- waiting for its result, copying their most recent earlier round with picks. Rounds are
-- taken in order, so on a Sprint weekend the GP repeats what the Sprint got. Safe to
-- call any number of times; returns how many lineups it filled in.
create function public.fill_missing_f1_picks(p_event_id uuid default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_event record;
  v_player_id uuid;
  v_source uuid;
  v_filled integer := 0;
begin
  for v_event in
    select e.id, r.pool_id, r.ordinal
    from public.events e
    join public.rounds r on r.id = e.round_id
    join public.pools p on p.id = r.pool_id
    where p.sport = 'f1'
      and r.status = 'scheduled'
      and e.lock_at <= now()
      and (p_event_id is null or e.id = p_event_id)
    order by r.pool_id, r.ordinal
  loop
    for v_player_id in
      select en.player_id
      from public.enrollments en
      where en.pool_id = v_event.pool_id
        and not exists (
          select 1 from public.f1_picks fp where fp.event_id = v_event.id and fp.player_id = en.player_id
        )
    loop
      select e.id into v_source
      from public.events e
      join public.rounds r on r.id = e.round_id
      where r.pool_id = v_event.pool_id
        and r.status <> 'cancelled'
        and r.ordinal < v_event.ordinal
        and exists (
          select 1 from public.f1_picks fp where fp.event_id = e.id and fp.player_id = v_player_id
        )
      order by r.ordinal desc
      limit 1;
      continue when v_source is null;

      insert into public.f1_picks (event_id, player_id, position, driver_id, entered_by, copied_from_event_id)
      select v_event.id, fp.player_id, fp.position, fp.driver_id, fp.player_id, v_source
      from public.f1_picks fp
      where fp.event_id = v_source and fp.player_id = v_player_id
      on conflict do nothing;

      insert into public.audit_log (actor_id, action, entity, entity_id, payload)
      values (
        null, 'repeat', 'f1_picks', v_event.id::text,
        jsonb_build_object('player_id', v_player_id, 'copied_from_event_id', v_source)
      );
      v_filled := v_filled + 1;
    end loop;
  end loop;
  return v_filled;
end;
$$;

revoke execute on function public.fill_missing_f1_picks(uuid) from public, anon;
grant execute on function public.fill_missing_f1_picks(uuid) to authenticated, service_role;

-- A pick saved by hand (an admin entering it after the lock) is no longer a repeated one.
create or replace function public.save_f1_picks(p_event_id uuid, p_player_id uuid, p_driver_ids uuid[])
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

  update public.f1_picks p
  set copied_from_event_id = null, entered_by = public.current_player_id()
  where p.event_id = p_event_id and p.player_id = p_player_id and p.copied_from_event_id is not null;

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

-- Repeat the lineups shortly after each lock, so everyone sees them with the other picks.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('repeat-missing-f1-picks', '*/5 * * * *', $$select public.fill_missing_f1_picks()$$);
