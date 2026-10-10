begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(10);

select extensions.ok(to_regprocedure('public.reconcile_guide_bird_media(uuid,jsonb)') is not null,
  'guide reconciliation RPC exists');
select extensions.ok(not (select prosecdef from pg_proc where oid = 'public.reconcile_guide_bird_media(uuid,jsonb)'::regprocedure),
  'RPC executes with caller privileges');
select extensions.ok(has_function_privilege('service_role', 'public.reconcile_guide_bird_media(uuid,jsonb)', 'EXECUTE'),
  'service role can reconcile guide media');
select extensions.ok(not has_function_privilege('authenticated', 'public.reconcile_guide_bird_media(uuid,jsonb)', 'EXECUTE'),
  'mobile and editorial browser clients cannot call the privileged RPC');
select extensions.ok(pg_get_functiondef('public.reconcile_guide_bird_media(uuid,jsonb)'::regprocedure) like
  '%guide_media_image_limit_exceeded%', 'RPC enforces the two image limit');

insert into auth.users(id,email,raw_user_meta_data) values('99999999-9999-4999-8999-999999999999','guide-test@example.test','{}');
insert into public.species(id,catalog_code,scientific_name,common_name,class,status)
values('99999999-9999-4999-8999-999999999998','GUIDE_TEST','Guidus testus','Ave de prueba','Aves','active');
create temporary table guide_photos_test(payload jsonb);
insert into guide_photos_test select jsonb_agg(jsonb_build_object(
  'id',case when i=1 then '99999999-9999-4999-8999-999999999991' else '99999999-9999-4999-8999-999999999992' end,
  'species_id','99999999-9999-4999-8999-999999999998','type','image','status','approved','ordinal',i,'is_primary',i=1,
  'storage_path',format('guia-aves/001/0%s.webp',i),'thumbnail_path',format('guia-aves/001/0%s-480.webp',i),
  'checksum_sha256',repeat('a',64),'author','Pedro Rinaldi','license','permission','source','Archivo fotográfico familiar',
  'original_filename',format('001/0%s.webp',i),'evidence_path','guide-test.json','authorization_evidence_ref','guide-test.json',
  'uploaded_by','99999999-9999-4999-8999-999999999999')) from generate_series(1,2) i;
select extensions.is(public.reconcile_guide_bird_media('99999999-9999-4999-8999-999999999998',(select payload from guide_photos_test)),2,'both verified photos can be registered');
select extensions.is((select count(*)::integer from public.species_media where species_id='99999999-9999-4999-8999-999999999998' and is_primary),1,'exactly one primary image is retained');
select extensions.is(public.reconcile_guide_bird_media('99999999-9999-4999-8999-999999999998',(select payload from guide_photos_test)),0,'repeating registration creates no duplicate media');
select extensions.is((select count(*)::integer from public.species_media where species_id='99999999-9999-4999-8999-999999999998'),2,'media identity survives repetition');
select extensions.throws_ok($$select public.reconcile_guide_bird_media('99999999-9999-4999-8999-999999999998','[]')$$,'P0001','guide_media_requires_one_or_two_photos','empty selection is rejected');

select * from extensions.finish();
rollback;
