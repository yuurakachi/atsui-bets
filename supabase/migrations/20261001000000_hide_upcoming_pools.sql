-- A pool stays 'upcoming' while the admin sets it up (import, enrollments, a trial round):
-- only the admin sees it. Everyone else sees it once it's 'active'.
drop policy "players can read" on public.pools;
create policy "players can read" on public.pools for select to authenticated
  using (public.current_player_id() is not null and (status <> 'upcoming' or public.is_admin()));
