-- Locked picks were readable by any signed-in user, including people who are not a
-- registered player. Only players may read them.
create or replace function public.can_read_pick(p_event_id uuid, p_player_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.current_player_id() is not null and (
    p_player_id = public.current_player_id()
    or public.event_is_locked(p_event_id)
    or public.is_pool_admin(public.pool_of_event(p_event_id))
  )
$$;
