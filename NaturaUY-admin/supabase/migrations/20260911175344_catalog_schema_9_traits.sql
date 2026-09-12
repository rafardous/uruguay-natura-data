-- Catálogo 9: rasgos biológicos estructurados, nombres comunes normalizados y
-- trazabilidad de la selección automática de imágenes.

alter table public.species add column traits jsonb not null default jsonb_build_object(
  'measurements','[]'::jsonb,'lifeModes','[]'::jsonb,'activity','[]'::jsonb,
  'aquaticEnvironments','[]'::jsonb,'waterZones','[]'::jsonb,
  'depthMinM',null,'depthMaxM',null,'sources','[]'::jsonb
);
alter table public.species add constraint species_traits_shape check (
  jsonb_typeof(traits)='object'
  and coalesce(jsonb_typeof(traits->'measurements')='array',false)
  and coalesce(jsonb_typeof(traits->'lifeModes')='array',false)
  and coalesce(jsonb_typeof(traits->'activity')='array',false)
  and coalesce(jsonb_typeof(traits->'aquaticEnvironments')='array',false)
  and coalesce(jsonb_typeof(traits->'waterZones')='array',false)
  and coalesce(jsonb_typeof(traits->'sources')='array',false)
  and traits ? 'depthMinM' and (traits->'depthMinM'='null'::jsonb or jsonb_typeof(traits->'depthMinM')='number')
  and traits ? 'depthMaxM' and (traits->'depthMaxM'='null'::jsonb or jsonb_typeof(traits->'depthMaxM')='number')
);

create or replace function private.normalize_species_names() returns trigger language plpgsql set search_path='' as $$
declare v_name text; v_key text; v_seen text[]; v_names text[]:='{}';
begin
  new.common_name:=regexp_replace(trim(new.common_name),'\s+',' ','g');
  v_seen:=array[lower(translate(new.common_name,chr(173)||chr(8203)||chr(65279),''))];
  foreach v_name in array coalesce(new.alternate_common_names,'{}') loop
    v_name:=regexp_replace(trim(v_name),'\s+',' ','g');
    v_key:=lower(translate(v_name,chr(173)||chr(8203)||chr(65279),''));
    if v_name<>'' and not v_key=any(v_seen) then v_names:=array_append(v_names,v_name); v_seen:=array_append(v_seen,v_key); end if;
  end loop;
  new.alternate_common_names:=v_names;
  return new;
end $$;
create trigger normalize_species_names before insert or update of common_name,alternate_common_names on public.species
for each row execute function private.normalize_species_names();

alter table public.species_media
  add column license_url text,
  add column external_id text,
  add column source_taxon_id text,
  add column source_width integer,
  add column source_height integer,
  add column selection_score numeric,
  add column selection_details jsonb,
  add column retrieved_at timestamptz;
create unique index species_media_external_image_unique on public.species_media(external_id)
  where type='image' and external_id is not null;

-- La RPC vigente conserva un diff de especie. Este trigger aplica traits sólo
-- cuando el cambio ya fue aprobado; nunca expone escritura directa al navegador.
create or replace function private.traits_legacy_size(p_traits jsonb) returns text language sql immutable set search_path='' as $$
  select nullif(string_agg(
    case item->>'kind'
      when 'body_length' then 'Largo corporal'
      when 'max_length' then 'Longitud máxima'
      when 'body_mass' then 'Masa'
      when 'wing_length' then 'Ala'
      when 'tail_length' then 'Cola'
      when 'tarsus_length' then 'Tarso'
      else item->>'kind'
    end || ': ' || (item->>'value') || ' ' || (item->>'unit'), ' · ' order by ordinal
  ),'') from jsonb_array_elements(coalesce(p_traits->'measurements','[]'::jsonb)) with ordinality as entries(item,ordinal)
$$;
create or replace function private.apply_approved_species_traits() returns trigger language plpgsql security definer set search_path='' as $$
declare v_after jsonb;
begin
  if old.status is distinct from 'approved' and new.status='approved' and new.species_id is not null and new.proposed_values?'traits' then
    if jsonb_typeof(new.proposed_values->'traits')<>'object' then raise exception 'invalid_species_traits'; end if;
    update public.species as s set traits=new.proposed_values->'traits',size=coalesce(private.traits_legacy_size(new.proposed_values->'traits'),s.size),updated_at=now() where s.id=new.species_id returning to_jsonb(s.*) into v_after;
    update public.species_changes set after_values=v_after where id=new.id;
  end if;
  return null;
end $$;
create trigger apply_approved_species_traits after update of status on public.species_changes
for each row execute function private.apply_approved_species_traits();

