begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(18);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000','99999999-9999-4999-8999-999999999999','authenticated','authenticated','applicant@example.test','',now(),'{}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1','authenticated','authenticated','editor-audio@example.test','',now(),'{}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1','authenticated','authenticated','admin-news@example.test','',now(),'{}','{}',now(),now());
insert into public.editor_access(email,user_id,role,active) values
 ('editor-audio@example.test','aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1','collaborator',true),
 ('admin-news@example.test','bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1','admin',true);
insert into public.species(id,catalog_code,scientific_name,common_name,class,status,updated_at) values
 ('ccccccc1-cccc-4ccc-8ccc-ccccccccccc1','AUDIO_TEST_ONE','Testus audio uno','Especie de audio uno','Aves','active',now()),
 ('ccccccc2-cccc-4ccc-8ccc-ccccccccccc2','AUDIO_TEST_TWO','Testus audio dos','Especie de audio dos','Aves','active',now());

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated","aal":"aal1"}',true);
select extensions.lives_ok($$select public.submit_collaborator_application(array['Fotos y audios','Conservación'],'Tengo experiencia registrando fauna y ordenando datos de campo.','Quiero ayudar a mejorar el catálogo con aportes documentados y comprensibles.','monthly','https://example.test/portfolio',true)$$,'a signed-in person can submit a collaboration application');
select extensions.is((select status from public.collaborator_applications where user_id='99999999-9999-4999-8999-999999999999'),'pending','new collaboration applications start pending');
select extensions.throws_ok($$select public.submit_collaborator_application(array['Fotos'],'Tengo experiencia registrando fauna y ordenando datos de campo.','Quiero ayudar a mejorar el catálogo con aportes documentados y comprensibles.','monthly',null,true)$$,'P0001','collaborator_application_already_open','only one open application is allowed');
select extensions.throws_ok($$insert into public.collaborator_applications(user_id,contact_name,contact_email,interests,experience,motivation,availability,consent) values(auth.uid(),'Directo','direct@example.test',array['Otro'],'Una experiencia que no debería entrar por escritura directa.','Una motivación suficientemente larga que tampoco debe entrar por escritura directa.','monthly',true)$$,'42501',null,'applications reject direct client inserts');
select extensions.is((select count(*)::bigint from public.collaborator_applications where user_id=auth.uid()),1::bigint,'the applicant can read only the own application');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1","role":"authenticated","aal":"aal1"}',true);
select extensions.is((select count(*)::bigint from public.collaborator_applications),0::bigint,'another editor cannot read a private applicant record');
select extensions.lives_ok($$select public.reserve_species_media_upload('ccccccc1-cccc-4ccc-8ccc-ccccccccccc1',null,'audio','Pedro Rinaldi','CC0','Xeno-canto','https://xeno-canto.org/123456','xc-123456.mp3',false,null)$$,'an editor can reserve an audio upload');
create temporary table audio_reservations as select id, incoming_path from public.species_media where species_id='ccccccc1-cccc-4ccc-8ccc-ccccccccccc1' and type='audio';
select extensions.lives_ok(format('select public.update_species_audio_metadata(%L,%L,%L,%L)',(select id from audio_reservations),'123456','CC BY-NC-SA 4.0','permission-pedro-2026'),'audio metadata can be completed through an RPC');
select extensions.is((select external_id from public.species_media where id=(select id from audio_reservations)),'123456','audio stores the external Xeno-canto ID');
select extensions.is((select original_license from public.species_media where id=(select id from audio_reservations)),'CC BY-NC-SA 4.0','audio stores the original licence separately');
select extensions.lives_ok($$select public.reserve_species_media_upload('ccccccc2-cccc-4ccc-8ccc-ccccccccccc2',null,'audio','Pedro Rinaldi','CC0','Xeno-canto','https://xeno-canto.org/123456','xc-123456.mp3',false,null)$$,'a second species can reserve another audio upload');
select extensions.throws_ok(format('select public.update_species_audio_metadata(%L,%L,%L,%L)',(select id from public.species_media where species_id='ccccccc2-cccc-4ccc-8ccc-ccccccccccc2' and type='audio'),'123456','CC BY-NC-SA 4.0','permission-pedro-2026'),'23505',null,'audio external IDs are unique');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1","role":"authenticated","aal":"aal2"}',true);
select extensions.lives_ok($$select public.review_collaborator_application((select id from public.collaborator_applications limit 1),'accepted','Gracias por tu propuesta.')$$,'an admin can review an application');
select extensions.is((select status from public.collaborator_applications limit 1),'accepted','review stores the selected status');
select extensions.lives_ok($$select public.save_home_news(null,'Biodiversidad en Uruguay','Ministerio de Ambiente','https://example.test/news/1',null,now(),'published',1)$$,'an admin can publish a curated news link');
select extensions.lives_ok($$select public.save_home_news(null,'Borrador editorial','Natura UY','https://example.test/news/2',null,null,'draft',2)$$,'an admin can save a news draft');
select extensions.is((select count(*)::bigint from public.home_news),2::bigint,'news stores published and draft editorial records');
reset role;

set local role anon;
select extensions.is((select count(*)::bigint from public.home_news),1::bigint,'anonymous readers only see published news');
reset role;

select * from extensions.finish();
rollback;
