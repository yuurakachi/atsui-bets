-- Season-end notifications: once a pool is marked finished, everyone enrolled hears who
-- takes the jackpot (1st, Lucky 7, Bobby). The notify job claims 'season:<pool id>' in
-- push_sent before sending, like the other notices.

-- Seasons that ended before this existed were already announced by hand.
insert into public.push_sent (key)
select 'season:' || id from public.pools where status = 'finished'
on conflict do nothing;
