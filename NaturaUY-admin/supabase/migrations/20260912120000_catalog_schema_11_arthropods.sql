-- Catálogo 11: biodiversidad no cordada, identificadores externos y una capa
-- opcional de historia natural específica. Los candidatos externos siguen
-- siendo sugerencias: la publicación continúa requiriendo revisión humana.

alter table public.species
  add column if not exists taxon_identifiers jsonb not null default '{}'::jsonb,
  add column if not exists natural_history jsonb not null default '{}'::jsonb,
  add column if not exists distribution_summary jsonb not null default '{}'::jsonb,
  add column if not exists subphylum text not null default '';

alter table public.species
  drop constraint if exists species_taxon_identifiers_shape,
  drop constraint if exists species_natural_history_shape,
  drop constraint if exists species_distribution_summary_shape;

alter table public.species
  add constraint species_taxon_identifiers_shape
    check (jsonb_typeof(taxon_identifiers) = 'object'),
  add constraint species_natural_history_shape
    check (jsonb_typeof(natural_history) = 'object'),
  add constraint species_distribution_summary_shape
    check (jsonb_typeof(distribution_summary) = 'object');

create index if not exists species_taxon_identifiers_gin_idx on public.species using gin (taxon_identifiers);
create index if not exists species_natural_history_gin_idx on public.species using gin (natural_history);

-- The old check predated the generic games. Keep existing keys and extend the
-- vocabulary used by the mobile classification and habitat games.
alter table public.species_game_rules drop constraint if exists species_game_rules_game_key_check;
alter table public.species_game_rules add constraint species_game_rules_game_key_check
  check (game_key in ('quiz','naming','puzzle','trivia','classify','habitat'));

-- Taxonomic content is not species content, but it travels through the same
-- review queue and therefore must be an allowed content type.
alter table public.content_changes drop constraint if exists content_changes_content_type_check;
alter table public.content_changes add constraint content_changes_content_type_check
  check (content_type in ('abundance','game_profile','game_rule','fact','trivia','taxon_content'));

-- Schema 10 only admitted phylum/class/order/family. The flexible tree and
-- the schema-11 content below also need the intermediate and terminal ranks.
alter table public.taxon_content drop constraint if exists taxon_content_taxon_rank_check;
alter table public.taxon_content add constraint taxon_content_taxon_rank_check
  check (taxon_rank in ('kingdom','phylum','subphylum','class','order','family','genus'));

-- The generic editor RPC already applies the legacy columns. This trigger
-- applies the additive schema-11 JSON fields after that RPC has recorded an
-- approved change, preserving the immutable species_changes audit trail.
create or replace function private.apply_approved_species_schema11_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_after jsonb;
begin
  if old.status is distinct from 'approved' and new.status = 'approved' and new.species_id is not null then
    if new.proposed_values ? 'taxon_identifiers' then
      if jsonb_typeof(new.proposed_values->'taxon_identifiers') <> 'object' then raise exception 'invalid_taxon_identifiers'; end if;
      update public.species set taxon_identifiers = new.proposed_values->'taxon_identifiers', updated_at = now() where id = new.species_id;
    end if;
    if new.proposed_values ? 'natural_history' then
      if jsonb_typeof(new.proposed_values->'natural_history') <> 'object' then raise exception 'invalid_natural_history'; end if;
      update public.species set natural_history = new.proposed_values->'natural_history', updated_at = now() where id = new.species_id;
    end if;
    if new.proposed_values ? 'distribution_summary' then
      if jsonb_typeof(new.proposed_values->'distribution_summary') <> 'object' then raise exception 'invalid_distribution_summary'; end if;
      update public.species set distribution_summary = new.proposed_values->'distribution_summary', updated_at = now() where id = new.species_id;
    end if;
    select to_jsonb(s) into v_after from public.species s where s.id = new.species_id;
    if v_after is not null then update public.species_changes set after_values = v_after where id = new.id; end if;
  end if;
  return null;
end $$;

drop trigger if exists apply_approved_species_schema11_fields on public.species_changes;
create trigger apply_approved_species_schema11_fields
after update of status on public.species_changes
for each row execute function private.apply_approved_species_schema11_fields();

