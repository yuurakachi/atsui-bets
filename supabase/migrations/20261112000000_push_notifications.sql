-- Phone notifications (web push): picks are open, picks lock in 10 minutes, round winner.

-- One row per phone (browser) that turned notifications on. A phone belongs to whoever
-- turned them on last there.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_player_idx on public.push_subscriptions (player_id);

alter table public.push_subscriptions enable row level security;

create policy "read own" on public.push_subscriptions for select to authenticated
  using (player_id = public.current_player_id());
create policy "delete own" on public.push_subscriptions for delete to authenticated
  using (player_id = public.current_player_id());

grant select, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

-- Saves this phone for the signed-in player. If the phone was another player's (they
-- share it), it moves to this one: an insert under row level security couldn't see it.
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.current_player_id();
begin
  if me is null then
    raise exception 'not a registered player';
  end if;
  insert into public.push_subscriptions (player_id, endpoint, p256dh, auth)
  values (me, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set player_id = excluded.player_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- Notices already sent, so none goes out twice even if the job runs twice at once: the
-- job inserts the key first and only sends if the insert went through.
-- Keys: 'opened:<round id>', 'winner:<round id>', 'closing:<lock time in epoch ms>'.
create table public.push_sent (
  key text primary key,
  created_at timestamptz not null default now()
);

alter table public.push_sent enable row level security;
grant all on public.push_sent to service_role;

-- Rounds scored before notifications existed were announced on WhatsApp already.
insert into public.push_sent (key)
select 'winner:' || id from public.rounds where status = 'completed';

-- Every minute, a cheap check in the database: only when picks lock within 10 minutes
-- or a round was scored, and that hasn't been handled yet, does it call the app.
-- "Picks are open" is checked by the results job every 30 minutes.
select cron.schedule('push-notifications', '* * * * *', $$
  select net.http_get(
    url := 'https://atsui-bets.vercel.app/api/cron/notify',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 30000
  )
  where exists (
    select 1
    from public.events e
    join public.rounds r on r.id = e.round_id
    where r.status = 'scheduled'
      and e.result is distinct from 'void'
      and e.lock_at > now()
      and e.lock_at <= now() + interval '10 minutes'
      and not exists (
        select 1 from public.push_sent s
        -- Same as JavaScript's Date.getTime(): milliseconds, truncated.
        where s.key = 'closing:' || floor(extract(epoch from e.lock_at) * 1000)::bigint
      )
  ) or exists (
    select 1
    from public.rounds r
    where r.status = 'completed'
      and not exists (select 1 from public.push_sent s where s.key = 'winner:' || r.id)
  )
$$);
