begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(5);

select extensions.has_column('public','plant_profiles','height_min_cm','plant minimum height exists');
select extensions.has_column('public','plant_profiles','height_max_cm','plant maximum height exists');

insert into public.species(catalog_code,scientific_name,common_name,kingdom,phylum,class,natural_history)
values('test-curated-plant','Testa botanica','Planta de prueba','Plantae','Tracheophyta','Angiospermae',
  '{"version":1,"plant":{"habit":"Hierba","heightCm":{"min":30,"max":120},"phenology":{"floweringMonths":[9,10],"fruitingMonths":[11,12]}}}'::jsonb);

select extensions.is((select height_min_cm from public.plant_profiles p join public.species s on s.id=p.species_id where s.catalog_code='test-curated-plant'),30::numeric,'minimum height synced');
select extensions.is((select flowering_months from public.plant_profiles p join public.species s on s.id=p.species_id where s.catalog_code='test-curated-plant'),array[9,10]::smallint[],'flowering months synced');
select extensions.is((select fruiting_months from public.plant_profiles p join public.species s on s.id=p.species_id where s.catalog_code='test-curated-plant'),array[11,12]::smallint[],'fruiting months synced');

select * from extensions.finish();
rollback;
