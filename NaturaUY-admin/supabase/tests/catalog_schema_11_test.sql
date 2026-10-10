begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(13);

select extensions.is((select jsonb_typeof(taxon_identifiers) from public.species limit 1),'object','species exposes schema 11 taxon identifiers');
select extensions.is((select jsonb_typeof(natural_history) from public.species limit 1),'object','species exposes schema 11 natural history');
select extensions.is((select jsonb_typeof(distribution_summary) from public.species limit 1),'object','species exposes schema 11 distribution summary');
select extensions.is((select simple_name from public.taxon_content where taxon_rank='phylum' and taxon_name='Arthropoda'),'Artrópodos','Arthropoda has public content');
select extensions.is((select count(*)::bigint from public.taxon_content where taxon_rank='class' and taxon_name in ('Arachnida','Insecta','Malacostraca')),3::bigint,'arthropod classes have public content');
select extensions.is((select count(*)::bigint from public.catalog_sources where code in ('inaturalist','wikimedia','bold')),3::bigint,'external arthropod pipeline sources are registered');
select extensions.is((select schema_version from public.catalog_releases order by requested_at desc limit 1),14,'schema 11 fields remain compatible after the schema 14 upgrade');
select extensions.is((select count(*)::bigint from pg_constraint where conrelid='public.species_game_rules'::regclass and conname='species_game_rules_game_key_check'),1::bigint,'games keep a constrained extensible rule vocabulary');
select extensions.ok(to_regclass('public.taxa') is not null,'flexible taxa tree exists');
select extensions.ok(to_regclass('public.species_taxa') is not null,'species taxon links exist');
select extensions.is((select count(*)::bigint from public.taxa where rank='subphylum' and canonical_name in ('Chelicerata','Hexapoda','Crustacea')),3::bigint,'arthropod subphyla are available');
select extensions.is((select count(*)::bigint from public.taxon_content where taxon_rank='subphylum' and taxon_name in ('Chelicerata','Hexapoda','Crustacea') and simple_name is not null),3::bigint,'arthropod subphyla have simple content');
select extensions.ok(has_table_privilege('authenticated','public.taxa','select'),'taxa is explicitly exposed to editors');

select * from extensions.finish();
rollback;
