-- Privacy & peer-model tests for the CertiTrack schema.
-- Run with: npm run test:db   (see scripts/test-db.sh)
--
-- Network used:   A <-> B <-> C      D (not connected)      ADMIN (platform admin)
-- Core promise:   A sees only what B chose to show A. A never sees C, nor that B and C are connected.
\set ON_ERROR_STOP 1
set client_min_messages = notice;

-- ---------------------------------------------------------------------------
-- Test helpers
-- ---------------------------------------------------------------------------
create function public.t_ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Asserts that a statement fails (permission denied, policy or business rule).
create function public.t_fails(stmt text, msg text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok - % (%)', msg, sqlerrm;
    return;
  end;
  raise exception 'FAIL: expected failure: %', msg;
end $$;

create function public.t_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
end $$;
grant execute on function public.t_ok(boolean, text), public.t_fails(text, text), public.t_as(uuid) to authenticated;

-- Fixed ids for readability.
\set ua   '''aaaaaaaa-0000-4000-8000-000000000001'''
\set ub   '''bbbbbbbb-0000-4000-8000-000000000001'''
\set uc   '''cccccccc-0000-4000-8000-000000000001'''
\set ud   '''dddddddd-0000-4000-8000-000000000001'''
\set uadm '''eeeeeeee-0000-4000-8000-000000000001'''

-- ---------------------------------------------------------------------------
-- Sign-up: organizations are created by the auth trigger.
-- ---------------------------------------------------------------------------
insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data) values
  (:ua, 'a@a.gr', now(), '{"type":"organization","name":"Alpha AE","afm":"111111111"}'),
  (:ub, 'b@b.gr', now(), '{"type":"organization","name":"Beta AE","afm":"222222222"}'),
  (:uc, 'c@c.gr', now(), '{"type":"organization","name":"Gamma AE","afm":"333333333"}'),
  (:ud, 'd@d.gr', null,  '{"type":"organization","name":"Delta AE","afm":"444444444"}'),
  (:uadm, 'owner@platform.test', now(), '{}');
update auth.users set email_confirmed_at = now() where id = :ud;   -- verification activates D
insert into public.platform_admins(user_id) values (:uadm);

select t_ok((select count(*) from organizations where status = 'active') = 4, 'sign-up creates active organizations after verification');
select t_ok(not exists(select 1 from organization_members where user_id = :uadm), 'platform admin account has no organization');

create temp table ids as
select (select id from organizations where vat_number = '111111111') a,
       (select id from organizations where vat_number = '222222222') b,
       (select id from organizations where vat_number = '333333333') c,
       (select id from organizations where vat_number = '444444444') d,
       (select id from certificate_types where code = 'ISO9001') iso9001,
       (select id from certificate_types where code = 'ISO14001') iso14001,
       (select id from certificate_types where code = 'CE') ce;
grant select on ids to authenticated;

-- ---------------------------------------------------------------------------
-- Connections: A -> B (accepted), C -> B (accepted)
-- ---------------------------------------------------------------------------
set role authenticated;

select t_as(:ua);
select t_ok((select name from ct_find_partner_candidate('222222222')) = 'Beta AE', 'lookup by VAT returns public card');
select t_ok((ct_request_connection((select a from ids), 'b@b.gr')->>'kind') = 'connection', 'A requests connection to B');
select t_fails($$select ct_request_connection((select a from ids), '222222222')$$, 'duplicate request is rejected');

select t_as(:ub);
select t_ok((select count(*) from ct_list_connections((select b from ids)) where status = 'pending' and direction = 'incoming') = 1,
            'B sees the pending request');
select t_ok(exists(select 1 from organizations where id = (select a from ids)), 'B can see who is asking (pending)');
select t_as(:ua);
select t_fails($$select ct_respond_connection((select id from connections limit 1), true)$$, 'requester cannot accept its own request');
select t_as(:ub);
select ct_respond_connection((select id from connections where requester_org_id = (select a from ids)), true);

select t_as(:uc);
select ct_request_connection((select c from ids), '222222222');
select t_as(:ub);
select ct_respond_connection((select id from connections where requester_org_id = (select c from ids)), true);

