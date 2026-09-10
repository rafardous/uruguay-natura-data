begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(8);

select extensions.is((select count(*)::bigint from public.taxon_content where class_name='Aves' and taxon_rank='order'),27::bigint,'seeds the 27 bird orders');
select extensions.is((select count(*)::bigint from public.trivia_questions where active),12::bigint,'seeds demo trivia questions');
select extensions.is((select count(*)::bigint from public.trivia_options),48::bigint,'seeds four options per demo question');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000','77777777-7777-4777-8777-777777777777','authenticated','authenticated','taxon-one@example.test','',now(),'{}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','88888888-8888-4888-8888-888888888888','authenticated','authenticated','taxon-two@example.test','',now(),'{}','{}',now(),now());
insert into public.editor_access(email,user_id,role,active) values
 ('taxon-one@example.test','77777777-7777-4777-8777-777777777777','collaborator',true),
 ('taxon-two@example.test','88888888-8888-4888-8888-888888888888','collaborator',true);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated","aal":"aal1"}',true);
select extensions.throws_ok($$insert into public.taxon_content(taxon_rank,class_name,taxon_name,description,source_id) values('family','Mammalia','Testidae','Una descripción directa que debe ser rechazada por las políticas.',(select id from public.catalog_sources where code='natura_uy_editorial'))$$,'42501',null,'canonical taxon content rejects direct writes');
create temporary table taxon_change_test(id uuid);
insert into taxon_change_test select public.submit_content_change('taxon_content',null,null,'upsert',jsonb_build_object('taxon_rank','family','kingdom','Animalia','phylum','Chordata','class_name','Mammalia','taxon_name','Testidae','language','es-UY','description','Familia de prueba suficientemente descrita para validar el flujo editorial completo.','source_id',(select id from public.catalog_sources where code='natura_uy_editorial')),'Prueba automatizada');
select extensions.is((select status from public.content_changes where id=(select id from taxon_change_test)),'pending','taxon description remains pending');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated","aal":"aal1"}',true);
select extensions.lives_ok(format('select public.review_content_change(%L,true,false)',(select id from taxon_change_test)),'another editor approves taxon content');
select extensions.is((select count(*)::bigint from public.taxon_content where class_name='Mammalia' and taxon_name='Testidae'),1::bigint,'approved future family is stored');
select extensions.is((select schema_version from public.catalog_releases limit 1),null::integer,'release schema remains lazy until requested');
reset role;

select * from extensions.finish();
rollback;
