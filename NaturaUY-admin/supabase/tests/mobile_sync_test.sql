begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(7);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000','55555555-5555-4555-8555-555555555555','authenticated','authenticated','sync-one@example.test','',now(),'{}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','66666666-6666-4666-8666-666666666666','authenticated','authenticated','sync-two@example.test','',now(),'{}','{}',now(),now());

insert into public.species(id,catalog_code,scientific_name,common_name,class,status) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','SYNC_TEST','Syncus testus','Especie sync','Aves','active');

select extensions.throws_ok(
  $$select public.get_personal_mobile_progress()$$,
  '42501',
  'authentication_required',
  'personal progress requires authentication'
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal1"}',true);
select extensions.lives_ok(
  $$select public.sync_favorites('[{"catalogCode":"SYNC_TEST","isFavorite":true,"updatedAt":100}]'::jsonb)$$,
  'favorites sync succeeds'
);
select extensions.lives_ok(
  $$select public.record_game_result('classic','animals_all',7,4,100,1)$$,
  'game record sync succeeds'
);
select extensions.lives_ok(
  $$select public.sync_puzzle_records('[{"scope":"birds","gridSize":3,"bestTimeMs":9000,"fewestMoves":30,"playedAt":100,"updatedAt":100}]'::jsonb)$$,
  'puzzle record sync succeeds'
);
select extensions.is(
  jsonb_array_length(public.get_personal_mobile_progress()->'quizRecords'),
  1,
  'personal progress returns game records'
);
select extensions.is(
  jsonb_array_length(public.get_personal_mobile_progress()->'puzzleRecords'),
  1,
  'personal progress returns puzzle records'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated","aal":"aal1"}',true);
select extensions.is(
  jsonb_array_length(public.get_personal_mobile_progress()->'quizRecords')
    + jsonb_array_length(public.get_personal_mobile_progress()->'puzzleRecords'),
  0,
  'progress is isolated per user'
);
reset role;

select * from extensions.finish();
rollback;