-- ---------------------------------------------------------------------------
-- B's certificates with different sharing choices
-- ---------------------------------------------------------------------------
select t_as(:ub);
insert into certificates(organization_id, certificate_type_id, title, expiry_date, sharing) values
  ((select b from ids), (select ce from ids),       'B all',      current_date + 400, 'all_connections'),
  ((select b from ids), (select iso9001 from ids),  'B private',  current_date + 400, 'private'),
  ((select b from ids), (select ce from ids),       'B only A',   current_date + 400, 'all_connections'),
  ((select b from ids), (select ce from ids),       'B only C',   current_date + 400, 'all_connections'),
  ((select b from ids), (select ce from ids),       'B A expiring share', current_date + 400, 'all_connections');
select ct_set_certificate_sharing((select id from certificates where title = 'B only A'), 'selected',
  jsonb_build_array(jsonb_build_object('org_id', (select a from ids))));
select ct_set_certificate_sharing((select id from certificates where title = 'B only C'), 'selected',
  jsonb_build_array(jsonb_build_object('org_id', (select c from ids))));
select ct_set_certificate_sharing((select id from certificates where title = 'B A expiring share'), 'selected',
  jsonb_build_array(jsonb_build_object('org_id', (select a from ids), 'expires_at', now() + interval '1 day')));
select t_fails($$select ct_set_certificate_sharing((select id from certificates where title = 'B all'), 'selected',
  jsonb_build_array(jsonb_build_object('org_id', (select d from ids))))$$, 'cannot share with an organization you are not connected to');
select t_fails($$update certificates set sharing = 'all_connections' where title = 'B private'$$,
  'sharing can only change through ct_set_certificate_sharing');

select t_as(:uc);
insert into certificates(organization_id, certificate_type_id, title, expiry_date)
values ((select c from ids), (select ce from ids), 'C all', current_date + 400);

-- ---------------------------------------------------------------------------
-- What A can see
-- ---------------------------------------------------------------------------
select t_as(:ua);
select t_ok((select array_agg(title order by title) from certificates where organization_id = (select b from ids))
            = array['B A expiring share','B all','B only A'], 'A sees exactly what B shared with A');
select t_ok(not exists(select 1 from certificates where organization_id = (select c from ids)), 'A sees no certificate of C (not transitive)');
select t_ok(not exists(select 1 from organizations where id = (select c from ids)), 'A cannot see organization C');
select t_ok((select count(*) from connections) = 1, 'A sees only its own connection, not B<->C');
select t_ok((select count(*) from ct_list_connections((select a from ids))) = 1, 'A connection list has only B');
select t_fails($$select ct_list_connections((select b from ids))$$, 'A cannot list B''s connections');
select t_ok(not exists(select 1 from organization_members where organization_id = (select b from ids)), 'A cannot see B''s staff');
select t_ok((select count(*) from certificate_shares) = 2, 'A sees only shares granted to A');
select t_ok(not exists(select 1 from certificate_shares where grantee_org_id = (select c from ids)), 'A cannot see that B shares with C');
select t_ok(not exists(select 1 from audit_log where organization_id <> (select a from ids)), 'A sees only its own audit log');
select t_ok(not exists(select 1 from certificate_views), 'A cannot see view logs of others');

-- A cannot change B's data
update certificates set title = 'hacked' where organization_id = (select b from ids);
select t_ok(not exists(select 1 from certificates where title = 'hacked'), 'A cannot edit B''s certificates');
select t_fails($$select ct_soft_delete_certificate((select id from certificates where title = 'B all'))$$, 'A cannot delete B''s certificate');
select t_fails($$insert into certificates(organization_id, certificate_type_id, title) values ((select b from ids), (select ce from ids), 'x')$$,
  'A cannot create certificates for B');
update organizations set legal_name = 'hacked' where id = (select b from ids);
select t_ok(not exists(select 1 from organizations where legal_name = 'hacked'), 'A cannot edit B''s organization');
select t_fails($$update organizations set status = 'active' where id = (select a from ids)$$, 'status is not client-writable');

-- Internal / service functions are not callable by clients
select t_fails($$select ct_notify_org((select b from ids), 'system', 'info', 'spam', 'spam', null, null, 'x', 'system')$$,
  'clients cannot send notifications directly');
