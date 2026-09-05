begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(34);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111111','authenticated','authenticated','one@example.test','',now(),'{}','{"display_name":"Editor Uno"}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-4222-8222-222222222222','authenticated','authenticated','two@example.test','',now(),'{}','{"display_name":"Editor Dos"}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','33333333-3333-4333-8333-333333333333','authenticated','authenticated','admin@example.test','',now(),'{}','{"display_name":"Admin"}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-8444-444444444444','authenticated','authenticated','user@example.test','',now(),'{}','{"display_name":"Usuario"}',now(),now());

insert into public.editor_memberships(user_id,role,active) values
  ('11111111-1111-4111-8111-111111111111','collaborator',true),
  ('22222222-2222-4222-8222-222222222222','collaborator',true),
  ('33333333-3333-4333-8333-333333333333','admin',true);

insert into public.species(id,catalog_code,scientific_name,common_name,class,status,updated_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','TEST_ACTIVE','Testus activus','Especie activa','Aves','active','2026-08-28 12:00:00+00'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','TEST_ARCHIVED','Testus archivus','Especie archivada','Aves','archived','2026-08-28 12:00:00+00');

set local role anon;
select extensions.is((select count(*)::bigint from public.species),1::bigint,'anon only reads active species');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal1"}',true);
select extensions.is((select count(*)::bigint from public.species),1::bigint,'ordinary authenticated user only reads active species');
select extensions.throws_ok($$update public.species set common_name='Directo' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,'42501',null,'direct catalogue update is denied');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
select extensions.is((select count(*)::bigint from public.species),2::bigint,'active collaborator reads archived species');
create temporary table test_requests(kind text primary key,id uuid);
insert into test_requests values('normal',public.submit_species_change('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','update','{"common_name":"Nombre aprobado"}','Corrección normal'));
select extensions.ok((select id is not null from test_requests where kind='normal'),'collaborator submits a diff');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
select extensions.lives_ok(format('select public.approve_species_change(%L,false)',(select id from test_requests where kind='normal')),'another collaborator approves the change');
select extensions.is((select common_name from public.species where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'Nombre aprobado','approval applies the diff');
select extensions.is((select before_values->>'common_name' from public.species_audit where change_request_id=(select id from test_requests where kind='normal')),'Especie activa','audit stores changed before value');
select extensions.is((select after_values->>'common_name' from public.species_audit where change_request_id=(select id from test_requests where kind='normal')),'Nombre aprobado','audit stores changed after value');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
insert into test_requests values('self',public.submit_species_change('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','update','{"description":"Descripción autocontrolada"}','Autovalidación'));
select extensions.throws_ok(format('select public.approve_species_change(%L,false)',(select id from test_requests where kind='self')),'P0001','self_validation_confirmation_required','self-validation requires confirmation');
select extensions.lives_ok(format('select public.approve_species_change(%L,true)',(select id from test_requests where kind='self')),'confirmed self-validation succeeds');
insert into test_requests values('reject',public.submit_species_change('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','update','{"size":"No aplicar"}','Rechazar'));
select extensions.lives_ok(format('select public.reject_species_change(%L)',(select id from test_requests where kind='reject')),'pending request can be rejected');
select extensions.is((select status from public.species_change_requests where id=(select id from test_requests where kind='reject')),'rejected','rejection is persisted');
insert into test_requests values('create',public.submit_species_change(null,'create','{"catalog_code":"TEST_NEW","scientific_name":"Testus novus","common_name":"Especie nueva"}','Alta'));
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
select extensions.lives_ok(format('select public.approve_species_change(%L,false)',(select id from test_requests where kind='create')),'new species request is approved');
select extensions.is((select count(*)::bigint from public.species where catalog_code='TEST_NEW'),1::bigint,'new species is created exactly once');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
insert into test_requests values('conflict',public.submit_species_change('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','update','{"size":"Cambio antiguo"}','Conflicto'));
reset role;
update public.species set updated_at=updated_at+interval '1 second' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
select extensions.throws_ok(format('select public.approve_species_change(%L,false)',(select id from test_requests where kind='conflict')),'P0001','species_change_conflict','stale request cannot overwrite newer state');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
insert into test_requests values('rollback',public.submit_species_change('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','update','{"relevant_note":"Debe revertirse"}','Prueba rollback'));
reset role;
create function pg_temp.fail_audit() returns trigger language plpgsql as $$begin raise exception 'audit_forced_failure'; end$$;
create trigger test_fail_audit before insert on public.species_audit for each row execute function pg_temp.fail_audit();
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
select extensions.throws_ok(format('select public.approve_species_change(%L,false)',(select id from test_requests where kind='rollback')),'P0001','audit_forced_failure','audit failure aborts approval transaction');
select extensions.is((select relevant_note from public.species where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),null,'species update rolled back with failed audit');
select extensions.is((select status from public.species_change_requests where id=(select id from test_requests where kind='rollback')),'pending','request status rolled back with failed audit');
reset role;
drop trigger test_fail_audit on public.species_audit;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal1"}',true);
select extensions.lives_ok($$select public.submit_bug_report('Primer problema reproducible','1.0.0')$$,'first bug report is accepted');
select extensions.throws_ok($$select public.submit_bug_report('Segundo problema demasiado pronto','1.0.0')$$,'P0001','bug_report_rate_limited','second bug report inside 24 hours is rejected');
reset role;
update public.bug_reports set created_at=now()-interval '25 hours' where user_id='44444444-4444-4444-8444-444444444444';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal1"}',true);
select extensions.lives_ok($$select public.submit_bug_report('Nuevo problema al día siguiente','1.0.0')$$,'bug report after 24 hours is accepted');
select extensions.lives_ok($$select public.submit_suggestion('Agregar búsqueda por ecosistema')$$,'suggestion RPC accepts authenticated input');
select extensions.lives_ok($$select public.submit_review_request('TEST_ACTIVE','La descripción requiere una nueva fuente')$$,'review request RPC accepts a known active species');
select extensions.lives_ok($$insert into public.favorites(user_id,species_id) values('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,'favorite owner can insert directly');
select extensions.throws_ok($$insert into public.favorites(user_id,species_id) values('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,'42501',null,'favorite cannot be inserted for another user');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
create temporary table media_reservations as select * from public.reserve_species_media_upload('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'image','Autora Uno','CC0','Fotografía propia',null,'uno.jpg',false,true,null,null);
insert into media_reservations select * from public.reserve_species_media_upload('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'image','Autora Dos','CC-BY-4.0','Archivo propio',null,'dos.jpg',false,true,null,null);
select extensions.results_eq('select ordinal from media_reservations order by ordinal',array[1,2],'separate media reservations receive distinct ordinals');
select extensions.throws_ok($$select public.reserve_species_media_upload('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'image','','CC0','Fuente',null,'bad.jpg',false,true,null,null)$$,'P0001','media_attribution_required','media attribution is mandatory');
select extensions.is((select count(*)::bigint from public.species_media),2::bigint,'editor reads pending media metadata');
reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select extensions.is((select count(*)::bigint from public.species_media),0::bigint,'anonymous clients cannot read pending media');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
select extensions.throws_ok($$select public.request_catalog_publish()$$,'42501','admin_access_required','collaborator cannot request publication');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}',true);
select extensions.throws_ok($$select public.request_catalog_publish()$$,'42501','admin_access_required','admin publication requires MFA assurance');
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal2"}',true);
select extensions.lives_ok($$select public.request_catalog_publish()$$,'admin with MFA can request publication');
reset role;

select extensions.is(
  (select count(*)::bigint from pg_proc where prosecdef and pronamespace='public'::regnamespace and coalesce(proconfig,'{}') @> array['search_path=""']),
  (select count(*)::bigint from pg_proc where prosecdef and pronamespace='public'::regnamespace),
  'every public SECURITY DEFINER function fixes an empty search_path'
);

select * from extensions.finish();
rollback;