-- Promote only the external identifiers that have an explicit schema-11
-- destination. BOLD remains identifier/coverage evidence and is intentionally
-- not promotable to public species data.
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
    when 'taxonIdentifiers.catalogueOfLife' then jsonb_build_object('taxon_identifiers',coalesce(v_species.taxon_identifiers,'{}'::jsonb)||jsonb_build_object('catalogueOfLife',v_candidate.proposed_value))
    when 'taxonIdentifiers.worms' then jsonb_build_object('taxon_identifiers',coalesce(v_species.taxon_identifiers,'{}'::jsonb)||jsonb_build_object('worms',v_candidate.proposed_value))
    else '{}'::jsonb end;
  if v_candidate.field_path='presence' and v_candidate.proposed_value#>>'{}'='exclude' then v_type:='archive';
  elsif v_patch='{}'::jsonb then raise exception 'candidate_field_not_promotable'; end if;
  insert into public.species_changes(species_id,change_type,proposed_values,base_updated_at,proposed_by,comment)
  values(v_species.id,v_type,v_patch,v_species.updated_at,v_actor,concat_ws(' · ',nullif(trim(p_comment),''),format('Candidato de enriquecimiento %s',v_candidate.id))) returning id into v_change_id;
  update public.enrichment_candidates set status='accepted' where id=p_candidate_id;
  return v_change_id;
end $$;

revoke all on function private.triage_enrichment_candidate(uuid,boolean,text) from public,anon;
grant execute on function private.triage_enrichment_candidate(uuid,boolean,text) to authenticated;

-- The source registry is intentionally explicit so a pipeline artifact can
-- be traced to the endpoint, release and usage policy that produced it.
insert into public.catalog_sources(code,name,url,publisher,license,use_policy,citation,version_label) values
  ('inaturalist','iNaturalist','https://api.inaturalist.org/v1/','iNaturalist Network','Per media; exact license code required','review_only','iNaturalist API','v1'),
  ('wikimedia','Wikimedia Commons','https://commons.wikimedia.org/w/api.php','Wikimedia Foundation','Per media; CC0 or CC BY 4.0 only','redistributable','MediaWiki Imageinfo API','MediaWiki API'),
  ('bold','BOLD Systems','https://www.boldsystems.org/data/api/','BOLD Systems','Identifier and metadata only','identifier_only','BOLD API',null),
  ('catalogue_of_life','Catalogue of Life','https://www.catalogueoflife.org/tools/api','Catalogue of Life','CC BY 4.0','redistributable','Catalogue of Life API',null),
  ('worms','WoRMS','https://www.marinespecies.org/aphia.php?p=webservice','WoRMS Editorial Board','CC BY 4.0','redistributable','WoRMS Webservice',null)
on conflict(code) do update set
  name=excluded.name,url=excluded.url,publisher=excluded.publisher,license=excluded.license,
  use_policy=excluded.use_policy,citation=excluded.citation,version_label=excluded.version_label,active=true;

with src as (select id from public.catalog_sources where code='natura_uy_editorial'), content(taxon_rank,class_name,taxon_name,simple_name,description) as (values
  ('phylum','','Arthropoda','Artrópodos','Animales invertebrados con exoesqueleto y apéndices articulados. En Uruguay incluye insectos, arácnidos y crustáceos.'),
  ('subphylum','','Chelicerata','Quelicerados','Artrópodos con quelíceros, como arañas y escorpiones; el catálogo uruguayo los representa principalmente mediante la clase Arachnida.'),
  ('subphylum','','Hexapoda','Hexápodos','Artrópodos con seis patas; en este catálogo el grupo está representado por la clase Insecta.'),
  ('subphylum','','Crustacea','Crustáceos','Artrópodos con apéndices especializados y frecuente adaptación a ambientes acuáticos; incluye la clase Malacostraca.'),
  ('class','Arachnida','Arachnida','Arácnidos','Artrópodos con ocho patas en la etapa adulta; incluye arañas, escorpiones, opiliones y otros grupos de importancia ecológica.'),
  ('class','Insecta','Insecta','Insectos','Artrópodos con seis patas y un cuerpo dividido en cabeza, tórax y abdomen; muchas especies atraviesan metamorfosis.'),
  ('class','Malacostraca','Malacostraca','Crustáceos','Crustáceos de cuerpo segmentado y apéndices especializados, presentes en ambientes marinos, salobres y de agua dulce.')
)
insert into public.taxon_content(taxon_rank,class_name,taxon_name,language,kingdom,phylum,simple_name,description,source_id,source_record_id,active)
select content.taxon_rank,content.class_name,content.taxon_name,'es-UY','Animalia','Arthropoda',content.simple_name,content.description,src.id,'arthropods-schema-11',true
from content cross join src
on conflict(taxon_rank,class_name,taxon_name,language) do update set
  phylum=excluded.phylum,simple_name=excluded.simple_name,description=excluded.description,
  source_id=excluded.source_id,source_record_id=excluded.source_record_id,active=true,updated_at=now();

