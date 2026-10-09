-- Catálogo schema 14: presencia, mediciones, ecología y conservación normalizada.

insert into public.catalog_sources(code,name,license,use_policy,citation,version_label)
values
  ('legacy_catalog','Catálogo histórico Natura UY','Pendiente de ratificación','review_only','Snapshot interno anterior a AVONET; no atribuir sus largos corporales a AVONET.','pre-AVONET'),
  ('iucn_red_list','IUCN Red List of Threatened Species','IUCN terms','identifier_only','IUCN Red List API v4; token sólo en entorno local/CI.','v4')
on conflict(code) do update set name=excluded.name,license=excluded.license,use_policy=excluded.use_policy,citation=excluded.citation,version_label=excluded.version_label,active=true;

alter table public.species
  add column if not exists measurements jsonb not null default '[]'::jsonb,
  add column if not exists ecology jsonb not null default '{"habitats":[],"diet":[],"lifeModes":[],"activity":[],"aquaticEnvironments":[],"waterZones":[],"depthMinM":null,"depthMaxM":null,"microhabitats":[],"trophicRoles":[],"hosts":[],"plantAssociations":[],"vegetationFormations":[]}'::jsonb;

alter table public.species
  add constraint species_measurements_array check (jsonb_typeof(measurements)='array'),
  add constraint species_ecology_object check (jsonb_typeof(ecology)='object');

create or replace function private.species_measurements_valid(p_measurements jsonb)
returns boolean language sql immutable set search_path='' as $$
  select jsonb_typeof(p_measurements)='array' and not exists (
    select 1 from jsonb_array_elements(p_measurements) measurement
    where measurement->>'kind' not in ('body_length','max_length','body_mass','wing_length','tail_length','tarsus_length')
       or jsonb_typeof(measurement->'value')<>'number'
       or measurement->>'unit' not in ('mm','g')
       or not (measurement ? 'basis')
       or coalesce(measurement->>'basis','') not in ('','body_length','TL','SL','FL','SVL')
       or jsonb_typeof(measurement->'estimated')<>'boolean'
       or nullif(trim(measurement->>'sourceCode'),'') is null
       or not (measurement ? 'sourceRecordId')
       or measurement->>'provenance' not in ('verified','legacy_unverified')
  )
$$;

alter table public.species add constraint species_measurements_items
  check (private.species_measurements_valid(measurements));

-- Conserva las mediciones estructuradas existentes, agregando procedencia por
-- ítem. Los largos históricos de las 475 aves entran por el import reproducible
-- del snapshot data/raw/legacy/bird-body-lengths.json.
update public.species s
set measurements=coalesce((
  select jsonb_agg(
    measurement || jsonb_build_object(
      'sourceCode',coalesce(nullif(measurement->>'sourceCode',''),s.traits->'sources'->>0,'legacy_catalog'),
      'sourceRecordId',measurement->'sourceRecordId',
      'provenance',coalesce(nullif(measurement->>'provenance',''),case when coalesce(nullif(measurement->>'sourceCode',''),s.traits->'sources'->>0) is null then 'legacy_unverified' else 'verified' end)
    )
  ) from jsonb_array_elements(coalesce(s.traits->'measurements','[]'::jsonb)) measurement
),'[]'::jsonb)
where jsonb_typeof(s.traits)='object';

create or replace function private.jsonb_unique_text_array(p_values jsonb)
returns jsonb language sql immutable set search_path='' as $$
  select coalesce(jsonb_agg(value order by first_position),'[]'::jsonb)
  from (
    select value,min(position) as first_position
    from jsonb_array_elements_text(case when jsonb_typeof(p_values)='array' then p_values else '[]'::jsonb end) with ordinality as item(value,position)
    where nullif(trim(value),'') is not null
    group by value
  ) unique_values
$$;