create or replace function private.triage_enrichment_candidate(p_candidate_id uuid,p_accept boolean,p_comment text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.require_editor(); v_candidate public.enrichment_candidates; v_species public.species; v_change_id uuid; v_patch jsonb; v_type text:='update';
begin
  select * into v_candidate from public.enrichment_candidates where id=p_candidate_id for update;
  if not found or v_candidate.status not in ('pending','conflict') then raise exception 'candidate_not_pending'; end if;
  if not p_accept then update public.enrichment_candidates set status='rejected',rationale=concat_ws(E'\n',rationale,nullif(trim(p_comment),'')) where id=p_candidate_id; return p_candidate_id; end if;
  if v_candidate.species_id is null then raise exception 'candidate_species_not_linked'; end if;
  select * into v_species from public.species where id=v_candidate.species_id for update;
  v_patch:=case v_candidate.field_path
    when 'taxonomy.order' then jsonb_build_object('order_name',v_candidate.proposed_value#>>'{}')
    when 'taxonomy.family' then jsonb_build_object('family',v_candidate.proposed_value#>>'{}')
    when 'taxonomy.genus' then jsonb_build_object('genus',v_candidate.proposed_value#>>'{}')
    when 'scientific_name' then jsonb_build_object('scientific_name',v_candidate.proposed_value#>>'{}')
    when 'common_name' then jsonb_build_object('common_name',v_candidate.proposed_value#>>'{}')
    when 'alternate_common_names' then jsonb_build_object('alternate_common_names',v_candidate.proposed_value)
    when 'habitat' then jsonb_build_object('habitat',v_candidate.proposed_value)
    when 'diet' then jsonb_build_object('diet',v_candidate.proposed_value)
    when 'traits' then jsonb_build_object('traits',v_candidate.proposed_value)
    else '{}'::jsonb end;
  if v_candidate.field_path='presence' and v_candidate.proposed_value#>>'{}'='exclude' then v_type:='archive';
  elsif v_patch='{}'::jsonb then raise exception 'candidate_field_not_promotable'; end if;
  insert into public.species_changes(species_id,change_type,proposed_values,base_updated_at,proposed_by,comment)
  values(v_species.id,v_type,v_patch,v_species.updated_at,v_actor,concat_ws(' · ',nullif(trim(p_comment),''),format('Candidato de enriquecimiento %s',v_candidate.id))) returning id into v_change_id;
  update public.enrichment_candidates set status='accepted' where id=p_candidate_id;
  return v_change_id;
end $$;

alter table public.catalog_releases alter column schema_version set default 9;
create or replace function private.force_catalog_schema_9() returns trigger language plpgsql set search_path='' as $$ begin new.schema_version:=9; return new; end $$;
create trigger force_catalog_schema_9 before insert on public.catalog_releases for each row execute function private.force_catalog_schema_9();

insert into public.catalog_sources(code,name,url,publisher,license,use_policy,citation) values
  ('avonet','AVONET','https://figshare.com/articles/dataset/16586228','AVONET authors','CC BY 4.0','redistributable','Tobias et al. 2022'),
  ('tetrapodtraits3','TetrapodTraits 3','https://zenodo.org/records/21815609','TetrapodTraits authors','CC BY 4.0','redistributable','TetrapodTraits 3.0'),
  ('amphibio','AmphiBIO','https://doi.org/10.6084/m9.figshare.4644424','AmphiBIO authors','CC BY 4.0','redistributable','Oliveira et al. 2017'),
  ('fishmorph','FISHMORPH','https://doi.org/10.14278/rodare.1316','FISHMORPH authors','CC BY 4.0','redistributable','FISHMORPH 1.1'),
  ('freshwater_fish_shortfalls','Global Freshwater Fish Knowledge Shortfalls','https://zenodo.org/records/19864169','Dataset authors','CC BY 4.0 (dataset agregado; atributos con procedencia mixta)','review_only','Global Freshwater Fish Knowledge Shortfalls'),
  ('mobs','MOBS','https://github.com/crmcclain/MOBS_OPEN','MOBS authors','Verificar archivo','review_only','Marine Organisms Body Size database'),
  ('combine','COMBINE','https://esajournals.onlinelibrary.wiley.com/doi/10.1002/ecy.3344','COMBINE authors','Procedencia por atributo a verificar','review_only','COMBINE mammal trait database')
on conflict(code) do update set name=excluded.name,url=excluded.url,publisher=excluded.publisher,license=excluded.license,use_policy=excluded.use_policy,citation=excluded.citation;

-- FishBase permanece deliberadamente fuera de los datos publicables.
update public.catalog_sources set license='CC BY-NC 3.0',use_policy='review_only' where code='fishbase';

-- Normaliza también los registros existentes y expone una cadena de búsqueda
-- que incluye los nombres alternativos sin crear otra entidad.
update public.species set alternate_common_names=alternate_common_names;
drop view public.species_editor;
create view public.species_editor with (security_invoker=true) as
select s.*,concat_ws(' ',s.common_name,array_to_string(s.alternate_common_names,' ')) as search_names,
  coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'type',m.type,'ordinal',m.ordinal,'is_primary',m.is_primary,'status',m.status,
    'storage_path',m.storage_path,'thumbnail_path',m.thumbnail_path,'author',m.author,
    'license',m.license,'source',m.source,'source_url',m.source_url,
    'license_url',m.license_url,'external_id',m.external_id,'source_taxon_id',m.source_taxon_id,
    'source_width',m.source_width,'source_height',m.source_height,'selection_score',m.selection_score,
    'selection_details',m.selection_details,'retrieved_at',m.retrieved_at
  ) order by case when m.status='approved' then 0 else 1 end,m.type,m.ordinal) filter(where m.id is not null),'[]'::jsonb) as media
from public.species s left join public.species_media m on m.species_id=s.id and (m.status='approved' or (m.status='archived' and m.type='image' and m.source_url is not null))
group by s.id;
grant select on public.species_editor to authenticated;

revoke all on function private.normalize_species_names(),private.traits_legacy_size(jsonb),private.apply_approved_species_traits(),private.force_catalog_schema_9() from public,anon,authenticated;