-- Recreate the editor view after adding columns: s.* is expanded at view
-- creation time in PostgreSQL and would otherwise hide schema-11 fields.
drop view if exists public.species_editor;
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

drop trigger if exists force_catalog_schema_10 on public.catalog_releases;
drop function if exists private.force_catalog_schema_10();
alter table public.catalog_releases alter column schema_version set default 11;
update public.catalog_releases set schema_version=11 where status in ('pending','building');
create or replace function private.force_catalog_schema_11()
returns trigger language plpgsql set search_path='' as $$ begin new.schema_version:=11; return new; end $$;
create trigger force_catalog_schema_11 before insert on public.catalog_releases
for each row execute function private.force_catalog_schema_11();

revoke all on function private.apply_approved_species_schema11_fields(),private.force_catalog_schema_11() from public,anon,authenticated;

-- Flexible taxonomic tree. Legacy species columns remain denormalized for the
-- mobile contract; these nodes carry subphyla and any later rank without a
-- migration per new biological group.
create table if not exists public.taxa (
  taxon_id text primary key,
  parent_id text references public.taxa(taxon_id) on delete restrict,
  rank text not null check (rank ~ '^[a-z][a-z_]{1,31}$'),
  canonical_name text not null check (length(trim(canonical_name)) between 2 and 160),
  simple_name text,
  description text not null default '',
  identifiers jsonb not null default '{}'::jsonb check (jsonb_typeof(identifiers)='object'),
  source_ids uuid[] not null default '{}',
  sort_order integer not null default 0,
  unique(parent_id,rank,canonical_name)
);
create index if not exists taxa_parent_sort_idx on public.taxa(parent_id,sort_order,canonical_name);
create index if not exists taxa_rank_name_idx on public.taxa(rank,canonical_name);
create table if not exists public.species_taxa (
  species_id uuid not null references public.species(id) on delete restrict,
  taxon_id text not null references public.taxa(taxon_id) on delete restrict,
  is_primary boolean not null default true,
  primary key(species_id,taxon_id)
);
create index if not exists species_taxa_taxon_idx on public.species_taxa(taxon_id,species_id);
alter table public.taxa enable row level security;
alter table public.species_taxa enable row level security;
drop policy if exists taxa_editor_read on public.taxa;
create policy taxa_editor_read on public.taxa for select to authenticated using(public.has_editor_access());
drop policy if exists species_taxa_editor_read on public.species_taxa;
create policy species_taxa_editor_read on public.species_taxa for select to authenticated using(public.has_editor_access());
revoke all on public.taxa,public.species_taxa from anon,authenticated;
grant select on public.taxa,public.species_taxa to authenticated;

insert into public.taxa(taxon_id,parent_id,rank,canonical_name,simple_name,description,sort_order) values
  ('taxon-root-phylum-arthropoda',null,'phylum','Arthropoda','Artrópodos','Animales invertebrados con exoesqueleto y apéndices articulados.',0),
  ('taxon-taxon-root-phylum-arthropoda-subphylum-chelicerata','taxon-root-phylum-arthropoda','subphylum','Chelicerata','Quelicerados','Artrópodos con quelíceros, como arañas y escorpiones.',0),
  ('taxon-taxon-root-phylum-arthropoda-subphylum-hexapoda','taxon-root-phylum-arthropoda','subphylum','Hexapoda','Hexápodos','Artrópodos con seis patas; incluye a los insectos.',1),
  ('taxon-taxon-root-phylum-arthropoda-subphylum-crustacea','taxon-root-phylum-arthropoda','subphylum','Crustacea','Crustáceos','Artrópodos principalmente acuáticos o de ambientes húmedos.',2)
