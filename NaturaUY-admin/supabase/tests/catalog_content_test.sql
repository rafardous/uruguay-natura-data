begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(8);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000','55555555-5555-4555-8555-555555555555','authenticated','authenticated','content-one@example.test','',now(),'{}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','66666666-6666-4666-8666-666666666666','authenticated','authenticated','content-two@example.test','',now(),'{}','{}',now(),now());
insert into public.editor_access(email,user_id,role,active) values
 ('content-one@example.test','55555555-5555-4555-8555-555555555555','collaborator',true),
 ('content-two@example.test','66666666-6666-4666-8666-666666666666','collaborator',true);
insert into public.species(id,catalog_code,scientific_name,common_name,class,status,updated_at) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','CONTENT_TEST','Testus contentus','Especie de contenido','Reptilia','active','2026-09-09 12:00:00+00');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal1"}',true);
select extensions.throws_ok($$insert into public.species_facts(species_id,body,source_id) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Este texto no debe escribirse de forma directa.',(select id from public.catalog_sources where code='gbif'))$$,'42501',null,'canonical content rejects direct writes');
create temporary table content_changes_test(kind text primary key,id uuid);
insert into content_changes_test values('abundance',public.submit_content_change('abundance',null,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','upsert',jsonb_build_object('category','common','label','Común','geographic_scope','Uruguay','source_id',(select id from public.catalog_sources where code='gbif')),null));
insert into content_changes_test values('profile',public.submit_content_change('game_profile',null,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','upsert','{"knowledge_level":"medium","rationale":"Reconocimiento intermedio","source_basis":"editorial"}',null));
insert into content_changes_test values('trivia',public.submit_content_change('trivia',null,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','upsert',jsonb_build_object('prompt','¿Cuál es la respuesta correcta para esta prueba?','explanation','Explicación verificable','source_id',(select id from public.catalog_sources where code='gbif'),'options',jsonb_build_array(jsonb_build_object('body','A','is_correct',true,'sort_order',0),jsonb_build_object('body','B','is_correct',false,'sort_order',1),jsonb_build_object('body','C','is_correct',false,'sort_order',2),jsonb_build_object('body','D','is_correct',false,'sort_order',3))),null));
select extensions.is((select count(*)::bigint from public.content_changes where status='pending'),3::bigint,'content proposals remain pending');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated","aal":"aal1"}',true);
select extensions.lives_ok(format('select public.review_content_change(%L,true,false)',(select id from content_changes_test where kind='abundance')),'another editor approves abundance');
select extensions.lives_ok(format('select public.review_content_change(%L,true,false)',(select id from content_changes_test where kind='profile')),'another editor approves game level');
select extensions.lives_ok(format('select public.review_content_change(%L,true,false)',(select id from content_changes_test where kind='trivia')),'another editor approves trivia');
select extensions.is((select abundance_status from public.species where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'),'Común','approved abundance updates compatibility field');
select extensions.is((select knowledge_level from public.species_game_profiles where species_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'),'medium','game profile is canonical');
select extensions.is((select count(*)::bigint from public.trivia_options where question_id=(select entity_id from public.content_changes where id=(select id from content_changes_test where kind='trivia'))),4::bigint,'trivia publishes four options');
reset role;

select * from extensions.finish();
rollback;
