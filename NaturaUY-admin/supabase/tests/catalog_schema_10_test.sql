begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(7);

select extensions.is(
  (select simple_name from public.taxon_content where taxon_rank='phylum' and taxon_name='Chordata'),
  'Vertebrados',
  'Chordata has a simple Spanish name'
);
select extensions.is(
  (select simple_name from public.taxon_content where taxon_rank='class' and taxon_name='Mammalia'),
  'Mamíferos',
  'Mammalia has a simple Spanish name'
);
select extensions.is(
  (select simple_name from public.taxon_content where taxon_rank='order' and taxon_name='Rodentia'),
  'Roedores',
  'orders may have simple Spanish names'
);
select extensions.is(
  (select count(*)::bigint from public.taxon_content where taxon_rank='class' and class_name in ('Aves','Actinopterygii','Chondrichthyes') and simple_name is not null),
  0::bigint,
  'birds and fish classes do not get a redundant simple name'
);
select extensions.is(
  (select count(*)::bigint from public.catalog_sources where code in ('journal_of_avian_biology','the_auk','usgs_nas','mammalian_species','global_ecology_conservation','udelar_colibri','animal_diversity_web')),
  7::bigint,
  'featured fact sources are registered'
);
select extensions.lives_ok(
  $$insert into public.taxon_content(taxon_rank,class_name,taxon_name,description,simple_name,source_id)
    values('class','TestClass','TestClass','Descripción de prueba suficientemente extensa para validar el nuevo rango de clase.','Clase de prueba',(select id from public.catalog_sources where code='natura_uy_editorial'))$$,
  'schema 10 accepts class content'
);
select extensions.throws_ok(
  $$insert into public.taxon_content(taxon_rank,class_name,taxon_name,description,source_id)
    values('genus','TestClass','Testus','Descripción de prueba suficientemente extensa para validar un rango rechazado.',(select id from public.catalog_sources where code='natura_uy_editorial'))$$,
  '23514',null,'schema 10 rejects unsupported taxon ranks'
);

select * from extensions.finish();
rollback;