on conflict(taxon_id) do update set parent_id=excluded.parent_id,rank=excluded.rank,canonical_name=excluded.canonical_name,simple_name=excluded.simple_name,description=excluded.description,sort_order=excluded.sort_order;

insert into public.catalog_sources(code,name,url,publisher,license,use_policy,citation) values
  ('udelar_spider_collection','Colección de arañas de Facultad de Ciencias, UdelaR','https://doi.org/10.15468/u6fa5g','Universidad de la República','CC BY 4.0','redistributable','GBIF dataset u6fa5g'),
  ('uruguay_hymenoptera_parasitoids','Parasitoides de Uruguay','https://doi.org/10.15468/mu3rcs','Biodiversidata','CC BY 4.0','redistributable','GBIF dataset mu3rcs'),
  ('rocha_temporary_pools','Metacomunidad de charcos temporales de Rocha','https://doi.org/10.15468/s7yrey','Biodiversidata','CC BY 4.0','redistributable','GBIF dataset s7yrey'),
  ('ecoregistros_insectos_uruguay','EcoRegistros: insectos de Uruguay','https://www.ecoregistros.org/site/pais.php?id=55&idgrupoclase=2&page=2','EcoRegistros','Restricted','review_only','Consulta editorial; no redistribución')
on conflict(code) do update set name=excluded.name,url=excluded.url,publisher=excluded.publisher,license=excluded.license,use_policy=excluded.use_policy,citation=excluded.citation,active=true;

-- Existing mobile clients store scope:level keys (for example insects:easy).
-- Accept all ten public scopes and retain the old six for backwards
-- compatibility; the function still authenticates before writing.
alter table public.mobile_puzzle_records drop constraint if exists mobile_puzzle_records_scope_check;
alter table public.mobile_puzzle_records add constraint mobile_puzzle_records_scope_check
  check (scope ~ '^(animals_all|birds|mammals|reptiles|amphibians|fish|arthropods|arachnids|insects|crustaceans)(:(easy|medium|hard))?$');
create or replace function public.sync_puzzle_records(p_records jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare item jsonb; accepted integer := 0; uid uuid := auth.uid(); scope_value text; grid_value integer; time_value integer; moves_value integer; played_value bigint; updated_value bigint;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) > 24 then raise exception 'invalid records'; end if;
  for item in select * from jsonb_array_elements(p_records) loop
    scope_value := item->>'scope'; grid_value := (item->>'gridSize')::integer; time_value := (item->>'bestTimeMs')::integer; moves_value := (item->>'fewestMoves')::integer; played_value := (item->>'playedAt')::bigint; updated_value := (item->>'updatedAt')::bigint;
    if scope_value !~ '^(animals_all|birds|mammals|reptiles|amphibians|fish|arthropods|arachnids|insects|crustaceans)(:(easy|medium|hard))?$' or grid_value not in (3,4) or time_value <= 0 or moves_value <= 0 or played_value <= 0 or updated_value <= 0 then raise exception 'invalid puzzle record'; end if;
    insert into public.mobile_puzzle_records(user_id,scope,grid_size,best_time_ms,fewest_moves,played_at,updated_at) values(uid,scope_value,grid_value,time_value,moves_value,played_value,updated_value)
    on conflict(user_id,scope,grid_size) do update set best_time_ms=least(mobile_puzzle_records.best_time_ms,excluded.best_time_ms), fewest_moves=least(mobile_puzzle_records.fewest_moves,excluded.fewest_moves), played_at=greatest(mobile_puzzle_records.played_at,excluded.played_at), updated_at=greatest(mobile_puzzle_records.updated_at,excluded.updated_at);
    accepted := accepted + 1;
  end loop;
  return jsonb_build_object('accepted', accepted);
end $$;
revoke all on function public.sync_puzzle_records(jsonb) from public,anon;
grant execute on function public.sync_puzzle_records(jsonb) to authenticated;