select t_fails($$select ct_generate_expiry_notifications()$$, 'clients cannot run scheduled jobs');
select t_fails($$select ct_admin_network()$$, 'non-admin cannot read the whole network');
select t_ok(not exists(select 1 from pg_proc where pronamespace = 'public'::regnamespace
              and proname in ('ct_have_live_connection','ct_org_can_view_certificate','ct_is_org_member','ct_has_org_role',
                              'ct_current_org_ids','ct_can_view_certificate','ct_recently_opened')),
            'RLS helpers are not part of the public API (cannot probe who is connected to whom)');
select t_fails($$select * from email_outbox$$, 'clients cannot read the email outbox');

-- ---------------------------------------------------------------------------
-- Storage + view log
-- ---------------------------------------------------------------------------
reset role;
insert into storage.objects(bucket_id, name)
select 'organizationcertificates', (select b from ids)::text || '/' || id::text || '/v1.pdf' from certificates where title = 'B only A';
set role authenticated;
select t_as(:ub);
select ct_register_certificate_file((select id from certificates where title = 'B only A'),
  (select b from ids)::text || '/' || (select id from certificates where title = 'B only A')::text || '/v1.pdf',
  'iso.pdf', 'application/pdf', 1000);
select t_ok((select count(*) from storage.objects) = 1, 'owner can read its own PDF');

select t_as(:ua);
select t_ok((select count(*) from storage.objects) = 0, 'partner cannot fetch a PDF without opening it through the app');
select t_ok((select file_name from ct_open_certificate((select id from certificates where title = 'B only A'))) = 'iso.pdf',
            'partner opens a shared certificate');
select t_ok((select count(*) from storage.objects) = 1, 'after opening, partner can fetch the PDF');

select t_as(:uc);
select t_fails($$select ct_open_certificate((select id from certificates where title = 'B only A'))$$, 'C cannot open a certificate shared only with A');
select t_ok((select count(*) from storage.objects) = 0, 'C cannot fetch A''s shared PDF');
select t_ok((select array_agg(title order by title) from certificates where organization_id = (select b from ids))
            = array['B all','B only C'], 'C sees exactly what B shared with C');
select t_ok(not exists(select 1 from certificates where organization_id = (select a from ids)), 'C sees nothing of A');

select t_as(:ub);
select t_ok((select viewer_org_name from certificate_views) = 'Alpha AE', 'B sees that Alpha AE opened the certificate');

-- ---------------------------------------------------------------------------
-- Share expiry
-- ---------------------------------------------------------------------------
reset role;
update certificate_shares set expires_at = now() - interval '1 minute'
 where certificate_id = (select id from certificates where title = 'B A expiring share');
set role authenticated;
select t_as(:ua);
select t_ok(not exists(select 1 from certificates where title = 'B A expiring share'), 'expired share stops access automatically');

-- ---------------------------------------------------------------------------
-- Document requests (symmetric: either side can ask)
-- ---------------------------------------------------------------------------
select t_as(:ua);
select ct_request_document((select id from connections where requester_org_id = (select a from ids)), (select iso9001 from ids), 'Για τον διαγωνισμό');
select t_ok((select status from document_requests) = 'open', 'A asks B for ISO 9001');

select t_as(:ub);
select t_ok((select count(*) from notifications where type = 'document_request') = 1, 'B is notified of the request');
select t_fails($$select ct_cancel_document_request((select id from document_requests))$$, 'B cannot cancel A''s request');
select ct_request_document((select id from connections where requester_org_id = (select a from ids)), (select iso14001 from ids));
select t_ok((select count(*) from document_requests where requester_org_id = (select b from ids)) = 1, 'B can also ask A (peers)');

-- B answers with its private ISO 9001 (needs a file first)
reset role;
insert into storage.objects(bucket_id, name)
select 'organizationcertificates', (select b from ids)::text || '/' || id::text || '/v1.pdf' from certificates where title = 'B private';
set role authenticated;
select ct_register_certificate_file((select id from certificates where title = 'B private'),
  (select b from ids)::text || '/' || (select id from certificates where title = 'B private')::text || '/v1.pdf',
  'iso9001.pdf', 'application/pdf', 1000);
select ct_fulfill_document_request((select id from document_requests where requester_org_id = (select a from ids)),
                                   (select id from certificates where title = 'B private'));

