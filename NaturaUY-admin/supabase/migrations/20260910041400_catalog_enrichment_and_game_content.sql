-- Catálogo enriquecido, contenido de juegos y trazabilidad editorial.
-- Todo contenido publicable entra por propuesta y requiere aprobación humana.

create schema if not exists private;

create table public.catalog_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  name text not null,
  url text,
  publisher text,
  license text not null,
  use_policy text not null check (use_policy in ('redistributable','review_only','identifier_only')),
  citation text,
  retrieved_at timestamptz,
  version_label text,
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  target_classes text[] not null,
  status text not null default 'running' check (status in ('running','completed','failed')),
  source_versions jsonb not null default '{}'::jsonb check (jsonb_typeof(source_versions) = 'object'),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references public.profiles(user_id) on delete set null
);

create table public.enrichment_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.enrichment_runs(id) on delete cascade,
  species_id uuid references public.species(id) on delete restrict,
  catalog_code text,
  scientific_name text not null,
  field_path text not null check (field_path ~ '^[a-z][a-z0-9_.]{1,79}$'),
  current_value jsonb,
  proposed_value jsonb,
  source_id uuid not null references public.catalog_sources(id) on delete restrict,
  source_record_id text,
  confidence numeric(4,3) check (confidence between 0 and 1),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','conflict','not_applicable')),
  rationale text,
  created_at timestamptz not null default now()
);

