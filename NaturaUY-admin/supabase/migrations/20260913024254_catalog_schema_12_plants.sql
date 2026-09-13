-- Schema 12: plantas vasculares y navegación taxonómica por reino.
-- Las columnas desnormalizadas de species se conservan para compatibilidad.

create table if not exists public.taxon_names (
  taxon_id text not null references public.taxa(taxon_id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 160),
  language text not null default 'la',
  name_type text not null check (name_type in ('canonical','simple','synonym','alternative_family')),
  source_id uuid references public.catalog_sources(id) on delete restrict,
  primary key (taxon_id,name,language,name_type)
);
create index if not exists taxon_names_search_idx on public.taxon_names(lower(name),language);

create table if not exists public.taxon_closure (
  ancestor_id text not null references public.taxa(taxon_id) on delete restrict,
  descendant_id text not null references public.taxa(taxon_id) on delete restrict,
  depth integer not null check (depth >= 0),
  primary key (ancestor_id,descendant_id)
);
create index if not exists taxon_closure_descendant_idx on public.taxon_closure(descendant_id,depth);

create table if not exists public.plant_profiles (
  species_id uuid primary key references public.species(id) on delete restrict,
  habit text,
  life_form text,
  vegetation_formations text[] not null default '{}',
  flowering_months smallint[] not null default '{}',
  fruiting_months smallint[] not null default '{}',
  nomenclatural_authorship text,
  original_publication text,
  source_ids uuid[] not null default '{}',
  check (flowering_months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]),
  check (fruiting_months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[])
);

alter table public.taxon_names enable row level security;
alter table public.taxon_closure enable row level security;
alter table public.plant_profiles enable row level security;
revoke all on table public.taxon_names,public.taxon_closure,public.plant_profiles from anon,authenticated;
grant select on table public.taxon_names,public.taxon_closure,public.plant_profiles to authenticated;
create policy taxon_names_editor_read on public.taxon_names for select to authenticated using (public.has_editor_access());
create policy taxon_closure_editor_read on public.taxon_closure for select to authenticated using (public.has_editor_access());
create policy plant_profiles_editor_read on public.plant_profiles for select to authenticated using (public.has_editor_access());