update public.species s set ecology=jsonb_build_object(
  'habitats',private.jsonb_unique_text_array(to_jsonb(s.habitat)),
  'diet',private.jsonb_unique_text_array(to_jsonb(s.diet)),
  'lifeModes',private.jsonb_unique_text_array(coalesce(s.traits->'lifeModes','[]'::jsonb)),
  'activity',private.jsonb_unique_text_array(coalesce(s.traits->'activity','[]'::jsonb) || coalesce(s.natural_history#>'{arthropod,ecology,activity}','[]'::jsonb)),
  'aquaticEnvironments',private.jsonb_unique_text_array(coalesce(s.traits->'aquaticEnvironments','[]'::jsonb)),
  'waterZones',private.jsonb_unique_text_array(coalesce(s.traits->'waterZones','[]'::jsonb)),
  'depthMinM',coalesce(s.traits->'depthMinM','null'::jsonb),
  'depthMaxM',coalesce(s.traits->'depthMaxM','null'::jsonb),
  'microhabitats',private.jsonb_unique_text_array(coalesce(s.natural_history#>'{arthropod,ecology,microhabitat}','[]'::jsonb)),
  'trophicRoles',private.jsonb_unique_text_array(coalesce(s.natural_history#>'{arthropod,ecology,trophicRole}','[]'::jsonb)),
  'hosts',private.jsonb_unique_text_array(coalesce(s.natural_history#>'{arthropod,ecology,hosts}','[]'::jsonb)),
  'plantAssociations',private.jsonb_unique_text_array(coalesce(s.natural_history#>'{arthropod,ecology,plantAssociations}','[]'::jsonb)),
  'vegetationFormations',private.jsonb_unique_text_array(coalesce(s.natural_history#>'{plant,vegetationFormations}','[]'::jsonb))
);

drop function private.jsonb_unique_text_array(jsonb);

update public.species
set natural_history=(natural_history #- '{arthropod,ecology}') #- '{plant,vegetationFormations}'
where jsonb_typeof(natural_history)='object';

-- Abundancia experta única. Observabilidad permanece en su tabla y no toca
-- esta columna.
update public.species s set
  abundance_status=case a.category
    when 'abundant' then 'abundant' when 'common' then 'common'
    when 'uncommon' then 'uncommon' when 'rare' then 'scarce'
    when 'very_rare' then 'scarce' else null end,
  field_sources=jsonb_set(coalesce(s.field_sources,'{}'::jsonb),'{abundance_status}',jsonb_build_array(
    concat(src.code,case when nullif(a.source_record_id,'') is not null then ': '||a.source_record_id else '' end)
  ),true)
from public.species_abundance_assessments a join public.catalog_sources src on src.id=a.source_id
where a.species_id=s.id and a.is_current;
update public.species set abundance_status=null where kingdom='Plantae';
update public.species set abundance_status=case lower(coalesce(abundance_status,''))
  when 'abundant' then 'abundant' when 'common' then 'common' when 'uncommon' then 'uncommon'
  when 'rare' then 'scarce' when 'very_rare' then 'scarce' when 'scarce' then 'scarce'
  when 'occasional' then 'occasional' else null end;
update public.species set abundance_status=null where abundance_status is not null and not (field_sources?'abundance_status');
alter table public.species drop constraint if exists species_abundance_status_check;
alter table public.species add constraint species_abundance_status_check
  check(abundance_status is null or abundance_status in ('abundant','common','uncommon','scarce','occasional'));
alter table public.species add constraint species_abundance_source_required
  check(abundance_status is null or field_sources?'abundance_status');

create table public.species_conservation_assessments (
  id uuid primary key default gen_random_uuid(),
  species_id uuid not null references public.species(id) on delete restrict,
  system text not null check(system in ('uy_red_list','iucn_global','uy_designations')),
  category text,
  designations text[] not null default '{}',
  source_id uuid not null references public.catalog_sources(id) on delete restrict,
  source_record_id text,
  version_label text,
  assessed_at date,
  is_current boolean not null default true,
  created_by uuid references public.profiles(user_id) on delete set null,
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  check(
    (system='uy_red_list' and category in ('DD','LC','NT','VU','EN','CR','RE') and cardinality(designations)=0)
    or (system='iucn_global' and category in ('DD','LC','NT','VU','EN','CR','EW','EX') and cardinality(designations)=0)
    or (system='uy_designations' and category is null and designations <@ array['priority','threatened','snap']::text[])
  )
);
create unique index species_conservation_one_current_idx on public.species_conservation_assessments(species_id,system) where is_current;
create index species_conservation_species_idx on public.species_conservation_assessments(species_id,system);

with legacy_source as (select id from public.catalog_sources where code='legacy_catalog'),
legacy as (
  select id,
    array_remove(array[
      case when upper(coalesce(conservation_source,'')||' '||coalesce(conservation_label,'')) like '%PRIORITARIA%' and upper(coalesce(conservation_source,'')||' '||coalesce(conservation_label,'')) not like '%NO PRIORITARIA%' then 'priority' end,
      case when upper(coalesce(conservation_source,'')||' '||coalesce(conservation_label,'')) like '%AMENAZADA%' then 'threatened' end,
      case when upper(coalesce(conservation_source,'')||' '||coalesce(conservation_label,'')) like '%SNAP%' then 'snap' end
    ],null) designations
  from public.species
)
insert into public.species_conservation_assessments(species_id,system,designations,source_id,source_record_id,version_label)
select legacy.id,'uy_designations',legacy.designations,legacy_source.id,legacy.id::text,'pre-schema-14'
from legacy cross join legacy_source where cardinality(legacy.designations)>0
on conflict do nothing;

alter table public.species_conservation_assessments enable row level security;
create policy species_conservation_editor_read on public.species_conservation_assessments
for select to authenticated using(public.has_editor_access());
revoke all on public.species_conservation_assessments from anon,authenticated;
grant select on public.species_conservation_assessments to authenticated;

create or replace function private.apply_species_schema_14_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_conservation jsonb; v_source uuid; v_assessment jsonb; v_designations text[];
begin
  if old.status='pending' and new.status='approved' and new.species_id is not null then
    update public.species set
      measurements=case when new.proposed_values?'measurements' then new.proposed_values->'measurements' else measurements end,
      ecology=case when new.proposed_values?'ecology' then new.proposed_values->'ecology' else ecology end
    where id=new.species_id;
    if new.proposed_values?'conservation' then
      v_conservation:=new.proposed_values->'conservation';
      v_designations:=array(select jsonb_array_elements_text(coalesce(v_conservation->'nationalDesignations','[]'::jsonb)));
      select id into v_source from public.catalog_sources where code=coalesce(nullif(v_conservation#>>'{nationalRedList,sourceCode}',''),'legacy_catalog');
      update public.species_conservation_assessments set is_current=false where species_id=new.species_id and system='uy_red_list' and is_current;
      if nullif(v_conservation#>>'{nationalRedList,category}','') is not null then
        insert into public.species_conservation_assessments(species_id,system,category,source_id,version_label,assessed_at,reviewed_by)
        values(new.species_id,'uy_red_list',v_conservation#>>'{nationalRedList,category}',v_source,nullif(v_conservation#>>'{nationalRedList,version}',''),nullif(v_conservation#>>'{nationalRedList,assessedAt}','')::date,new.reviewed_by);
      end if;
      select id into v_source from public.catalog_sources where code=coalesce(nullif(v_conservation#>>'{iucnGlobal,sourceCode}',''),'iucn_red_list');
      update public.species_conservation_assessments set is_current=false where species_id=new.species_id and system='iucn_global' and is_current;
      if nullif(v_conservation#>>'{iucnGlobal,category}','') is not null then
        insert into public.species_conservation_assessments(species_id,system,category,source_id,version_label,assessed_at,reviewed_by)
        values(new.species_id,'iucn_global',v_conservation#>>'{iucnGlobal,category}',v_source,nullif(v_conservation#>>'{iucnGlobal,version}',''),nullif(v_conservation#>>'{iucnGlobal,assessedAt}','')::date,new.reviewed_by);
      end if;
      select id into v_source from public.catalog_sources where code='legacy_catalog';
      update public.species_conservation_assessments set is_current=false where species_id=new.species_id and system='uy_designations' and is_current;
      if cardinality(v_designations)>0 then
        insert into public.species_conservation_assessments(species_id,system,designations,source_id,reviewed_by)
        values(new.species_id,'uy_designations',v_designations,v_source,new.reviewed_by);
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function private.apply_species_schema_14_change() from public,anon,authenticated;
create trigger apply_species_schema_14_change after update of status on public.species_changes
for each row execute function private.apply_species_schema_14_change();

-- El editor schema 14 escribe exclusivamente el contrato nuevo. Esto permite
-- retirar físicamente las columnas y la tabla duplicada después de migrarlas.
create or replace function public.review_species_change(p_change_id uuid, p_approve boolean, p_confirm_self_validation boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=public.require_editor(); v_change public.species_changes; v_species public.species;
  v_before jsonb:='{}'::jsonb; v_species_id uuid; v_patch jsonb; v_sources jsonb;
begin
  select * into v_change from public.species_changes where id=p_change_id for update;
  if not found or v_change.status<>'pending' then raise exception 'change_not_pending'; end if;
  if v_change.proposed_by=v_actor and not p_confirm_self_validation then raise exception 'self_validation_confirmation_required'; end if;
  if not p_approve then
    update public.species_changes set status='rejected',reviewed_by=v_actor,reviewed_at=now(),self_validation_confirmed=p_confirm_self_validation where id=p_change_id;
    return coalesce(v_change.species_id,p_change_id);
  end if;
  v_patch:=v_change.proposed_values;
  if v_change.change_type='create' then
    v_sources:=coalesce(v_patch->'field_sources','{}'::jsonb);
    if nullif(v_patch->>'abundance_status','') is not null and not (v_sources?'abundance_status') then raise exception 'abundance_source_required'; end if;
    insert into public.species(
      catalog_code,scientific_name,accepted_name,common_name,alternate_common_names,kingdom,phylum,class,order_name,family,genus,
      taxon_identifiers,origin,seasonality,abundance_status,description,measurements,ecology,natural_history,relevant_note,field_sources,status
    ) values (
      trim(v_patch->>'catalog_code'),trim(v_patch->>'scientific_name'),nullif(trim(v_patch->>'accepted_name'),''),trim(v_patch->>'common_name'),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_patch->'alternate_common_names','[]'::jsonb))),'{}'),
      coalesce(nullif(trim(v_patch->>'kingdom'),''),'Animalia'),coalesce(v_patch->>'phylum',''),coalesce(v_patch->>'class',''),coalesce(v_patch->>'order_name',''),coalesce(v_patch->>'family',''),coalesce(v_patch->>'genus',''),
      coalesce(v_patch->'taxon_identifiers','{}'::jsonb),coalesce(v_patch->>'origin','unknown'),coalesce(v_patch->>'seasonality','unknown'),
      case when coalesce(v_patch->>'kingdom','Animalia')='Plantae' then null else nullif(v_patch->>'abundance_status','') end,
      coalesce(v_patch->>'description',''),coalesce(v_patch->'measurements','[]'::jsonb),coalesce(v_patch->'ecology','{}'::jsonb),coalesce(v_patch->'natural_history','{}'::jsonb),
      nullif(trim(v_patch->>'relevant_note'),''),v_sources,coalesce(v_patch->>'status','active')
    ) returning * into v_species;
    v_species_id:=v_species.id;
  else
    select * into v_species from public.species where id=v_change.species_id for update;
    if not found then raise exception 'species_not_found'; end if;
    if v_change.base_updated_at<>v_species.updated_at then raise exception 'species_change_conflict'; end if;
    v_before:=to_jsonb(v_species);
    v_sources:=case when v_patch?'field_sources' then v_patch->'field_sources' else v_species.field_sources end;
    if v_patch?'abundance_status' and nullif(v_patch->>'abundance_status','') is not null and not (v_sources?'abundance_status') then raise exception 'abundance_source_required'; end if;
    update public.species set
      scientific_name=case when v_patch?'scientific_name' then coalesce(nullif(trim(v_patch->>'scientific_name'),''),scientific_name) else scientific_name end,
      accepted_name=case when v_patch?'accepted_name' then nullif(trim(v_patch->>'accepted_name'),'') else accepted_name end,
      common_name=case when v_patch?'common_name' then coalesce(nullif(trim(v_patch->>'common_name'),''),common_name) else common_name end,
      alternate_common_names=case when v_patch?'alternate_common_names' then array(select jsonb_array_elements_text(coalesce(v_patch->'alternate_common_names','[]'::jsonb))) else alternate_common_names end,
      kingdom=case when v_patch?'kingdom' then v_patch->>'kingdom' else kingdom end,
      phylum=case when v_patch?'phylum' then v_patch->>'phylum' else phylum end,
      class=case when v_patch?'class' then v_patch->>'class' else class end,
      order_name=case when v_patch?'order_name' then v_patch->>'order_name' else order_name end,
      family=case when v_patch?'family' then v_patch->>'family' else family end,
      genus=case when v_patch?'genus' then v_patch->>'genus' else genus end,
      taxon_identifiers=case when v_patch?'taxon_identifiers' then v_patch->'taxon_identifiers' else taxon_identifiers end,
      origin=case when v_patch?'origin' then v_patch->>'origin' else origin end,
      seasonality=case when v_patch?'seasonality' then v_patch->>'seasonality' else seasonality end,
      abundance_status=case when coalesce(v_patch->>'kingdom',kingdom)='Plantae' then null when v_patch?'abundance_status' then nullif(v_patch->>'abundance_status','') else abundance_status end,
      description=case when v_patch?'description' then coalesce(v_patch->>'description','') else description end,
      measurements=case when v_patch?'measurements' then v_patch->'measurements' else measurements end,
      ecology=case when v_patch?'ecology' then v_patch->'ecology' else ecology end,
      natural_history=case when v_patch?'natural_history' then v_patch->'natural_history' else natural_history end,
      relevant_note=case when v_patch?'relevant_note' then nullif(trim(v_patch->>'relevant_note'),'') else relevant_note end,
      field_sources=v_sources,
      status=case when v_change.change_type='archive' then 'archived' when v_patch?'status' then v_patch->>'status' else status end,
      updated_at=now()
    where id=v_species.id returning * into v_species;
    v_species_id:=v_species.id;
  end if;
  if exists(select 1 from public.species_media where change_id=p_change_id and status not in ('ready','approved')) then raise exception 'media_not_ready'; end if;
  if (select count(*) from public.species_media where species_id=v_species_id and type='image' and status='approved')+(select count(*) from public.species_media where change_id=p_change_id and type='image')>2 then raise exception 'image_limit_exceeded'; end if;
  if (select count(*) from public.species_media where species_id=v_species_id and type='audio' and status='approved')+(select count(*) from public.species_media where change_id=p_change_id and type='audio')>1 then raise exception 'audio_limit_exceeded'; end if;
  update public.species_media set species_id=v_species_id,status='approved' where change_id=p_change_id and status='ready';
  update public.species_changes set status='approved',species_id=v_species_id,before_values=v_before,after_values=to_jsonb(v_species),reviewed_by=v_actor,reviewed_at=now(),self_validation_confirmed=p_confirm_self_validation where id=p_change_id;
  return v_species_id;
end $$;

drop trigger if exists apply_approved_species_traits on public.species_changes;
drop function if exists private.apply_approved_species_traits();
drop function if exists private.traits_legacy_size(jsonb);
drop trigger if exists apply_approved_species_schema11_fields on public.species_changes;
drop function if exists private.apply_approved_species_schema11_fields();

-- Abundancia se edita junto con la especie y su fuente. Las propuestas viejas
-- pendientes se rechazan antes de retirar el almacenamiento duplicado.
update public.content_changes set status='rejected',reviewed_at=now(),comment=concat_ws(E'\n',comment,'Retirada por migración schema 14: editar abundance_status en la ficha de especie.')
where content_type='abundance' and status='pending';
create or replace function private.submit_content_change(p_content_type text,p_entity_id uuid,p_species_id uuid,p_operation text,p_proposed_values jsonb,p_comment text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.require_editor(); v_id uuid;
begin
  if p_content_type not in ('game_profile','game_rule','fact','trivia','taxon_content') or p_operation not in ('upsert','archive') or jsonb_typeof(p_proposed_values)<>'object' then raise exception 'invalid_content_change'; end if;
  if p_species_id is not null and not exists(select 1 from public.species where id=p_species_id) then raise exception 'species_not_found'; end if;
  insert into public.content_changes(content_type,entity_id,species_id,operation,proposed_values,proposed_by,comment)
  values(p_content_type,p_entity_id,p_species_id,p_operation,p_proposed_values,v_actor,nullif(trim(p_comment),'')) returning id into v_id;
  return v_id;
end $$;

drop view if exists public.species_content_editor;
drop view if exists public.plant_species_editor;
drop view if exists public.species_editor;

create or replace function private.sync_plant_profile_from_species()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.kingdom is distinct from 'Plantae' then
    delete from public.plant_profiles where species_id=new.id;
    return new;
  end if;
  insert into public.plant_profiles(species_id,habit,life_form,nomenclatural_authorship,original_publication)
  values(new.id,nullif(new.natural_history#>>'{plant,habit}',''),nullif(new.natural_history#>>'{plant,lifeForm}',''),
    nullif(new.natural_history#>>'{plant,nomenclature,authorship}',''),nullif(new.natural_history#>>'{plant,nomenclature,publication}',''))
  on conflict(species_id) do update set habit=excluded.habit,life_form=excluded.life_form,
    nomenclatural_authorship=excluded.nomenclatural_authorship,original_publication=excluded.original_publication;
  return new;
end $$;

alter table public.species drop column establishment,drop column presence_certainty,drop column distribution_summary,
  drop column conservation_system,drop column conservation_category,drop column conservation_label,drop column conservation_source,
  drop column conservation_rank,drop column conservation_assessed_at,drop column habitat,drop column diet,drop column size,drop column traits;
alter table public.plant_profiles drop column vegetation_formations;
drop table public.species_abundance_assessments;

create view public.species_content_editor with (security_invoker=true) as
select s.id as species_id,to_jsonb(o) as observability,to_jsonb(g) as game_profile,
  coalesce((select jsonb_agg(to_jsonb(r) order by r.game_key) from public.species_game_rules r where r.species_id=s.id),'[]'::jsonb) as game_rules,
  coalesce((select jsonb_agg(to_jsonb(f) order by f.sort_order,f.created_at) from public.species_facts f where f.species_id=s.id and f.active),'[]'::jsonb) as facts
from public.species s
left join lateral (select * from public.species_observability_snapshots x where x.species_id=s.id order by x.generated_at desc limit 1) o on true
left join public.species_game_profiles g on g.species_id=s.id;
grant select on public.species_content_editor to authenticated;

create view public.species_editor with (security_invoker=true) as
select s.*,concat_ws(' ',s.common_name,array_to_string(s.alternate_common_names,' ')) as search_names,
  jsonb_build_object(
    'nationalRedList',(select jsonb_build_object('category',a.category,'sourceCode',src.code,'version',a.version_label,'assessedAt',a.assessed_at) from public.species_conservation_assessments a join public.catalog_sources src on src.id=a.source_id where a.species_id=s.id and a.system='uy_red_list' and a.is_current limit 1),
    'iucnGlobal',(select jsonb_build_object('category',a.category,'sourceCode',src.code,'version',a.version_label,'assessedAt',a.assessed_at) from public.species_conservation_assessments a join public.catalog_sources src on src.id=a.source_id where a.species_id=s.id and a.system='iucn_global' and a.is_current limit 1),
    'nationalDesignations',coalesce((select to_jsonb(a.designations) from public.species_conservation_assessments a where a.species_id=s.id and a.system='uy_designations' and a.is_current limit 1),'[]'::jsonb)
  ) as conservation,
  coalesce(jsonb_agg(jsonb_build_object('id',m.id,'type',m.type,'ordinal',m.ordinal,'is_primary',m.is_primary,'status',m.status,'storage_path',m.storage_path,'thumbnail_path',m.thumbnail_path,'author',m.author,'license',m.license,'source',m.source,'source_url',m.source_url,'license_url',m.license_url,'external_id',m.external_id,'source_taxon_id',m.source_taxon_id,'source_width',m.source_width,'source_height',m.source_height,'selection_score',m.selection_score,'selection_details',m.selection_details,'retrieved_at',m.retrieved_at) order by case when m.status='approved' then 0 else 1 end,m.type,m.ordinal) filter(where m.id is not null),'[]'::jsonb) as media
from public.species s left join public.species_media m on m.species_id=s.id and (m.status='approved' or (m.status='archived' and m.type='image' and m.source_url is not null))
group by s.id;
grant select on public.species_editor to authenticated;

create view public.plant_species_editor with (security_invoker=true) as
select s.*,p.habit,p.life_form,p.flowering_months,p.fruiting_months,p.nomenclatural_authorship,p.original_publication
from public.species s join public.plant_profiles p on p.species_id=s.id where s.kingdom='Plantae';
grant select on public.plant_species_editor to authenticated;

drop trigger if exists force_catalog_schema_13 on public.catalog_releases;
drop function if exists private.force_catalog_schema_13();
alter table public.catalog_releases alter column schema_version set default 14;
update public.catalog_releases set schema_version=14 where status in ('pending','building');
create function private.force_catalog_schema_14()
returns trigger language plpgsql set search_path='' as $$
begin new.schema_version:=14; return new; end $$;
create trigger force_catalog_schema_14 before insert or update on public.catalog_releases
for each row execute function private.force_catalog_schema_14();

-- Auditoría obligatoria: los conteos históricos deben conservarse exactamente.
do $$
declare p integer; t integer; sn integer;
begin
  select count(*) filter(where designations@>array['priority']),count(*) filter(where designations@>array['threatened']),count(*) filter(where designations@>array['snap'])
  into p,t,sn from public.species_conservation_assessments where system='uy_designations' and is_current;
  if p<>398 or t<>264 or sn<>170 then raise exception 'schema14_conservation_audit_failed: priority=%, threatened=%, snap=%',p,t,sn; end if;
end $$;
