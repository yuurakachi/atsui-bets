-- Permission checks against a real database. Everything runs in one DO block that
-- always ends by raising the report, so all test data is rolled back.
--   npx supabase db query --linked -f supabase/tests/rls_check.sql

do $$
declare
  u_admin uuid := gen_random_uuid();
  u_sub uuid := gen_random_uuid();
  u_p uuid := gen_random_uuid();
  u_q uuid := gen_random_uuid();
  u_out uuid := gen_random_uuid();
  u_grandma uuid := gen_random_uuid();
  admin_id uuid; sub_id uuid; p_id uuid; q_id uuid; grandma_id uuid;
  liga uuid; f1 uuid; r1 uuid; r_f1 uuid; e_open uuid; e_locked uuid;
  f1_open uuid; f1_locked uuid; d1 uuid; d2 uuid; d3 uuid; d_other uuid;
  n int;
  ok boolean;
  report text := '';
  failures int := 0;
begin
  -- Setup as the database owner --------------------------------------------------
  insert into auth.users (id, email, aud, role) values
    (u_admin, 'admin@test.local', 'authenticated', 'authenticated'),
    (u_sub, 'sub@test.local', 'authenticated', 'authenticated'),
    (u_p, 'p@test.local', 'authenticated', 'authenticated'),
    (u_q, 'q@test.local', 'authenticated', 'authenticated'),
    (u_out, 'outsider@test.local', 'authenticated', 'authenticated');

  insert into public.players (display_name, email, is_admin) values ('Admin', 'admin@test.local', true) returning id into admin_id;
  insert into public.players (display_name, email) values ('Sub', 'sub@test.local') returning id into sub_id;
  insert into public.players (display_name, email) values ('P', 'p@test.local') returning id into p_id;
  insert into public.players (display_name, email) values ('Q', 'q@test.local') returning id into q_id;
  insert into public.players (display_name, email) values ('Grandma', 'grandma@test.local') returning id into grandma_id;

  insert into public.pools (sport, season, name) values ('liga_mx', 'TEST', 'Liga TEST') returning id into liga;
  insert into public.pools (sport, season, name) values ('f1', 'TEST', 'F1 TEST') returning id into f1;
  insert into public.pool_admins values (liga, sub_id);
  insert into public.enrollments (pool_id, player_id) values (liga, p_id), (liga, q_id), (liga, grandma_id), (liga, sub_id), (f1, p_id);

  insert into public.rounds (pool_id, name, kind, ordinal) values (liga, 'J1', 'matchday', 1) returning id into r1;
  insert into public.rounds (pool_id, name, kind, ordinal) values (f1, 'GP1', 'gp', 1) returning id into r_f1;
  insert into public.events (round_id, home_team, away_team, starts_at, lock_at)
    values (r1, 'A', 'B', now() + interval '2 days', now() + interval '1 day') returning id into e_open;
  insert into public.events (round_id, home_team, away_team, starts_at, lock_at)
    values (r1, 'C', 'D', now() - interval '1 hour', now() - interval '2 hours') returning id into e_locked;

  insert into public.match_picks (event_id, player_id, selection, entered_by) values
    (e_open, q_id, 'home', q_id), (e_locked, q_id, 'away', q_id);

  insert into public.events (round_id, name, starts_at, lock_at)
    values (r_f1, 'GP', now() + interval '2 days', now() + interval '1 day') returning id into f1_open;
  insert into public.events (round_id, name, starts_at, lock_at)
    values (r_f1, 'GP', now() - interval '1 hour', now() - interval '2 hours') returning id into f1_locked;
  insert into public.f1_drivers (season, code, name) values ('TEST', 'AAA', 'A') returning id into d1;
  insert into public.f1_drivers (season, code, name) values ('TEST', 'BBB', 'B') returning id into d2;
  insert into public.f1_drivers (season, code, name) values ('TEST', 'CCC', 'C') returning id into d3;
  insert into public.f1_drivers (season, code, name) values ('OTHER', 'AAA', 'A') returning id into d_other;

  -- Account linking -------------------------------------------------------------
  ok := (select user_id = u_p from public.players where id = p_id);
  report := report || format(E'\n%s existing auth user linked on player insert', case when ok then 'PASS' else 'FAIL' end);
  if not ok then failures := failures + 1; end if;

  insert into auth.users (id, email, aud, role) values (u_grandma, 'Grandma@test.local', 'authenticated', 'authenticated');
  ok := (select user_id = u_grandma from public.players where id = grandma_id);
  report := report || format(E'\n%s player linked on signup (case-insensitive email)', case when ok then 'PASS' else 'FAIL' end);
  if not ok then failures := failures + 1; end if;

  -- Player P ----------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_p, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    insert into public.match_picks (event_id, player_id, selection, entered_by) values (e_open, p_id, 'draw', p_id);
    report := report || E'\nPASS player picks an open match';
  exception when others then
    report := report || E'\nFAIL player picks an open match: ' || sqlerrm; failures := failures + 1;
  end;

  begin
    insert into public.match_picks (event_id, player_id, selection, entered_by) values (e_locked, p_id, 'draw', p_id);
    report := report || E'\nFAIL player picked a locked match'; failures := failures + 1;
  exception when others then
    report := report || E'\nPASS player cannot pick a locked match';
  end;

  begin
    insert into public.match_picks (event_id, player_id, selection, entered_by) values (e_open, grandma_id, 'home', p_id);
    report := report || E'\nFAIL player picked for someone else'; failures := failures + 1;
  exception when others then
    report := report || E'\nPASS player cannot pick for someone else';
  end;

  select count(*) into n from public.match_picks where player_id = q_id and event_id = e_open;
  report := report || format(E'\n%s others'' picks hidden before lock (saw %s)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  if n <> 0 then failures := failures + 1; end if;

  select count(*) into n from public.match_picks where player_id = q_id and event_id = e_locked;
  report := report || format(E'\n%s others'' picks visible after lock (saw %s)', case when n = 1 then 'PASS' else 'FAIL' end, n);
  if n <> 1 then failures := failures + 1; end if;

  update public.players set is_admin = true where id = p_id;
  get diagnostics n = row_count;
  report := report || format(E'\n%s player cannot make themselves admin (%s rows)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  if n <> 0 then failures := failures + 1; end if;

  select count(*) into n from public.audit_log;
  report := report || format(E'\n%s player cannot read the audit log (saw %s)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  if n <> 0 then failures := failures + 1; end if;

  -- F1 picks: the whole P1–P10 list is saved at once.
  begin
    perform public.save_f1_picks(f1_open, p_id, array[d1, d2, d3]);
    perform public.save_f1_picks(f1_open, p_id, array[d2, d1, null, d3]);
    ok := (select array_agg(driver_id order by position) = array[d2, d1, d3]
                  and array_agg(position order by position) = array[1, 2, 4]::smallint[]
           from public.f1_picks where event_id = f1_open and player_id = p_id);
    report := report || format(E'\n%s player saves and reorders an F1 pick', case when ok then 'PASS' else 'FAIL' end);
    if not ok then failures := failures + 1; end if;
  exception when others then
    report := report || E'\nFAIL player saves and reorders an F1 pick: ' || sqlerrm; failures := failures + 1;
  end;

  begin
    perform public.save_f1_picks(f1_open, p_id, array[d1, d1]);
    report := report || E'\nFAIL player picked a driver twice'; failures := failures + 1;
  exception when others then
    report := report || E'\nPASS a driver can only be picked once';
  end;

  begin
    perform public.save_f1_picks(f1_open, p_id, array[d_other]);
    report := report || E'\nFAIL player picked a driver from another season'; failures := failures + 1;
  exception when others then
    report := report || E'\nPASS drivers must belong to the pool''s season';
  end;

  begin
    perform public.save_f1_picks(f1_locked, p_id, array[d1]);
    report := report || E'\nFAIL player picked a locked F1 round'; failures := failures + 1;
  exception when others then
    report := report || E'\nPASS player cannot pick a locked F1 round';
  end;

  begin
    perform public.save_f1_picks(f1_open, q_id, array[d1]);
    report := report || E'\nFAIL player made an F1 pick for someone else'; failures := failures + 1;
  exception when others then
    report := report || E'\nPASS player cannot make an F1 pick for someone else';
  end;

  begin
    perform public.save_f1_classification(f1_locked, array[d1, d2, d3]);
    report := report || E'\nFAIL player recorded an F1 classification'; failures := failures + 1;
  exception when others then
    report := report || E'\nPASS player cannot record an F1 classification';
  end;

  reset role;

  -- Sub-admin of Liga MX -------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_sub, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    insert into public.match_picks (event_id, player_id, selection, entered_by) values (e_locked, grandma_id, 'home', sub_id);
    report := report || E'\nPASS sub-admin enters a pick on someone''s behalf';
  exception when others then
    report := report || E'\nFAIL sub-admin enters a pick on someone''s behalf: ' || sqlerrm; failures := failures + 1;
  end;

  update public.events set result = 'home' where id = e_locked;
  get diagnostics n = row_count;
  report := report || format(E'\n%s sub-admin records a result in their pool', case when n = 1 then 'PASS' else 'FAIL' end);
  if n <> 1 then failures := failures + 1; end if;

  begin
    insert into public.rounds (pool_id, name, kind, ordinal) values (f1, 'GP2', 'gp', 2);
    report := report || E'\nFAIL sub-admin wrote to another pool'; failures := failures + 1;
  exception when others then
    report := report || E'\nPASS sub-admin cannot write to another pool';
  end;

  begin
    update public.players set is_admin = true where id = sub_id;
    report := report || E'\nFAIL sub-admin made themselves admin'; failures := failures + 1;
  exception when others then
    report := report || E'\nPASS sub-admin cannot make themselves admin';
  end;

  begin
    insert into public.pool_admins values (f1, sub_id);
    report := report || E'\nFAIL sub-admin granted themselves another pool'; failures := failures + 1;
  exception when others then
    report := report || E'\nPASS sub-admin cannot grant pool admin';
  end;

  begin
    insert into public.settlement_periods (pool_id, cutoff_at, settled_at, settled_by)
    values (liga, '2099-01-03 00:00-06', now(), sub_id);
    report := report || E'\nPASS sub-admin closes their pool''s settlement';
  exception when others then
    report := report || E'\nFAIL sub-admin closes their pool''s settlement: ' || sqlerrm; failures := failures + 1;
  end;

  begin
    insert into public.settlement_periods (pool_id, cutoff_at) values (f1, '2099-01-03 00:00-06');
    report := report || E'\nFAIL sub-admin touched another pool''s settlement'; failures := failures + 1;
  exception when others then
    report := report || E'\nPASS sub-admin cannot touch another pool''s settlement';
  end;

  begin
    perform public.save_f1_classification(f1_locked, array[d1, d2, d3]);
    report := report || E'\nFAIL sub-admin recorded another pool''s F1 classification'; failures := failures + 1;
  exception when others then
    report := report || E'\nPASS sub-admin cannot record another pool''s F1 classification';
  end;

  select count(*) into n from public.audit_log where entity = 'match_picks' and actor_id = sub_id;
  report := report || format(E'\n%s on-behalf pick is audited', case when n = 1 then 'PASS' else 'FAIL' end);
  if n <> 1 then failures := failures + 1; end if;

  reset role;

  -- Admin (not enrolled in Liga MX) ---------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    insert into public.match_picks (event_id, player_id, selection, entered_by) values (e_open, admin_id, 'home', admin_id);
    report := report || E'\nFAIL non-enrolled player picked'; failures := failures + 1;
  exception when others then
    report := report || E'\nPASS picks require enrollment, even for the admin';
  end;

  begin
    perform public.save_f1_classification(f1_locked, array[d3, d1, d2]);
    perform public.save_f1_classification(f1_locked, array[d3, d2, d1]);
    ok := (select array_agg(driver_id order by position) = array[d3, d2, d1]
           from public.f1_classification where event_id = f1_locked);
    report := report || format(E'\n%s admin records and corrects an F1 classification', case when ok then 'PASS' else 'FAIL' end);
    if not ok then failures := failures + 1; end if;
  exception when others then
    report := report || E'\nFAIL admin records and corrects an F1 classification: ' || sqlerrm; failures := failures + 1;
  end;

  begin
    perform public.save_f1_picks(f1_locked, p_id, array[d3, d2]);
    select count(*) into n from public.audit_log where entity = 'f1_picks' and actor_id = admin_id;
    report := report || format(E'\n%s admin enters a locked F1 pick on someone''s behalf, audited (%s rows)', case when n = 2 then 'PASS' else 'FAIL' end, n);
    if n <> 2 then failures := failures + 1; end if;
  exception when others then
    report := report || E'\nFAIL admin enters a locked F1 pick on someone''s behalf: ' || sqlerrm; failures := failures + 1;
  end;

  update public.pool_admins set pool_id = pool_id where player_id = sub_id;
  get diagnostics n = row_count;
  report := report || format(E'\n%s admin manages sub-admins', case when n = 1 then 'PASS' else 'FAIL' end);
  if n <> 1 then failures := failures + 1; end if;

  reset role;

  -- Signed-in user who is not a registered player ---------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_out, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.players;
  report := report || format(E'\n%s unregistered user sees no players (saw %s)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  if n <> 0 then failures := failures + 1; end if;

  select count(*) into n from public.match_picks;
  report := report || format(E'\n%s unregistered user sees no picks (saw %s)', case when n = 0 then 'PASS' else 'FAIL' end, n);
  if n <> 0 then failures := failures + 1; end if;

  reset role;

  raise exception E'RLS CHECK: % failure(s)%', failures, report;
end;
$$;