-- El panel sigue escribiendo una revisión mediante save_species. Este espejo
-- normalizado se actualiza desde natural_history dentro de la misma transacción,
-- sin abrir escrituras directas de plant_profiles al navegador.
create or replace function private.sync_plant_profile_from_species()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.kingdom is distinct from 'Plantae' then
    delete from public.plant_profiles where species_id=new.id;
    return new;
  end if;
  insert into public.plant_profiles(
    species_id,habit,life_form,vegetation_formations,nomenclatural_authorship,original_publication
  ) values (
    new.id,
    nullif(new.natural_history #>> '{plant,habit}',''),
    nullif(new.natural_history #>> '{plant,lifeForm}',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(new.natural_history #> '{plant,vegetationFormations}','[]'::jsonb))),'{}'::text[]),
    nullif(new.natural_history #>> '{plant,nomenclature,authorship}',''),
    nullif(new.natural_history #>> '{plant,nomenclature,publication}','')
  )
  on conflict(species_id) do update set
    habit=excluded.habit,
    life_form=excluded.life_form,
    vegetation_formations=excluded.vegetation_formations,
    nomenclatural_authorship=excluded.nomenclatural_authorship,
    original_publication=excluded.original_publication;
  return new;
end $$;
revoke all on function private.sync_plant_profile_from_species() from public,anon,authenticated;
create trigger sync_plant_profile_from_species
after insert or update of kingdom,natural_history on public.species
for each row execute function private.sync_plant_profile_from_species();

create or replace view public.plant_species_editor
with (security_invoker=true) as
select s.*,p.habit,p.life_form,p.vegetation_formations,p.flowering_months,p.fruiting_months,
  p.nomenclatural_authorship,p.original_publication
from public.species s join public.plant_profiles p on p.species_id=s.id
where s.kingdom='Plantae';
revoke all on public.plant_species_editor from anon,authenticated;
grant select on public.plant_species_editor to authenticated;

insert into public.catalog_sources(code,name,url,publisher,license,use_policy,citation) values
  ('flora_uruguaya','Flora Uruguaya Online — plantas vasculares','https://doi.org/10.5281/zenodo.18227013','Facultad de Agronomía, Universidad de la República','CC BY 4.0','redistributable','Catálogo de plantas vasculares v1.3, 2026-06-04'),
  ('world_flora_online','World Flora Online Plant List','https://doi.org/10.5281/zenodo.20782718','World Flora Online Consortium','CC0','redistributable','WFO Plant List 2026-06; consulta mediante ChecklistBank dataset 2004')
on conflict(code) do update set name=excluded.name,url=excluded.url,publisher=excluded.publisher,license=excluded.license,use_policy=excluded.use_policy,citation=excluded.citation,active=true;

drop trigger if exists force_catalog_schema_11 on public.catalog_releases;
drop function if exists private.force_catalog_schema_11();
alter table public.catalog_releases alter column schema_version set default 12;
update public.catalog_releases set schema_version=12 where status in ('pending','building');
create or replace function private.force_catalog_schema_12()
returns trigger language plpgsql set search_path='' as $$ begin new.schema_version:=12; return new; end $$;
create trigger force_catalog_schema_12 before insert on public.catalog_releases
for each row execute function private.force_catalog_schema_12();
revoke all on function private.force_catalog_schema_12() from public,anon,authenticated;

alter table public.mobile_puzzle_records drop constraint if exists mobile_puzzle_records_scope_check;
alter table public.mobile_puzzle_records add constraint mobile_puzzle_records_scope_check
  check (scope ~ '^(animals_all|birds|mammals|reptiles|amphibians|fish|arthropods|arachnids|insects|crustaceans|plants)(:(easy|medium|hard))?$');

create or replace function public.sync_puzzle_records(p_records jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare item jsonb; accepted integer := 0; uid uuid := auth.uid(); scope_value text; grid_value integer; time_value integer; moves_value integer; played_value bigint; updated_value bigint;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) > 60 then raise exception 'invalid records'; end if;
  for item in select * from jsonb_array_elements(p_records) loop
    scope_value := item->>'scope'; grid_value := (item->>'gridSize')::integer; time_value := (item->>'bestTimeMs')::integer; moves_value := (item->>'fewestMoves')::integer; played_value := (item->>'playedAt')::bigint; updated_value := (item->>'updatedAt')::bigint;
    if scope_value !~ '^(animals_all|birds|mammals|reptiles|amphibians|fish|arthropods|arachnids|insects|crustaceans|plants)(:(easy|medium|hard))?$' or grid_value not in (3,4) or time_value <= 0 or moves_value <= 0 or played_value <= 0 or updated_value <= 0 then raise exception 'invalid puzzle record'; end if;
    insert into public.mobile_puzzle_records(user_id,scope,grid_size,best_time_ms,fewest_moves,played_at,updated_at) values(uid,scope_value,grid_value,time_value,moves_value,played_value,updated_value)
    on conflict(user_id,scope,grid_size) do update set best_time_ms=least(mobile_puzzle_records.best_time_ms,excluded.best_time_ms),fewest_moves=least(mobile_puzzle_records.fewest_moves,excluded.fewest_moves),played_at=greatest(mobile_puzzle_records.played_at,excluded.played_at),updated_at=greatest(mobile_puzzle_records.updated_at,excluded.updated_at);
    accepted := accepted + 1;
  end loop;
  return jsonb_build_object('accepted',accepted);
end $$;
revoke all on function public.sync_puzzle_records(jsonb) from public,anon;
grant execute on function public.sync_puzzle_records(jsonb) to authenticated;