select t_as(:ua);
select t_ok((select status from document_requests where requester_org_id = (select a from ids)) = 'fulfilled', 'request is fulfilled');
select t_ok(exists(select 1 from certificates where title = 'B private'), 'A now sees the certificate it asked for');
select t_ok((select count(*) from notifications where type = 'document_request_fulfilled') = 1, 'A is notified');
select t_as(:uc);
select t_ok(not exists(select 1 from certificates where title = 'B private'), 'fulfilling A''s request does not expose it to C');

-- Renewal of a requested certificate notifies the requester
select t_as(:ub);
update certificates set expiry_date = current_date + 800 where title = 'B private';
select t_as(:ua);
select t_ok((select count(*) from notifications where type = 'partner_certificate_renewed') = 1, 'A is told when B renews it');

-- Partner expiry reminders (scheduled job runs as service role)
reset role;
update certificates set expiry_date = current_date + 5 where title = 'B private';
set role service_role;
select ct_generate_expiry_notifications();
reset role;
set role authenticated;
select t_as(:ua);
select t_ok((select count(*) from notifications where type = 'partner_certificate_expiring') = 1, 'A is warned before B''s requested certificate expires');
select t_as(:ub);
select t_ok((select count(*) from notifications where type = 'certificate_expiry') = 1, 'B is warned about its own certificate');

-- ---------------------------------------------------------------------------
-- Ending a connection stops everything immediately
-- ---------------------------------------------------------------------------
select t_as(:ua);
select ct_end_connection((select id from connections where requester_org_id = (select a from ids)), 'test');
select t_ok(not exists(select 1 from certificates where organization_id = (select b from ids)), 'after ending, A sees nothing of B');
select t_ok((select count(*) from storage.objects) = 0, 'after ending, A cannot fetch B''s PDFs');
select t_as(:ub);
select t_ok(not exists(select 1 from certificates where organization_id = (select a from ids)), 'and B sees nothing of A');
select t_ok(not exists(select 1 from certificate_shares where grantee_org_id = (select a from ids)), 'shares to A are removed');
select t_ok((select count(*) from notifications where type = 'connection_ended') = 1, 'B is told the connection ended');
select t_as(:uc);
select t_ok((select count(*) from certificates where organization_id = (select b from ids)) = 2, 'C is unaffected');

-- ---------------------------------------------------------------------------
-- Unconnected organization and platform admin
-- ---------------------------------------------------------------------------
select t_as(:ud);
select t_ok(not exists(select 1 from certificates where organization_id <> (select d from ids)), 'D sees no one else''s certificates');
select t_ok((select count(*) from organizations) = 1, 'D sees only itself');

select t_as(:uadm);
select t_ok((select count(*) from organizations) = 4, 'platform admin sees all organizations');
select t_ok((select count(*) from ct_admin_network()) = 2, 'platform admin sees every connection');
select t_ok((select count(*) from certificates) >= 6, 'platform admin sees all certificates');

-- ---------------------------------------------------------------------------
-- Email invitation to an unregistered organization becomes a connection on sign-up
-- ---------------------------------------------------------------------------
select t_as(:ud);
select t_ok((ct_request_connection((select d from ids), 'new@epsilon.gr')->>'kind') = 'invitation', 'D invites an unregistered email');
reset role;
insert into auth.users(email, email_confirmed_at, raw_user_meta_data)
values ('new@epsilon.gr', now(), '{"type":"organization","name":"Epsilon AE","afm":"555555555"}');
select t_ok(exists(select 1 from connections c join organizations o on o.id = c.addressee_org_id
                   where o.vat_number = '555555555' and c.requester_org_id = (select d from ids) and c.status = 'pending'),
            'the invitation becomes a pending connection when they register');

-- ---------------------------------------------------------------------------
-- Deleting a whole organization (cascades through certificates, connections…)
-- ---------------------------------------------------------------------------
reset role;
delete from organizations where vat_number = '222222222';
select t_ok(not exists(select 1 from organizations where vat_number = '222222222'), 'an organization with data can be deleted');
select t_ok(not exists(select 1 from certificates c where not exists(select 1 from organizations o where o.id = c.organization_id)), 'its certificates are deleted with it');

\warn 'ALL TESTS PASSED'
