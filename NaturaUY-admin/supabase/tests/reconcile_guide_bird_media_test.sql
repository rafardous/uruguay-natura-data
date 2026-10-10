begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(5);

select extensions.ok(to_regprocedure('public.reconcile_guide_bird_media(uuid,jsonb)') is not null,
  'guide reconciliation RPC exists');
select extensions.ok(not (select prosecdef from pg_proc where oid = 'public.reconcile_guide_bird_media(uuid,jsonb)'::regprocedure),
  'RPC executes with caller privileges');
select extensions.ok(has_function_privilege('service_role', 'public.reconcile_guide_bird_media(uuid,jsonb)', 'EXECUTE'),
  'service role can reconcile guide media');
select extensions.ok(not has_function_privilege('authenticated', 'public.reconcile_guide_bird_media(uuid,jsonb)', 'EXECUTE'),
  'mobile and editorial browser clients cannot call the privileged RPC');
select extensions.like(pg_get_functiondef('public.reconcile_guide_bird_media(uuid,jsonb)'::regprocedure),
  '%guide_media_image_limit_exceeded%', 'RPC enforces the two image limit');

select * from extensions.finish();
rollback;
