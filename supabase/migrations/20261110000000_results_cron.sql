-- Calls the results job (src/app/api/cron/results) every 30 minutes. It used to be a
-- GitHub Actions schedule, which is best effort and didn't run; pg_cron runs on time.
-- The job's secret is kept in Vault as 'cron_secret', stored once by hand (never in a
-- migration). pg_net sends the request in the background and keeps the response in
-- net._http_response for a few hours.
create extension if not exists pg_net with schema extensions;

select cron.schedule('update-results', '*/30 * * * *', $$
  select net.http_get(
    url := 'https://atsui-bets.vercel.app/api/cron/results',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 60000
  )
$$);
