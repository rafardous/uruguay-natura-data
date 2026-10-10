begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(14);

select extensions.ok(to_regclass('public.taxon_names') is not null,'taxon names table exists');
select extensions.ok(to_regclass('public.taxon_closure') is not null,'taxon closure table exists');
select extensions.ok(to_regclass('public.plant_profiles') is not null,'plant profiles table exists');
select extensions.ok(to_regclass('public.plant_species_editor') is not null,'plant editor view exists');
select extensions.ok(has_table_privilege('authenticated','public.plant_profiles','select'),'plant profiles are explicitly readable by editors');
select extensions.ok(not has_table_privilege('anon','public.plant_profiles','select,insert,update,delete'),'anonymous clients have no plant profile privileges');
select extensions.ok((select relrowsecurity from pg_class where oid='public.plant_profiles'::regclass),'plant profiles have RLS');
select extensions.ok(to_regprocedure('private.sync_plant_profile_from_species()') is not null,'plant profile sync function exists');
select extensions.is((select count(*)::bigint from pg_trigger where tgrelid='public.species'::regclass and tgname='sync_plant_profile_from_species' and not tgisinternal),1::bigint,'species revisions synchronize the normalized plant profile');
select extensions.ok((select coalesce(reloptions,'{}') @> array['security_invoker=true'] from pg_class where oid='public.plant_species_editor'::regclass),'plant view invokes caller security');
select extensions.is((select count(*)::bigint from public.catalog_sources where code in ('flora_uruguaya','world_flora_online')),2::bigint,'plant sources are registered');
select extensions.ok(pg_get_functiondef('private.force_catalog_schema_14()'::regprocedure) like '%new.schema_version:=14%','new releases force schema 14');
select extensions.ok((select pg_get_constraintdef(oid) like '%plants%' from pg_constraint where conrelid='public.mobile_puzzle_records'::regclass and conname='mobile_puzzle_records_scope_check'),'puzzle records accept plants');
select extensions.ok(has_function_privilege('authenticated','public.sync_puzzle_records(jsonb)','execute'),'authenticated users can sync eligible puzzle records');

select * from extensions.finish();
rollback;
