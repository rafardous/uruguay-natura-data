begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(16);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111111','authenticated','authenticated','one@example.test','',now(),'{}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','22222222-2222-4222-8222-222222222222','authenticated','authenticated','two@example.test','',now(),'{}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','33333333-3333-4333-8333-333333333333','authenticated','authenticated','admin@example.test','',now(),'{}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-8444-444444444444','authenticated','authenticated','mobile@example.test','',now(),'{}','{}',now(),now());

update public.profiles set display_name = value.display_name from (values
 ('11111111-1111-4111-8111-111111111111','Editora uno'),
 ('22222222-2222-4222-8222-222222222222','Editor dos'),
 ('33333333-3333-4333-8333-333333333333','Administradora'),
 ('44444444-4444-4444-8444-444444444444','Móvil')) as value(user_id,display_name)
where public.profiles.user_id = value.user_id::uuid;
insert into public.editor_access(email,user_id,role,active) values
 ('one@example.test','11111111-1111-4111-8111-111111111111','collaborator',true),
 ('two@example.test','22222222-2222-4222-8222-222222222222','collaborator',true),
 ('admin@example.test','33333333-3333-4333-8333-333333333333','admin',true);
insert into public.species(id,catalog_code,scientific_name,common_name,class,status,updated_at) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','TEST_ACTIVE','Testus activus','Especie activa','Aves','active','2026-08-28 12:00:00+00'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','TEST_ARCHIVED','Testus archivus','Especie archivada','Aves','archived','2026-08-28 12:00:00+00');

set local role anon;
select extensions.is((select count(*)::bigint from public.species),1::bigint,'anonymous clients only see active species');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","aal":"aal1"}',true);
select extensions.throws_ok($$update public.species set common_name='Directo' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,'42501',null,'clients cannot write species directly');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
create temporary table test_changes(kind text primary key,id uuid);
insert into test_changes values('normal',public.submit_species_change('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','update','{"common_name":"Nombre aprobado"}','Corrección'));
select extensions.ok((select id is not null from test_changes where kind='normal'),'collaborator can submit a change');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
select extensions.lives_ok(format('select public.review_species_change(%L,true,false)',(select id from test_changes where kind='normal')),'another collaborator validates it');
select extensions.is((select common_name from public.species where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'Nombre aprobado','approval updates species');
select extensions.is((select before_values->>'common_name' from public.species_changes where id=(select id from test_changes where kind='normal')),'Especie activa','history stores before value');
select extensions.is((select after_values->>'common_name' from public.species_changes where id=(select id from test_changes where kind='normal')),'Nombre aprobado','history stores after value');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
insert into test_changes values('self',public.submit_species_change('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','update','{"description":"Autovalidación"}','Autovalidación'));
select extensions.throws_ok(format('select public.review_species_change(%L,true,false)',(select id from test_changes where kind='self')),'P0001','self_validation_confirmation_required','self validation requires an explicit confirmation');
select extensions.lives_ok(format('select public.review_species_change(%L,true,true)',(select id from test_changes where kind='self')),'confirmed self validation is recorded');
create temporary table reservations as select * from public.reserve_species_media_upload('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'image','Autora uno','CC0','Propia',null,'uno.webp',false,null);
insert into reservations select * from public.reserve_species_media_upload('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'image','Autora dos','CC-BY-4.0','Archivo',null,'dos.webp',false,null);
select extensions.is((select count(*)::bigint from reservations),2::bigint,'two image reservations are allowed');
select extensions.throws_ok($$select public.reserve_species_media_upload('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'image','Autora tres','CC0','Archivo',null,'tres.webp',false,null)$$,'P0001','media_limit_exceeded','third image is rejected');
select extensions.throws_ok($$select public.reserve_species_media_upload('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'audio','Autora audio','permission','Archivo',null,'audio.wav',false,null)$$,'P0001','permission_evidence_required','permission media needs private evidence');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
insert into test_changes values('conflict',public.submit_species_change('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','update','{"size":"Viejo"}','Conflicto'));
reset role;
update public.species set updated_at=updated_at+interval '1 second' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
select extensions.throws_ok(format('select public.review_species_change(%L,true,false)',(select id from test_changes where kind='conflict')),'P0001','species_change_conflict','stale change is rejected');
select extensions.throws_ok($$select public.request_catalog_publish()$$,'42501','admin_access_required','collaborator cannot publish');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}',true);
select extensions.throws_ok($$select public.request_catalog_publish()$$,'42501','admin_access_required','admin requires AAL2 to publish');
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal2"}',true);
select extensions.lives_ok($$select public.request_catalog_publish()$$,'AAL2 admin can publish');
reset role;

select * from extensions.finish();
rollback;
