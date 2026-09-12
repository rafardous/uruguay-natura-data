begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(6);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000','77777777-7777-4777-8777-777777777777','authenticated','authenticated','traits-one@example.test','',now(),'{}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','88888888-8888-4888-8888-888888888888','authenticated','authenticated','traits-two@example.test','',now(),'{}','{}',now(),now());
insert into public.editor_access(email,user_id,role,active) values
 ('traits-one@example.test','77777777-7777-4777-8777-777777777777','collaborator',true),
 ('traits-two@example.test','88888888-8888-4888-8888-888888888888','collaborator',true);
insert into public.species(id,catalog_code,scientific_name,common_name,alternate_common_names,class,status,updated_at) values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','TRAIT_TEST','Testus traitus',' Nombre común ',array['Otro nombre','otro nombre','Nombre común'],'Aves','active','2026-09-11 12:00:00+00');
select extensions.is((select common_name from public.species where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'),'Nombre común','primary name is trimmed');
select extensions.is((select alternate_common_names from public.species where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'),array['Otro nombre'],'alternate names are deduplicated case-insensitively');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated","aal":"aal1"}',true);
create temporary table trait_change as select public.submit_species_change('dddddddd-dddd-4ddd-8ddd-dddddddddddd','update','{"traits":{"measurements":[{"kind":"body_mass","value":42,"unit":"g","basis":null,"estimated":false}],"lifeModes":[],"activity":[],"aquaticEnvironments":[],"waterZones":[],"depthMinM":null,"depthMaxM":null,"sources":["avonet"]}}','Rasgo observado') id;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated","aal":"aal1"}',true);
select extensions.lives_ok(format('select public.review_species_change(%L,true,false)',(select id from trait_change)),'another editor approves traits');
reset role;
select extensions.is((select traits#>>'{measurements,0,value}' from public.species where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'),'42','approved traits reach species');
select extensions.is((select size from public.species where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'),'Masa: 42 g','legacy size is derived from structured traits');
select extensions.is((select use_policy from public.catalog_sources where code='fishbase'),'review_only','FishBase remains review only');
select * from extensions.finish();
rollback;
