-- Catálogo 10: nombres simples para la navegación taxonómica, fuentes
-- resolubles en el artefacto offline y un conjunto editorial inicial de datos
-- relevantes. Las escrituras interactivas siguen pasando por revisión.

alter table public.taxon_content
  drop constraint if exists taxon_content_taxon_rank_check;
alter table public.taxon_content
  add constraint taxon_content_taxon_rank_check
  check (taxon_rank in ('phylum','class','order','family'));
alter table public.taxon_content
  add column simple_name text;
alter table public.taxon_content
  add constraint taxon_content_simple_name_length
  check (simple_name is null or length(trim(simple_name)) between 2 and 80);

create or replace function private.submit_taxon_content_change(p_entity_id uuid,p_proposed_values jsonb,p_comment text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=public.require_editor(); v_id uuid; v_rank text:=p_proposed_values->>'taxon_rank';
begin
  if jsonb_typeof(p_proposed_values)<>'object'
     or v_rank not in ('phylum','class','order','family')
     or (v_rank<>'phylum' and length(trim(coalesce(p_proposed_values->>'class_name','')))=0)
     or length(trim(coalesce(p_proposed_values->>'taxon_name','')))=0
     or length(trim(coalesce(p_proposed_values->>'description',''))) not between 30 and 800
     or length(trim(coalesce(p_proposed_values->>'simple_name',''))) > 80
  then raise exception 'invalid_taxon_content'; end if;
  insert into public.content_changes(content_type,entity_id,species_id,operation,proposed_values,proposed_by,comment)
  values('taxon_content',p_entity_id,null,'upsert',p_proposed_values,v_actor,nullif(trim(p_comment),'')) returning id into v_id;
  return v_id;
end $$;

create or replace function private.review_taxon_content_change(p_change_id uuid,p_approve boolean,p_confirm_self_validation boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=public.require_editor(); v_change public.content_changes; v_id uuid; v_before jsonb:='{}'::jsonb;
begin
  select * into v_change from public.content_changes where id=p_change_id and content_type='taxon_content' for update;
  if not found or v_change.status<>'pending' then raise exception 'change_not_pending'; end if;
  if v_change.proposed_by=v_actor and not p_confirm_self_validation then raise exception 'self_validation_confirmation_required'; end if;
  if not p_approve then
    update public.content_changes set status='rejected',reviewed_by=v_actor,reviewed_at=now(),self_validation_confirmed=p_confirm_self_validation where id=p_change_id;
    return p_change_id;
  end if;
  v_id:=coalesce(v_change.entity_id,gen_random_uuid());
  select to_jsonb(t) into v_before from public.taxon_content t where t.id=v_change.entity_id;
  insert into public.taxon_content(id,taxon_rank,kingdom,phylum,class_name,taxon_name,language,description,simple_name,source_id,source_record_id,active,created_by,reviewed_by)
  values(
    v_id,v_change.proposed_values->>'taxon_rank',
    coalesce(nullif(trim(v_change.proposed_values->>'kingdom'),''),'Animalia'),
    coalesce(nullif(trim(v_change.proposed_values->>'phylum'),''),'Chordata'),
    trim(coalesce(v_change.proposed_values->>'class_name','')),
    trim(v_change.proposed_values->>'taxon_name'),
    coalesce(nullif(trim(v_change.proposed_values->>'language'),''),'es-UY'),
    trim(v_change.proposed_values->>'description'),nullif(trim(v_change.proposed_values->>'simple_name'),''),
    (v_change.proposed_values->>'source_id')::uuid,nullif(trim(v_change.proposed_values->>'source_record_id'),''),
    true,v_change.proposed_by,v_actor
  )
  on conflict(id) do update set
    taxon_rank=excluded.taxon_rank,kingdom=excluded.kingdom,phylum=excluded.phylum,class_name=excluded.class_name,
    taxon_name=excluded.taxon_name,language=excluded.language,description=excluded.description,
    simple_name=excluded.simple_name,source_id=excluded.source_id,source_record_id=excluded.source_record_id,
    active=true,reviewed_by=v_actor,updated_at=now();
  update public.content_changes set entity_id=v_id,status='approved',before_values=coalesce(v_before,'{}'::jsonb),
    after_values=v_change.proposed_values,reviewed_by=v_actor,reviewed_at=now(),self_validation_confirmed=p_confirm_self_validation
  where id=p_change_id;
  return v_id;
end $$;

insert into public.catalog_sources(code,name,url,publisher,license,use_policy,citation) values
  ('journal_of_avian_biology','Journal of Avian Biology','https://doi.org/10.1111/jav.01637','Nordic Society Oikos','Citation only','identifier_only','Diniz et al. 2018'),
  ('the_auk','The Auk','https://doi.org/10.1642/0004-8038(2003)120[0418:MPCIGR]2.0.CO;2','American Ornithologists'' Union','Citation only','identifier_only','Fernández & Reboreda 2003'),
  ('usgs_nas','USGS Nonindigenous Aquatic Species','https://nas.er.usgs.gov/queries/FactSheet.aspx?speciesID=2587','U.S. Geological Survey','Public domain','identifier_only','USGS NAS species fact sheet'),
  ('mammalian_species','Mammalian Species','https://academic.oup.com/mspecies','American Society of Mammalogists','Citation only','identifier_only','Mammalian Species accounts'),
  ('global_ecology_conservation','Global Ecology and Conservation','https://doi.org/10.1016/j.gecco.2026.e04088','Elsevier','Citation only','identifier_only','Maternal care in broad-snouted caiman'),
  ('udelar_colibri','Colibrí — Universidad de la República','https://hdl.handle.net/20.500.12008/17190','Universidad de la República','Citation only','identifier_only','Repositorio Colibrí, Udelar'),
  ('animal_diversity_web','Animal Diversity Web','https://animaldiversity.org/accounts/Molothrus_bonariensis/','University of Michigan Museum of Zoology','Citation only','identifier_only','Molothrus bonariensis species account')
on conflict(code) do update set
  name=excluded.name,url=excluded.url,publisher=excluded.publisher,license=excluded.license,
  use_policy=excluded.use_policy,citation=excluded.citation,active=true;

with src as (select id from public.catalog_sources where code='natura_uy_editorial'), content(taxon_rank,class_name,taxon_name,simple_name,description) as (values
  ('phylum','','Chordata','Vertebrados','Animales con notocorda en alguna etapa de su desarrollo. En el catálogo actual incluye peces, anfibios, reptiles, aves y mamíferos.'),
  ('class','Mammalia','Mammalia','Mamíferos','Vertebrados que poseen pelo y cuyas hembras producen leche para alimentar a sus crías. Presentan formas terrestres, acuáticas y voladoras.'),
  ('class','Reptilia','Reptilia','Reptiles','Vertebrados ectotermos de piel queratinizada. Incluye tortugas, lagartos, serpientes y yacarés presentes en Uruguay.'),
  ('class','Amphibia','Amphibia','Anfibios','Vertebrados ectotermos de piel permeable, generalmente vinculados al agua durante la reproducción y con metamorfosis durante su desarrollo.'),
  ('order','Mammalia','Artiodactyla','Ciervos y pecaríes','Mamíferos ungulados cuyo peso se apoya principalmente en un número par de dedos; incluye ciervos y pecaríes.'),
  ('order','Mammalia','Carnivora','Zorros, felinos y parientes','Mamíferos con dentición y sentidos adaptados a obtener alimento animal, aunque algunas especies también consumen frutos y otros recursos.'),
  ('order','Mammalia','Cetacea','Ballenas y delfines','Mamíferos completamente acuáticos, de cuerpo hidrodinámico, aletas anteriores y respiración pulmonar.'),
  ('order','Mammalia','Chiroptera','Murciélagos','Únicos mamíferos capaces de vuelo sostenido, con las manos transformadas en alas membranosas.'),
  ('order','Mammalia','Cingulata','Mulitas y tatúes','Mamíferos con placas óseas cubiertas por escudos córneos que forman una armadura flexible sobre el cuerpo.'),
  ('order','Mammalia','Didelphimorphia','Comadrejas marsupiales','Marsupiales americanos cuyas crías nacen muy poco desarrolladas y completan gran parte de su crecimiento junto a la madre.'),
  ('order','Mammalia','Lagomorpha','Liebres y conejos','Mamíferos herbívoros con dos pares de incisivos superiores y patas posteriores generalmente adaptadas al salto.'),
  ('order','Mammalia','Pilosa','Osos hormigueros','Mamíferos de dentición reducida o ausente; en Uruguay está representado por osos hormigueros y tamanduás.'),
  ('order','Mammalia','Rodentia','Roedores','Mamíferos con un par de incisivos de crecimiento continuo en cada mandíbula, adaptados para roer.'),
  ('order','Reptilia','Crocodylia','Yacarés','Reptiles semiacuáticos de cuerpo robusto, hocico alargado y cuidado parental desarrollado.'),
  ('order','Reptilia','Squamata','Lagartos y serpientes','El orden más diverso de reptiles, caracterizado por escamas y una mandíbula con gran movilidad.'),
  ('order','Reptilia','Testudines','Tortugas','Reptiles cuyo tronco está protegido por un caparazón óseo formado por espaldar y plastrón.'),
  ('order','Amphibia','Anura','Ranas y sapos','Anfibios adultos sin cola, con patas posteriores generalmente adaptadas al salto y larvas acuáticas llamadas renacuajos.'),
  ('order','Amphibia','Gymnophiona','Anfibios sin patas','Anfibios alargados y sin patas, conocidos como cecilias y adaptados principalmente a vivir bajo tierra o entre sustratos húmedos.')
)
insert into public.taxon_content(taxon_rank,class_name,taxon_name,simple_name,description,source_id,source_record_id)
select content.taxon_rank,content.class_name,content.taxon_name,content.simple_name,content.description,src.id,'simple-names-v1'
from content cross join src
on conflict(taxon_rank,class_name,taxon_name,language) do update set
  simple_name=excluded.simple_name,description=excluded.description,source_id=excluded.source_id,
  source_record_id=excluded.source_record_id,active=true,updated_at=now();

with facts(id,scientific_name,body,source_code,source_record_id,sort_order) as (values
  ('214e61c9-8726-5075-8f01-89d253788e24'::uuid,'Molothrus bonariensis','Practica parasitismo de cría: la hembra deposita sus huevos en nidos de otras aves, que luego pueden incubarlos y alimentar a los pichones.','animal_diversity_web','Molothrus bonariensis',0),
  ('c4cf29de-94b8-5d81-aab0-bab098afd009'::uuid,'Furnarius rufus','La pareja construye un nido cerrado principalmente con barro y coordina buena parte de sus cantos en dúos que ayudan a defender el territorio común.','journal_of_avian_biology','10.1111/jav.01637',0),
  ('f5b50672-d2ba-50e0-bad2-2bd718962650'::uuid,'Rhea americana','El macho incuba los huevos del nido comunal y, después de la eclosión, protege y guía a los charabones durante varios meses.','the_auk','10.1642/0004-8038(2003)120[0418:MPCIGR]2.0.CO;2',0),
  ('e06dc100-e7a6-5015-ae8e-753412e20cc2'::uuid,'Hydrochoerus hydrochaeris','Es el roedor viviente de mayor tamaño. Sus ojos, orejas y narinas ubicados en la parte alta de la cabeza favorecen su vida semiacuática.','usgs_nas','Hydrochoerus hydrochaeris',0),
  ('adf3743a-5663-5072-bb70-702836966a57'::uuid,'Dasypus hybridus','Presenta poliembrionía: un único embrión inicial se divide y puede originar una camada de varias crías genéticamente casi idénticas.','mammalian_species','10.1093/mspecies/sew001',0),
  ('d3628f8e-5437-5e71-a24f-4477cdd0cb88'::uuid,'Caiman latirostris','La hembra construye y vigila el nido, puede defenderlo frente a amenazas y hasta colaborar durante la eclosión de las crías.','global_ecology_conservation','10.1016/j.gecco.2026.e04088',0),
  ('ca99460e-3eb1-52e9-9d8e-e05bb3c7341e'::uuid,'Melanophryniscus montevidensis','Cuando se siente amenazado puede arquear el cuerpo y exhibir sus zonas amarillas y rojizas, una señal visual defensiva conocida como reflejo de Unken.','udelar_colibri','20.500.12008/17190',0),
  ('b87b71e1-e3f3-5962-b0cf-c6a0ec64820d'::uuid,'Ozotoceros bezoarticus','Posee varias glándulas de olor; estas señales químicas forman parte de la comunicación entre individuos y del reconocimiento de su entorno social.','mammalian_species','Ozotoceros bezoarticus scent glands',0)
)
insert into public.species_facts(id,species_id,body,source_id,source_record_id,sort_order,active)
select facts.id,species.id,facts.body,sources.id,facts.source_record_id,facts.sort_order,true
from facts join public.species species on lower(species.scientific_name)=lower(facts.scientific_name)
join public.catalog_sources sources on sources.code=facts.source_code
on conflict(id) do update set
  species_id=excluded.species_id,body=excluded.body,source_id=excluded.source_id,
  source_record_id=excluded.source_record_id,sort_order=excluded.sort_order,active=true,updated_at=now();

drop trigger if exists force_catalog_schema_9 on public.catalog_releases;
drop function if exists private.force_catalog_schema_9();
alter table public.catalog_releases alter column schema_version set default 10;
update public.catalog_releases set schema_version=10 where status in ('pending','building');
create or replace function private.force_catalog_schema_10() returns trigger language plpgsql set search_path='' as $$
begin new.schema_version:=10; return new; end $$;
create trigger force_catalog_schema_10 before insert on public.catalog_releases
for each row execute function private.force_catalog_schema_10();

revoke all on function private.submit_taxon_content_change(uuid,jsonb,text),private.review_taxon_content_change(uuid,boolean,boolean),private.force_catalog_schema_10() from public,anon;
grant execute on function private.submit_taxon_content_change(uuid,jsonb,text),private.review_taxon_content_change(uuid,boolean,boolean) to authenticated;