create table public.species_abundance_assessments (
  id uuid primary key default gen_random_uuid(),
  species_id uuid not null references public.species(id) on delete restrict,
  category text not null check (category in ('abundant','common','uncommon','rare','very_rare','unknown')),
  label text not null,
  geographic_scope text not null default 'Uruguay',
  season_scope text,
  methodology text,
  assessed_at date,
  source_id uuid not null references public.catalog_sources(id) on delete restrict,
  source_record_id text,
  is_current boolean not null default true,
  created_by uuid references public.profiles(user_id) on delete set null,
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index species_abundance_one_current_idx on public.species_abundance_assessments(species_id) where is_current;

create table public.species_observability_snapshots (
  id uuid primary key default gen_random_uuid(),
  species_id uuid not null references public.species(id) on delete restrict,
  method_version text not null,
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  occurrence_count integer not null check (occurrence_count >= 0),
  occupied_cells integer not null check (occupied_cells >= 0),
  years_observed integer not null check (years_observed >= 0),
  score numeric(6,3) not null check (score between 0 and 100),
  band text not null check (band in ('high','medium','low','insufficient_data')),
  comparison_class text not null,
  source_id uuid not null references public.catalog_sources(id) on delete restrict,
  generated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique(species_id, method_version, period_start, period_end)
);

create table public.species_game_profiles (
  species_id uuid primary key references public.species(id) on delete restrict,
  knowledge_level text not null default 'hard' check (knowledge_level in ('easy','medium','hard')),
  rationale text,
  source_basis text not null default 'editorial' check (source_basis in ('editorial','observability_assisted')),
  updated_by uuid references public.profiles(user_id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.species_game_rules (
  id uuid primary key default gen_random_uuid(),
  species_id uuid not null references public.species(id) on delete restrict,
  game_key text not null check (game_key in ('quiz','naming','puzzle','trivia')),
  enabled boolean not null default true,
  min_knowledge_level text check (min_knowledge_level in ('easy','medium','hard')),
  note text,
  updated_by uuid references public.profiles(user_id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(species_id, game_key)
);

create table public.species_facts (
  id uuid primary key default gen_random_uuid(),
  species_id uuid not null references public.species(id) on delete restrict,
  body text not null check (length(trim(body)) between 20 and 600),
  source_id uuid not null references public.catalog_sources(id) on delete restrict,
  source_record_id text,
  sort_order smallint not null default 0,
  active boolean not null default true,
  created_by uuid references public.profiles(user_id) on delete set null,
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trivia_questions (
  id uuid primary key default gen_random_uuid(),
  species_id uuid references public.species(id) on delete restrict,
  prompt text not null check (length(trim(prompt)) between 15 and 500),
  explanation text check (explanation is null or length(trim(explanation)) between 10 and 800),
  source_id uuid not null references public.catalog_sources(id) on delete restrict,
  source_record_id text,
  active boolean not null default true,
  created_by uuid references public.profiles(user_id) on delete set null,
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trivia_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.trivia_questions(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 300),
  is_correct boolean not null default false,
  sort_order smallint not null check (sort_order between 0 and 3),
  unique(question_id, sort_order)
);
create unique index trivia_one_correct_idx on public.trivia_options(question_id) where is_correct;

create table public.content_changes (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('abundance','game_profile','game_rule','fact','trivia')),
  entity_id uuid,
  species_id uuid references public.species(id) on delete restrict,
  operation text not null default 'upsert' check (operation in ('upsert','archive')),
  proposed_values jsonb not null check (jsonb_typeof(proposed_values) = 'object'),
  before_values jsonb not null default '{}'::jsonb,
  after_values jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  proposed_by uuid not null references public.profiles(user_id) on delete restrict,
  reviewed_by uuid references public.profiles(user_id) on delete restrict,
  comment text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  self_validation_confirmed boolean not null default false
);

create index enrichment_candidates_queue_idx on public.enrichment_candidates(status, field_path, created_at);
create index abundance_species_idx on public.species_abundance_assessments(species_id, assessed_at desc);
create index observability_species_idx on public.species_observability_snapshots(species_id, generated_at desc);
create index species_facts_species_idx on public.species_facts(species_id, active, sort_order);
create index trivia_questions_species_idx on public.trivia_questions(species_id, active);
create index content_changes_queue_idx on public.content_changes(status, created_at);

-- Corrige el contrato histórico: antes la aprobación descartaba taxonomía,
-- origen, estacionalidad, abundancia, conservación, hábitat, dieta y tamaño.
create or replace function public.review_species_change(p_change_id uuid, p_approve boolean, p_confirm_self_validation boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.require_editor(); v_change public.species_changes; v_species public.species;
  v_before jsonb := '{}'::jsonb; v_species_id uuid; v_patch jsonb;
begin
  select * into v_change from public.species_changes where id=p_change_id for update;
  if not found or v_change.status <> 'pending' then raise exception 'change_not_pending'; end if;
  if v_change.proposed_by=v_actor and not p_confirm_self_validation then raise exception 'self_validation_confirmation_required'; end if;
  if not p_approve then
    update public.species_changes set status='rejected',reviewed_by=v_actor,reviewed_at=now(),self_validation_confirmed=p_confirm_self_validation where id=p_change_id;
    return coalesce(v_change.species_id,p_change_id);
  end if;
  v_patch := v_change.proposed_values;
  if v_change.change_type='create' then
    insert into public.species(
      catalog_code,scientific_name,accepted_name,common_name,alternate_common_names,kingdom,phylum,class,order_name,family,genus,
      origin,establishment,seasonality,presence_certainty,abundance_status,conservation_system,conservation_category,
      conservation_label,conservation_source,conservation_rank,conservation_assessed_at,description,habitat,diet,size,relevant_note,field_sources,status
    ) values (
      trim(v_patch->>'catalog_code'),trim(v_patch->>'scientific_name'),nullif(trim(v_patch->>'accepted_name'),''),trim(v_patch->>'common_name'),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_patch->'alternate_common_names','[]'::jsonb))),'{}'),
      coalesce(nullif(trim(v_patch->>'kingdom'),''),'Animalia'),coalesce(v_patch->>'phylum',''),coalesce(v_patch->>'class',''),coalesce(v_patch->>'order_name',''),coalesce(v_patch->>'family',''),coalesce(v_patch->>'genus',''),
      coalesce(v_patch->>'origin','unknown'),coalesce(v_patch->>'establishment','uncertain'),coalesce(v_patch->>'seasonality','unknown'),coalesce(v_patch->>'presence_certainty','uncertain'),nullif(trim(v_patch->>'abundance_status'),''),
      nullif(trim(v_patch->>'conservation_system'),''),nullif(trim(v_patch->>'conservation_category'),''),nullif(trim(v_patch->>'conservation_label'),''),nullif(trim(v_patch->>'conservation_source'),''),coalesce((v_patch->>'conservation_rank')::smallint,0),nullif(v_patch->>'conservation_assessed_at','')::date,
      coalesce(v_patch->>'description',''),coalesce(array(select jsonb_array_elements_text(coalesce(v_patch->'habitat','[]'::jsonb))),'{}'),coalesce(array(select jsonb_array_elements_text(coalesce(v_patch->'diet','[]'::jsonb))),'{}'),nullif(trim(v_patch->>'size'),''),nullif(trim(v_patch->>'relevant_note'),''),coalesce(v_patch->'field_sources','{}'::jsonb),coalesce(v_patch->>'status','active')
    ) returning * into v_species;
    v_species_id:=v_species.id;
  else
    select * into v_species from public.species where id=v_change.species_id for update;
    if v_change.base_updated_at <> v_species.updated_at then raise exception 'species_change_conflict'; end if;
    v_before:=to_jsonb(v_species);
    update public.species set
      scientific_name=case when v_patch?'scientific_name' then coalesce(nullif(trim(v_patch->>'scientific_name'),''),scientific_name) else scientific_name end,
      accepted_name=case when v_patch?'accepted_name' then nullif(trim(v_patch->>'accepted_name'),'') else accepted_name end,
      common_name=case when v_patch?'common_name' then coalesce(nullif(trim(v_patch->>'common_name'),''),common_name) else common_name end,
      alternate_common_names=case when v_patch?'alternate_common_names' then array(select jsonb_array_elements_text(coalesce(v_patch->'alternate_common_names','[]'::jsonb))) else alternate_common_names end,
      kingdom=case when v_patch?'kingdom' then v_patch->>'kingdom' else kingdom end, phylum=case when v_patch?'phylum' then v_patch->>'phylum' else phylum end,
      class=case when v_patch?'class' then v_patch->>'class' else class end, order_name=case when v_patch?'order_name' then v_patch->>'order_name' else order_name end,
      family=case when v_patch?'family' then v_patch->>'family' else family end, genus=case when v_patch?'genus' then v_patch->>'genus' else genus end,
      origin=case when v_patch?'origin' then v_patch->>'origin' else origin end, establishment=case when v_patch?'establishment' then v_patch->>'establishment' else establishment end,
      seasonality=case when v_patch?'seasonality' then v_patch->>'seasonality' else seasonality end, presence_certainty=case when v_patch?'presence_certainty' then v_patch->>'presence_certainty' else presence_certainty end,
      abundance_status=case when v_patch?'abundance_status' then nullif(trim(v_patch->>'abundance_status'),'') else abundance_status end,
      conservation_system=case when v_patch?'conservation_system' then nullif(trim(v_patch->>'conservation_system'),'') else conservation_system end,
      conservation_category=case when v_patch?'conservation_category' then nullif(trim(v_patch->>'conservation_category'),'') else conservation_category end,
      conservation_label=case when v_patch?'conservation_label' then nullif(trim(v_patch->>'conservation_label'),'') else conservation_label end,
      conservation_source=case when v_patch?'conservation_source' then nullif(trim(v_patch->>'conservation_source'),'') else conservation_source end,
      conservation_rank=case when v_patch?'conservation_rank' then (v_patch->>'conservation_rank')::smallint else conservation_rank end,
      conservation_assessed_at=case when v_patch?'conservation_assessed_at' then nullif(v_patch->>'conservation_assessed_at','')::date else conservation_assessed_at end,
      description=case when v_patch?'description' then coalesce(v_patch->>'description','') else description end,
      habitat=case when v_patch?'habitat' then array(select jsonb_array_elements_text(coalesce(v_patch->'habitat','[]'::jsonb))) else habitat end,
      diet=case when v_patch?'diet' then array(select jsonb_array_elements_text(coalesce(v_patch->'diet','[]'::jsonb))) else diet end,
      size=case when v_patch?'size' then nullif(trim(v_patch->>'size'),'') else size end,
      relevant_note=case when v_patch?'relevant_note' then nullif(trim(v_patch->>'relevant_note'),'') else relevant_note end,
      field_sources=case when v_patch?'field_sources' then v_patch->'field_sources' else field_sources end,
      status=case when v_change.change_type='archive' then 'archived' when v_patch?'status' then v_patch->>'status' else status end,
      updated_at=now() where id=v_species.id returning * into v_species;
    v_species_id:=v_species.id;
  end if;
  if exists(select 1 from public.species_media where change_id=p_change_id and status not in ('ready','approved')) then raise exception 'media_not_ready'; end if;
  if (select count(*) from public.species_media where species_id=v_species_id and type='image' and status='approved') + (select count(*) from public.species_media where change_id=p_change_id and type='image') > 2 then raise exception 'image_limit_exceeded'; end if;
  if (select count(*) from public.species_media where species_id=v_species_id and type='audio' and status='approved') + (select count(*) from public.species_media where change_id=p_change_id and type='audio') > 1 then raise exception 'audio_limit_exceeded'; end if;
  update public.species_media set species_id=v_species_id,status='approved' where change_id=p_change_id and status='ready';
  update public.species_changes set status='approved',species_id=v_species_id,before_values=v_before,after_values=coalesce(to_jsonb(v_species),'{}'::jsonb),reviewed_by=v_actor,reviewed_at=now(),self_validation_confirmed=p_confirm_self_validation where id=p_change_id;
  return v_species_id;
end $$;

create or replace function private.submit_content_change(p_content_type text,p_entity_id uuid,p_species_id uuid,p_operation text,p_proposed_values jsonb,p_comment text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=public.require_editor(); v_id uuid;
begin
  if p_content_type not in ('abundance','game_profile','game_rule','fact','trivia') or p_operation not in ('upsert','archive') or jsonb_typeof(p_proposed_values)<>'object' then raise exception 'invalid_content_change'; end if;
  if p_species_id is not null and not exists(select 1 from public.species where id=p_species_id) then raise exception 'species_not_found'; end if;
  insert into public.content_changes(content_type,entity_id,species_id,operation,proposed_values,proposed_by,comment)
  values(p_content_type,p_entity_id,p_species_id,p_operation,p_proposed_values,v_actor,nullif(trim(p_comment),'')) returning id into v_id;
  return v_id;
end $$;

create or replace function public.submit_content_change(p_content_type text,p_entity_id uuid,p_species_id uuid,p_operation text,p_proposed_values jsonb,p_comment text default null)
returns uuid language sql security invoker set search_path = '' as $$
  select private.submit_content_change(p_content_type,p_entity_id,p_species_id,p_operation,p_proposed_values,p_comment)
$$;

create or replace function private.review_content_change(p_change_id uuid,p_approve boolean,p_confirm_self_validation boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=public.require_editor(); v_change public.content_changes; v_id uuid; v_before jsonb:='{}'::jsonb; v_options jsonb; v_option jsonb; v_correct integer;
begin
  select * into v_change from public.content_changes where id=p_change_id for update;
  if not found or v_change.status<>'pending' then raise exception 'change_not_pending'; end if;
  if v_change.proposed_by=v_actor and not p_confirm_self_validation then raise exception 'self_validation_confirmation_required'; end if;
  if not p_approve then update public.content_changes set status='rejected',reviewed_by=v_actor,reviewed_at=now(),self_validation_confirmed=p_confirm_self_validation where id=p_change_id; return p_change_id; end if;
  v_id:=coalesce(v_change.entity_id,gen_random_uuid());
  if v_change.content_type='abundance' then
    select to_jsonb(a) into v_before from public.species_abundance_assessments a where a.id=v_change.entity_id;
    update public.species_abundance_assessments set is_current=false where species_id=v_change.species_id and is_current;
    insert into public.species_abundance_assessments(id,species_id,category,label,geographic_scope,season_scope,methodology,assessed_at,source_id,source_record_id,is_current,created_by,reviewed_by)
    values(v_id,v_change.species_id,v_change.proposed_values->>'category',v_change.proposed_values->>'label',coalesce(v_change.proposed_values->>'geographic_scope','Uruguay'),nullif(v_change.proposed_values->>'season_scope',''),nullif(v_change.proposed_values->>'methodology',''),nullif(v_change.proposed_values->>'assessed_at','')::date,(v_change.proposed_values->>'source_id')::uuid,nullif(v_change.proposed_values->>'source_record_id',''),true,v_change.proposed_by,v_actor)
    on conflict(id) do update set category=excluded.category,label=excluded.label,geographic_scope=excluded.geographic_scope,season_scope=excluded.season_scope,methodology=excluded.methodology,assessed_at=excluded.assessed_at,source_id=excluded.source_id,source_record_id=excluded.source_record_id,is_current=true,reviewed_by=v_actor;
    update public.species set abundance_status=v_change.proposed_values->>'label',updated_at=now() where id=v_change.species_id;
  elsif v_change.content_type='game_profile' then
    select to_jsonb(g) into v_before from public.species_game_profiles g where g.species_id=v_change.species_id;
    insert into public.species_game_profiles(species_id,knowledge_level,rationale,source_basis,updated_by) values(v_change.species_id,v_change.proposed_values->>'knowledge_level',nullif(v_change.proposed_values->>'rationale',''),coalesce(v_change.proposed_values->>'source_basis','editorial'),v_actor)
    on conflict(species_id) do update set knowledge_level=excluded.knowledge_level,rationale=excluded.rationale,source_basis=excluded.source_basis,updated_by=v_actor,updated_at=now(); v_id:=v_change.species_id;
  elsif v_change.content_type='game_rule' then
    select to_jsonb(g) into v_before from public.species_game_rules g where g.id=v_change.entity_id;
    insert into public.species_game_rules(id,species_id,game_key,enabled,min_knowledge_level,note,updated_by) values(v_id,v_change.species_id,v_change.proposed_values->>'game_key',coalesce((v_change.proposed_values->>'enabled')::boolean,true),nullif(v_change.proposed_values->>'min_knowledge_level',''),nullif(v_change.proposed_values->>'note',''),v_actor)
    on conflict(species_id,game_key) do update set enabled=excluded.enabled,min_knowledge_level=excluded.min_knowledge_level,note=excluded.note,updated_by=v_actor,updated_at=now() returning id into v_id;
  elsif v_change.content_type='fact' then
    select to_jsonb(f) into v_before from public.species_facts f where f.id=v_change.entity_id;
    if v_change.operation='archive' then update public.species_facts set active=false,updated_at=now() where id=v_change.entity_id;
    else insert into public.species_facts(id,species_id,body,source_id,source_record_id,sort_order,active,created_by,reviewed_by) values(v_id,v_change.species_id,trim(v_change.proposed_values->>'body'),(v_change.proposed_values->>'source_id')::uuid,nullif(v_change.proposed_values->>'source_record_id',''),coalesce((v_change.proposed_values->>'sort_order')::smallint,0),true,v_change.proposed_by,v_actor)
    on conflict(id) do update set body=excluded.body,source_id=excluded.source_id,source_record_id=excluded.source_record_id,sort_order=excluded.sort_order,active=true,reviewed_by=v_actor,updated_at=now(); end if;
  elsif v_change.content_type='trivia' then
    select to_jsonb(q) into v_before from public.trivia_questions q where q.id=v_change.entity_id;
    if v_change.operation='archive' then update public.trivia_questions set active=false,updated_at=now() where id=v_change.entity_id;
    else
      v_options:=v_change.proposed_values->'options';
      if jsonb_typeof(v_options)<>'array' or jsonb_array_length(v_options)<>4 then raise exception 'trivia_requires_four_options'; end if;
      select count(*) into v_correct from jsonb_array_elements(v_options) o where coalesce((o->>'is_correct')::boolean,false);
      if v_correct<>1 then raise exception 'trivia_requires_one_correct_option'; end if;
      insert into public.trivia_questions(id,species_id,prompt,explanation,source_id,source_record_id,active,created_by,reviewed_by) values(v_id,v_change.species_id,trim(v_change.proposed_values->>'prompt'),nullif(trim(v_change.proposed_values->>'explanation'),''),(v_change.proposed_values->>'source_id')::uuid,nullif(v_change.proposed_values->>'source_record_id',''),true,v_change.proposed_by,v_actor)
      on conflict(id) do update set species_id=excluded.species_id,prompt=excluded.prompt,explanation=excluded.explanation,source_id=excluded.source_id,source_record_id=excluded.source_record_id,active=true,reviewed_by=v_actor,updated_at=now();
      delete from public.trivia_options where question_id=v_id;
      for v_option in select value from jsonb_array_elements(v_options) loop insert into public.trivia_options(question_id,body,is_correct,sort_order) values(v_id,trim(v_option->>'body'),coalesce((v_option->>'is_correct')::boolean,false),(v_option->>'sort_order')::smallint); end loop;
    end if;
  end if;
  update public.content_changes set entity_id=v_id,status='approved',before_values=coalesce(v_before,'{}'::jsonb),after_values=v_change.proposed_values,reviewed_by=v_actor,reviewed_at=now(),self_validation_confirmed=p_confirm_self_validation where id=p_change_id;
  return v_id;
end $$;

create or replace function public.review_content_change(p_change_id uuid,p_approve boolean,p_confirm_self_validation boolean default false)
returns uuid language sql security invoker set search_path = '' as $$
  select private.review_content_change(p_change_id,p_approve,p_confirm_self_validation)
$$;

create or replace function private.triage_enrichment_candidate(p_candidate_id uuid,p_accept boolean,p_comment text)
returns uuid language plpgsql security definer set search_path = '' as $$
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
    else '{}'::jsonb end;
  if v_candidate.field_path='presence' and v_candidate.proposed_value#>>'{}'='exclude' then v_type:='archive';
  elsif v_patch='{}'::jsonb then raise exception 'candidate_field_not_promotable'; end if;
  insert into public.species_changes(species_id,change_type,proposed_values,base_updated_at,proposed_by,comment)
  values(v_species.id,v_type,v_patch,v_species.updated_at,v_actor,concat_ws(' · ',nullif(trim(p_comment),''),format('Candidato de enriquecimiento %s',v_candidate.id))) returning id into v_change_id;
  update public.enrichment_candidates set status='accepted' where id=p_candidate_id;
  return v_change_id;
end $$;

create or replace function public.triage_enrichment_candidate(p_candidate_id uuid,p_accept boolean,p_comment text default null)
returns uuid language sql security invoker set search_path = '' as $$
  select private.triage_enrichment_candidate(p_candidate_id,p_accept,p_comment)
$$;

create or replace function public.request_catalog_publish() returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=public.require_admin(); v_id uuid; v_version bigint; v_last timestamptz;
begin
  select coalesce(max(published_at),'epoch'::timestamptz) into v_last from public.catalog_releases where status='published';
  if not exists(select 1 from public.species_changes c where c.status='approved' and c.reviewed_at>v_last)
     and not exists(select 1 from public.content_changes c where c.status='approved' and c.reviewed_at>v_last)
     and not exists(select 1 from public.species_observability_snapshots o where o.generated_at>v_last)
  then raise exception 'catalog_not_dirty'; end if;
  select id into v_id from public.catalog_releases where status in ('pending','building') order by requested_at desc limit 1; if v_id is not null then return v_id; end if;
  select coalesce(max(version),0)+1 into v_version from public.catalog_releases;
  insert into public.catalog_releases(version,schema_version,requested_by) values(v_version,7,v_actor) returning id into v_id; return v_id;
end $$;

alter table public.catalog_releases alter column schema_version set default 7;

alter table public.catalog_sources enable row level security;
alter table public.enrichment_runs enable row level security;
alter table public.enrichment_candidates enable row level security;
alter table public.species_abundance_assessments enable row level security;
alter table public.species_observability_snapshots enable row level security;
alter table public.species_game_profiles enable row level security;
alter table public.species_game_rules enable row level security;
alter table public.species_facts enable row level security;
alter table public.trivia_questions enable row level security;
alter table public.trivia_options enable row level security;
alter table public.content_changes enable row level security;

create policy catalog_sources_editor_read on public.catalog_sources for select to authenticated using(public.has_editor_access());
create policy enrichment_runs_editor_read on public.enrichment_runs for select to authenticated using(public.has_editor_access());
create policy enrichment_candidates_editor_read on public.enrichment_candidates for select to authenticated using(public.has_editor_access());
create policy abundance_editor_read on public.species_abundance_assessments for select to authenticated using(public.has_editor_access());
create policy observability_editor_read on public.species_observability_snapshots for select to authenticated using(public.has_editor_access());
create policy game_profiles_editor_read on public.species_game_profiles for select to authenticated using(public.has_editor_access());
create policy game_rules_editor_read on public.species_game_rules for select to authenticated using(public.has_editor_access());
create policy facts_editor_read on public.species_facts for select to authenticated using(public.has_editor_access());
create policy trivia_editor_read on public.trivia_questions for select to authenticated using(public.has_editor_access());
create policy trivia_options_editor_read on public.trivia_options for select to authenticated using(public.has_editor_access());
create policy content_changes_editor_read on public.content_changes for select to authenticated using(public.has_editor_access());

create or replace view public.content_review_queue with (security_invoker=true) as
select c.*,p.display_name as proposed_by_name,r.display_name as reviewed_by_name,s.catalog_code,s.scientific_name,s.common_name
from public.content_changes c join public.profiles p on p.user_id=c.proposed_by left join public.profiles r on r.user_id=c.reviewed_by left join public.species s on s.id=c.species_id;

create or replace view public.species_content_editor with (security_invoker=true) as
select s.id as species_id,
  to_jsonb(a) as abundance,
  to_jsonb(o) as observability,
  to_jsonb(g) as game_profile,
  coalesce((select jsonb_agg(to_jsonb(r) order by r.game_key) from public.species_game_rules r where r.species_id=s.id),'[]'::jsonb) as game_rules,
  coalesce((select jsonb_agg(to_jsonb(f) order by f.sort_order,f.created_at) from public.species_facts f where f.species_id=s.id and f.active),'[]'::jsonb) as facts
from public.species s
left join lateral (select * from public.species_abundance_assessments x where x.species_id=s.id and x.is_current limit 1) a on true
left join lateral (select * from public.species_observability_snapshots x where x.species_id=s.id order by x.generated_at desc limit 1) o on true
left join public.species_game_profiles g on g.species_id=s.id;

create or replace view public.dashboard_stats with (security_invoker=true) as select
  count(*) filter(where s.status='active')::integer as active_species,
  count(*) filter(where s.status='archived')::integer as archived_species,
  ((select count(*) from public.species_changes where status='pending') + (select count(*) from public.content_changes where status='pending'))::integer as pending_changes,
  count(*) filter(where exists(select 1 from public.species_media m where m.species_id=s.id and m.type='image' and m.status='approved'))::integer as with_image,
  count(*) filter(where exists(select 1 from public.species_media m where m.species_id=s.id and m.type='audio' and m.status='approved'))::integer as with_audio,
  (select count(*)::integer from public.species_media where status in ('reserved','processing','ready')) as pending_media,
  (exists(select 1 from public.species_changes c where c.status='approved' and c.reviewed_at>coalesce((select max(r.published_at) from public.catalog_releases r where r.status='published'),'epoch'::timestamptz))
   or exists(select 1 from public.content_changes c where c.status='approved' and c.reviewed_at>coalesce((select max(r.published_at) from public.catalog_releases r where r.status='published'),'epoch'::timestamptz))
   or exists(select 1 from public.species_observability_snapshots o where o.generated_at>coalesce((select max(r.published_at) from public.catalog_releases r where r.status='published'),'epoch'::timestamptz))) as dirty_changes,
  (select max(version) from public.catalog_releases where status='published') as last_release_version,
  (select max(published_at) from public.catalog_releases where status='published') as last_published_at
from public.species s;

revoke all on public.catalog_sources,public.enrichment_runs,public.enrichment_candidates,public.species_abundance_assessments,public.species_observability_snapshots,public.species_game_profiles,public.species_game_rules,public.species_facts,public.trivia_questions,public.trivia_options,public.content_changes from anon,authenticated;
grant select on public.catalog_sources,public.enrichment_runs,public.enrichment_candidates,public.species_abundance_assessments,public.species_observability_snapshots,public.species_game_profiles,public.species_game_rules,public.species_facts,public.trivia_questions,public.trivia_options,public.content_changes,public.content_review_queue,public.species_content_editor to authenticated;

grant usage on schema private to authenticated;
revoke all on function private.submit_content_change(text,uuid,uuid,text,jsonb,text),private.review_content_change(uuid,boolean,boolean),private.triage_enrichment_candidate(uuid,boolean,text) from public,anon;
grant execute on function private.submit_content_change(text,uuid,uuid,text,jsonb,text),private.review_content_change(uuid,boolean,boolean),private.triage_enrichment_candidate(uuid,boolean,text) to authenticated;
revoke execute on function public.submit_content_change(text,uuid,uuid,text,jsonb,text),public.review_content_change(uuid,boolean,boolean),public.triage_enrichment_candidate(uuid,boolean,text) from public,anon;
grant execute on function public.submit_content_change(text,uuid,uuid,text,jsonb,text),public.review_content_change(uuid,boolean,boolean),public.triage_enrichment_candidate(uuid,boolean,text),public.review_species_change(uuid,boolean,boolean),public.request_catalog_publish() to authenticated;

insert into public.catalog_sources(code,name,url,publisher,license,use_policy,citation) values
  ('sibuy','SIBUy','https://sibuy.ambiente.gub.uy/','Ministerio de Ambiente de Uruguay','Ver ficha del recurso','identifier_only','Sistema de Información de Biodiversidad de Uruguay'),
  ('biodiversidata','Biodiversidata','https://biodiversidata.org/','Consorcio Biodiversidata','Ver conjunto de datos','identifier_only','Consorcio de datos de biodiversidad del Uruguay'),
  ('lista_roja_uy','Lista Roja de Uruguay','https://www.ambiente.gub.uy/','Ministerio de Ambiente de Uruguay','Ver publicación','identifier_only','Listas Rojas nacionales'),
  ('dinara','DINARA','https://www.gub.uy/ministerio-ganaderia-agricultura-pesca/dinara','MGAP - DINARA','Ver publicación','identifier_only','Listas de peces de aguas continentales y marinas del Uruguay'),
  ('catalogue_of_life','Catalogue of Life','https://www.catalogueoflife.org/','Catalogue of Life','CC BY 4.0','redistributable','Catalogue of Life'),
  ('worms','World Register of Marine Species','https://www.marinespecies.org/','WoRMS Editorial Board','CC BY 4.0','redistributable','World Register of Marine Species'),
  ('gbif','GBIF','https://www.gbif.org/','GBIF Secretariat','CC BY 4.0','redistributable','GBIF occurrence and species services'),
  ('repttraits','ReptTraits','https://www.reptilesofecuador.com/reptile_database.html','ReptTraits authors','Ver publicación','review_only','ReptTraits database'),
  ('tetrapodtraits','TetrapodTraits','https://esajournals.onlinelibrary.wiley.com/doi/10.1002/ecy.2655','TetrapodTraits authors','Ver publicación','review_only','TetrapodTraits database'),
  ('fishbase','FishBase','https://www.fishbase.se/','FishBase','CC BY-NC','review_only','FishBase');
