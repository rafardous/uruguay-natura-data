-- Natura UY: cut over the still-empty experimental Supabase project to the
-- approved-current-state + change-request architecture.
--
-- This migration deliberately refuses to run after the initial catalogue or
-- mobile data has been imported. The repository and linked project were
-- inspected immediately before authoring it: only the bootstrap profile and
-- editor membership exist remotely.

do $$
begin
  if exists (select 1 from public.species)
    or exists (select 1 from public.species_revisions)
    or exists (select 1 from public.media_assets)
    or exists (select 1 from public.mobile_favorites)
    or exists (select 1 from public.mobile_quiz_records)
    or exists (select 1 from public.user_reports)
    or exists (select 1 from public.catalog_releases)
    or exists (select 1 from storage.objects where bucket_id='media-evidence')
  then
    raise exception 'target_schema_requires_empty_experimental_tables';
  end if;
end;
$$;

-- Remove contracts tied to full JSON snapshots before rebuilding the empty
-- catalogue tables. Auth identities, the bootstrap membership, invitations,
-- and the general audit log are preserved.
drop view if exists public.species_current cascade;
drop view if exists public.species_revision_history cascade;
drop view if exists public.media_queue cascade;
drop view if exists public.catalog_release_history cascade;
drop view if exists public.admin_profiles cascade;
drop view if exists public.dashboard_stats cascade;
drop view if exists public.public_media_routes cascade;
drop view if exists public.editor_report_queue cascade;

drop function if exists public.save_species(uuid,text,jsonb,integer,text);
drop function if exists public.retire_species(uuid,integer,text);
drop function if exists public.restore_species(uuid,integer,text);
drop function if exists public.change_species_lifecycle(uuid,integer,public.species_lifecycle,text);
drop function if exists public.validate_revision(uuid,integer);
drop function if exists public.rollback_revision(uuid,integer,integer,text);
drop function if exists public.create_media_asset(uuid,public.media_kind,text,public.media_license,text,text,text,text,numeric,numeric);
drop function if exists public.request_publish();
drop function if exists public.sync_mobile_state(text,jsonb,jsonb);
drop function if exists public.get_quiz_leaderboard(text,text,integer);
drop function if exists public.get_species_favorite_counts(text[]);
drop function if exists public.get_most_favorited_species(integer);
drop function if exists public.submit_user_report(public.report_kind,text,text,text,text);
drop function if exists public.resolve_user_report(uuid,public.report_state,text);
drop function if exists public.mark_catalog_dirty();
drop function if exists public.require_editor();

drop table if exists public.species_field_sources cascade;
drop table if exists public.sources cascade;
drop table if exists public.species_revisions cascade;
drop table if exists public.media_jobs cascade;
drop table if exists public.media_assets cascade;
drop table if exists public.mobile_favorites cascade;
drop table if exists public.mobile_quiz_records cascade;
drop table if exists public.user_reports cascade;
drop table if exists public.catalog_releases cascade;
drop table if exists public.catalog_state cascade;
drop table if exists public.species cascade;

drop type if exists public.species_lifecycle cascade;
drop type if exists public.validation_state cascade;
drop type if exists public.media_state cascade;
drop type if exists public.media_license cascade;
drop type if exists public.media_kind cascade;
drop type if exists public.release_state cascade;
drop type if exists public.report_kind cascade;
drop type if exists public.report_state cascade;

-- Profiles are generic application identities. Editorial authorization lives
-- exclusively in editor_memberships.
alter table public.profiles rename column id to user_id;
alter table public.profiles drop column role;
alter table public.profiles drop column is_active;
alter table public.profiles drop column mfa_required;
alter table public.profiles drop column updated_at;

alter table public.editor_memberships drop column mfa_required;
alter table public.editor_memberships drop column invited_by;
alter table public.editor_memberships drop column updated_at;
alter table public.editor_memberships rename column is_active to active;
alter table public.editor_memberships
  alter column role type text using role::text;
alter table public.editor_memberships
  add constraint editor_memberships_role_check
  check (role in ('collaborator', 'admin'));

drop type if exists public.app_role;

create table public.species (
  id uuid primary key default gen_random_uuid(),
  catalog_code text not null unique check (catalog_code ~ '^[A-Za-z0-9_-]{2,80}$'),
  scientific_name text not null check (length(trim(scientific_name)) >= 3),
  accepted_name text,
  common_name text not null check (length(trim(common_name)) >= 2),
  alternate_common_names text[] not null default '{}',
  kingdom text not null default 'Animalia',
  phylum text not null default '',
  class text not null default '',
  order_name text not null default '',
  family text not null default '',
  genus text not null default '',
  origin text not null default 'unknown' check (origin in ('native','introduced','unknown')),
  establishment text not null default 'uncertain' check (establishment in ('established','casual','uncertain')),
  seasonality text not null default 'unknown' check (seasonality in ('resident','migratory','occasional','unknown')),
  presence_certainty text not null default 'uncertain' check (presence_certainty in ('confirmed','probable','uncertain')),
  abundance_status text,
  conservation_system text,
  conservation_category text,
  conservation_label text,
  conservation_source text,
  conservation_rank smallint not null default 0 check (conservation_rank between 0 and 3),
  conservation_assessed_at date,
  description text not null default '',
  habitat text[] not null default '{}',
  diet text[] not null default '{}',
  size text,
  relevant_note text,
  source_references text[] not null default '{}',
  primary_image_id uuid,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.species_change_requests (
  id uuid primary key default gen_random_uuid(),
  species_id uuid references public.species(id) on delete restrict,
  change_type text not null check (change_type in ('create','update','media')),
  proposed_changes jsonb not null check (jsonb_typeof(proposed_changes) = 'object'),
  base_updated_at timestamptz,
  proposed_by uuid not null references public.profiles(user_id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  validated_by uuid references public.profiles(user_id) on delete restrict,
  comment text,
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  check (
    (status = 'pending' and validated_by is null and validated_at is null)
    or (status in ('approved','rejected') and validated_by is not null and validated_at is not null)
  )
);

create table public.species_audit (
  id bigint generated always as identity primary key,
  species_id uuid not null references public.species(id) on delete restrict,
  change_request_id uuid not null unique references public.species_change_requests(id) on delete restrict,
  before_values jsonb not null check (jsonb_typeof(before_values) = 'object'),
  after_values jsonb not null check (jsonb_typeof(after_values) = 'object'),
  proposed_by uuid not null references public.profiles(user_id) on delete restrict,
  validated_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.species_media (
  id uuid primary key default gen_random_uuid(),
  species_id uuid references public.species(id) on delete restrict,
  change_request_id uuid references public.species_change_requests(id) on delete restrict,
  ordinal integer not null check (ordinal > 0),
  type text not null check (type in ('image','audio')),
  storage_path text,
  thumbnail_path text,
  author text not null check (length(trim(author)) >= 2),
  license text not null check (length(trim(license)) >= 2),
  source text not null check (length(trim(source)) >= 2),
  source_url text,
  original_filename text,
  uploaded_by uuid not null references public.profiles(user_id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','approved','rejected','archived')),
  created_at timestamptz not null default now(),
  check (type = 'image' or thumbnail_path is null),
  check (status <> 'approved' or storage_path is not null)
);

create unique index species_media_species_ordinal_unique
  on public.species_media(species_id, ordinal) where species_id is not null;
create unique index species_media_request_ordinal_unique
  on public.species_media(change_request_id, ordinal) where species_id is null and change_request_id is not null;

alter table public.species
  add constraint species_primary_image_fk
  foreign key (primary_image_id) references public.species_media(id) on delete restrict;

create table public.media_jobs (
  id uuid primary key default gen_random_uuid(),
  species_media_id uuid not null unique references public.species_media(id) on delete cascade,
  incoming_path text not null unique,
  status text not null default 'pending' check (status in ('pending','processing','ready','failed')),
  attempts smallint not null default 0 check (attempts >= 0),
  clip_start_seconds numeric,
  clip_duration_seconds numeric,
  error text,
  requested_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  check (
    (clip_start_seconds is null and clip_duration_seconds is null)
    or (clip_start_seconds >= 0 and clip_duration_seconds > 0 and clip_duration_seconds <= 15)
  )
);

create table public.catalog_state (
  singleton boolean primary key default true check (singleton),
  dirty boolean not null default true,
  dirty_changes integer not null default 0 check (dirty_changes >= 0),
  last_changed_at timestamptz not null default now(),
  last_release_version bigint,
  last_published_at timestamptz
);
insert into public.catalog_state(singleton) values (true);

create table public.catalog_releases (
  id uuid primary key default gen_random_uuid(),
  version bigint not null unique check (version > 0),
  schema_version integer not null default 5 check (schema_version > 0),
  status text not null default 'pending' check (status in ('pending','building','published','failed')),
  requested_by uuid not null references public.profiles(user_id) on delete restrict,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  published_at timestamptz,
  species_count integer,
  database_size bigint,
  database_sha256 text,
  github_release_url text,
  quality_report_url text,
  min_app_version text not null default '1.0.0',
  source_audit_id bigint,
  error text
);

create table public.favorites (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  species_id uuid not null references public.species(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, species_id)
);

create table public.game_stats (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  game_mode text not null check (game_mode ~ '^[a-z0-9_-]+:[a-z0-9_:-]+$'),
  best_score integer not null default 0 check (best_score between 0 and 1000000),
  games_played integer not null default 0 check (games_played >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_mode)
);

create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  message text not null check (length(trim(message)) between 10 and 4000),
  app_version text not null check (length(trim(app_version)) between 1 and 40),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now()
);

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  message text not null check (length(trim(message)) between 10 and 4000),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now()
);

create table public.review_requests (
  id uuid primary key default gen_random_uuid(),
  species_id uuid not null references public.species(id) on delete restrict,
  requested_by uuid not null references public.profiles(user_id) on delete restrict,
  reason text not null check (length(trim(reason)) between 10 and 4000),
  status text not null default 'open' check (status in ('open','resolved')),
  resolved_by uuid references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((status = 'open' and resolved_by is null and resolved_at is null)
    or (status = 'resolved' and resolved_by is not null and resolved_at is not null))
);

create index species_scientific_name_idx on public.species(scientific_name);
create index species_common_name_idx on public.species(common_name);
create index species_class_idx on public.species(class);
create index species_family_idx on public.species(family);
create index species_change_requests_status_idx on public.species_change_requests(status, created_at);
create index species_audit_species_idx on public.species_audit(species_id, created_at desc);
create index species_media_species_status_idx on public.species_media(species_id, status, type, ordinal);
create index media_jobs_status_idx on public.media_jobs(status, created_at);
create index bug_reports_user_created_idx on public.bug_reports(user_id, created_at desc);
create index feedback_review_status_idx on public.review_requests(status, created_at);

-- Authentication and authorization helpers.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(user_id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      split_part(coalesce(new.email, new.id::text), '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data->>'avatar_url'), '')
  )
  on conflict (user_id) do update set
    display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);
  return new;
end;
$$;

create or replace function public.has_editor_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.editor_memberships membership
    where membership.user_id = auth.uid()
      and membership.active
      and (membership.role <> 'admin' or auth.jwt()->>'aal' = 'aal2')
  )
$$;

create or replace function public.has_admin_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.editor_memberships membership
    where membership.user_id = auth.uid()
      and membership.active
      and membership.role = 'admin'
      and auth.jwt()->>'aal' = 'aal2'
  )
$$;

create or replace function public.require_editor()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.has_editor_access() then
    raise exception 'editor_access_required' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;

create or replace function public.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.has_admin_access() then
    raise exception 'admin_access_required' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;

create or replace function public.set_public_alias(p_alias text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_alias text := nullif(btrim(p_alias), '');
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if v_alias is not null and (char_length(v_alias) < 3 or char_length(v_alias) > 30 or v_alias !~ '^[[:alnum:]_.-]+$') then
    raise exception 'invalid_public_alias';
  end if;
  update public.profiles set public_alias = v_alias where user_id = v_actor;
  if not found then raise exception 'profile_not_found'; end if;
  return v_alias;
end;
$$;

create or replace function public.mark_catalog_dirty()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.catalog_state
  set dirty = true,
      dirty_changes = dirty_changes + 1,
      last_changed_at = now()
  where singleton
$$;

create or replace function public.validate_species_changes(p_changes jsonb, p_allow_empty boolean default false)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare v_unknown text;
begin
  if jsonb_typeof(p_changes) <> 'object' or (not p_allow_empty and p_changes = '{}'::jsonb) then
    raise exception 'invalid_species_changes';
  end if;
  select key into v_unknown
  from jsonb_object_keys(p_changes) key
  where key <> all (array[
    'catalog_code','scientific_name','accepted_name','common_name','alternate_common_names',
    'kingdom','phylum','class','order_name','family','genus','origin','establishment',
    'seasonality','presence_certainty','abundance_status','conservation_system',
    'conservation_category','conservation_label','conservation_source','conservation_rank',
    'conservation_assessed_at','description','habitat','diet','size','relevant_note',
    'source_references','primary_image_id','status'
  ])
  limit 1;
  if v_unknown is not null then raise exception 'unsupported_species_field:%', v_unknown; end if;
end;
$$;

create or replace function public.submit_species_change(
  p_species_id uuid,
  p_change_type text,
  p_proposed_changes jsonb,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_editor();
  v_updated_at timestamptz;
  v_request_id uuid;
begin
  if p_change_type not in ('create','update','media') then raise exception 'invalid_change_type'; end if;
  perform public.validate_species_changes(p_proposed_changes, p_change_type = 'media');

  if p_species_id is null then
    if p_change_type <> 'create' then raise exception 'new_species_requires_create'; end if;
    if nullif(trim(p_proposed_changes->>'catalog_code'), '') is null
      or nullif(trim(p_proposed_changes->>'scientific_name'), '') is null
      or nullif(trim(p_proposed_changes->>'common_name'), '') is null
    then raise exception 'new_species_required_fields'; end if;
  else
    if p_change_type = 'create' then raise exception 'existing_species_cannot_create'; end if;
    select updated_at into v_updated_at from public.species where id = p_species_id;
    if not found then raise exception 'species_not_found'; end if;
  end if;

  insert into public.species_change_requests(
    species_id, change_type, proposed_changes, base_updated_at, proposed_by, comment
  ) values (
    p_species_id, p_change_type, p_proposed_changes, v_updated_at, v_actor,
    nullif(trim(p_comment), '')
  ) returning id into v_request_id;
  return v_request_id;
end;
$$;

create or replace function public.approve_species_change(
  p_request_id uuid,
  p_confirm_self_validation boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_editor();
  v_request public.species_change_requests;
  v_current public.species;
  v_next public.species;
  v_species_id uuid;
  v_keys text[];
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_now timestamptz := now();
  v_primary uuid;
begin
  select * into v_request
  from public.species_change_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'change_request_not_found'; end if;
  if v_request.status <> 'pending' then raise exception 'change_request_not_pending'; end if;
  if v_request.proposed_by = v_actor and not p_confirm_self_validation then
    raise exception 'self_validation_confirmation_required';
  end if;
  perform public.validate_species_changes(v_request.proposed_changes, v_request.change_type = 'media');

  if exists (
    select 1 from public.species_media media
    left join public.media_jobs job on job.species_media_id = media.id
    where media.change_request_id = v_request.id
      and (job.id is null or job.status <> 'ready')
  ) then raise exception 'linked_media_not_ready'; end if;

  select coalesce(array_agg(key order by key), '{}') into v_keys
  from jsonb_object_keys(v_request.proposed_changes) key;

  if v_request.species_id is null then
    v_species_id := gen_random_uuid();
    v_next.id := v_species_id;
    v_next.catalog_code := '';
    v_next.scientific_name := '';
    v_next.common_name := '';
    v_next.alternate_common_names := '{}';
    v_next.kingdom := 'Animalia';
    v_next.phylum := '';
    v_next.class := '';
    v_next.order_name := '';
    v_next.family := '';
    v_next.genus := '';
    v_next.origin := 'unknown';
    v_next.establishment := 'uncertain';
    v_next.seasonality := 'unknown';
    v_next.presence_certainty := 'uncertain';
    v_next.conservation_rank := 0;
    v_next.description := '';
    v_next.habitat := '{}';
    v_next.diet := '{}';
    v_next.source_references := '{}';
    v_next.status := 'active';
    v_next.created_at := v_now;
    v_next.updated_at := v_now;
    select * into v_next from jsonb_populate_record(v_next, v_request.proposed_changes - 'primary_image_id');
    v_next.id := v_species_id;
    v_next.created_at := v_now;
    v_next.updated_at := v_now;
    v_next.primary_image_id := null;
    insert into public.species select (v_next).*;
    v_after := v_request.proposed_changes - 'primary_image_id';
  else
    select * into v_current from public.species where id = v_request.species_id for update;
    if not found then raise exception 'species_not_found'; end if;
    if v_current.updated_at is distinct from v_request.base_updated_at then
      raise exception 'species_change_conflict';
    end if;
    v_species_id := v_current.id;
    if cardinality(v_keys) > 0 then
      select coalesce(jsonb_object_agg(key, to_jsonb(v_current)->key), '{}'::jsonb)
      into v_before from unnest(v_keys) key;
    end if;
    select * into v_next from jsonb_populate_record(v_current, v_request.proposed_changes - 'primary_image_id');
    v_next.id := v_current.id;
    v_next.created_at := v_current.created_at;
    v_next.updated_at := case when v_request.proposed_changes = '{}'::jsonb then v_current.updated_at else v_now end;
    v_next.primary_image_id := v_current.primary_image_id;
    update public.species set
      catalog_code = v_next.catalog_code,
      scientific_name = v_next.scientific_name,
      accepted_name = v_next.accepted_name,
      common_name = v_next.common_name,
      alternate_common_names = v_next.alternate_common_names,
      kingdom = v_next.kingdom,
      phylum = v_next.phylum,
      class = v_next.class,
      order_name = v_next.order_name,
      family = v_next.family,
      genus = v_next.genus,
      origin = v_next.origin,
      establishment = v_next.establishment,
      seasonality = v_next.seasonality,
      presence_certainty = v_next.presence_certainty,
      abundance_status = v_next.abundance_status,
      conservation_system = v_next.conservation_system,
      conservation_category = v_next.conservation_category,
      conservation_label = v_next.conservation_label,
      conservation_source = v_next.conservation_source,
      conservation_rank = v_next.conservation_rank,
      conservation_assessed_at = v_next.conservation_assessed_at,
      description = v_next.description,
      habitat = v_next.habitat,
      diet = v_next.diet,
      size = v_next.size,
      relevant_note = v_next.relevant_note,
      source_references = v_next.source_references,
      status = v_next.status,
      updated_at = v_next.updated_at
    where id = v_species_id;
    if cardinality(v_keys) > 0 then
      select coalesce(jsonb_object_agg(key, to_jsonb(v_next)->key), '{}'::jsonb)
      into v_after from unnest(v_keys) key;
    end if;
  end if;

  update public.species_media
  set species_id = v_species_id, status = 'approved'
  where change_request_id = v_request.id and status = 'pending';

  if v_request.proposed_changes ? 'primary_image_id' then
    v_primary := nullif(v_request.proposed_changes->>'primary_image_id', '')::uuid;
    if not exists (
      select 1 from public.species_media
      where id = v_primary and species_id = v_species_id and type = 'image' and status = 'approved'
    ) then raise exception 'invalid_primary_image'; end if;
    select v_before || jsonb_build_object('primary_image_id', primary_image_id) into v_before
    from public.species where id = v_species_id;
    update public.species set primary_image_id = v_primary, updated_at = v_now where id = v_species_id;
    v_after := v_after || jsonb_build_object('primary_image_id', v_primary);
  end if;

  insert into public.species_audit(
    species_id, change_request_id, before_values, after_values, proposed_by, validated_by
  ) values (v_species_id, v_request.id, v_before, v_after, v_request.proposed_by, v_actor);

  update public.species_change_requests
  set species_id = v_species_id, status = 'approved', validated_by = v_actor, validated_at = v_now
  where id = v_request.id;

  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, payload)
  values (v_actor, 'species.change_approved', 'species', v_species_id::text,
    jsonb_build_object('changeRequestId', v_request.id, 'selfValidated', v_actor = v_request.proposed_by));
  perform public.mark_catalog_dirty();
  return v_species_id;
end;
$$;

create or replace function public.reject_species_change(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := public.require_editor(); v_request public.species_change_requests;
begin
  select * into v_request from public.species_change_requests where id = p_request_id for update;
  if not found then raise exception 'change_request_not_found'; end if;
  if v_request.status <> 'pending' then raise exception 'change_request_not_pending'; end if;
  update public.species_change_requests
  set status = 'rejected', validated_by = v_actor, validated_at = now()
  where id = p_request_id;
  update public.species_media set status = 'rejected'
  where change_request_id = p_request_id and status = 'pending';
end;
$$;

create or replace function public.reserve_species_media_upload(
  p_species_id uuid,
  p_change_request_id uuid,
  p_type text,
  p_author text,
  p_license text,
  p_source text,
  p_source_url text,
  p_original_filename text,
  p_make_primary boolean,
  p_confirm_rights boolean,
  p_clip_start_seconds numeric default null,
  p_clip_duration_seconds numeric default null
)
returns table(
  media_id uuid,
  job_id uuid,
  change_request_id uuid,
  ordinal integer,
  incoming_path text,
  storage_path text,
  thumbnail_path text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := public.require_editor();
  v_request public.species_change_requests;
  v_catalog_code text;
  v_media_id uuid := gen_random_uuid();
  v_job_id uuid := gen_random_uuid();
  v_ordinal integer;
  v_request_id uuid := p_change_request_id;
  v_safe_name text;
  v_storage text;
  v_thumb text;
  v_incoming text;
begin
  if not p_confirm_rights then raise exception 'rights_confirmation_required'; end if;
  if p_type not in ('image','audio') then raise exception 'invalid_media_type'; end if;
  if length(trim(coalesce(p_author,''))) < 2 or length(trim(coalesce(p_source,''))) < 2 then
    raise exception 'media_attribution_required';
  end if;
  if p_license not in ('CC-BY-4.0','CC0','permission','legacy') then raise exception 'invalid_media_license'; end if;
  if p_type = 'audio' and (p_clip_start_seconds is null or p_clip_duration_seconds is null
    or p_clip_start_seconds < 0 or p_clip_duration_seconds <= 0 or p_clip_duration_seconds > 15)
  then raise exception 'invalid_audio_clip'; end if;
  if p_type = 'image' and (p_clip_start_seconds is not null or p_clip_duration_seconds is not null)
  then raise exception 'image_cannot_have_audio_clip'; end if;

  if v_request_id is null then
    if p_species_id is null then raise exception 'new_species_request_required'; end if;
    v_request_id := public.submit_species_change(p_species_id, 'media', '{}'::jsonb, 'Aporte multimedia');
  end if;
  select * into v_request from public.species_change_requests where id = v_request_id for update;
  if not found or v_request.status <> 'pending' or v_request.proposed_by <> v_actor then
    raise exception 'invalid_media_change_request';
  end if;
  if p_species_id is distinct from v_request.species_id then raise exception 'media_species_mismatch'; end if;

  if p_species_id is null then
    v_catalog_code := trim(v_request.proposed_changes->>'catalog_code');
  else
    select catalog_code into v_catalog_code from public.species where id = p_species_id;
  end if;
  if nullif(v_catalog_code, '') is null then raise exception 'catalog_code_required_for_media'; end if;

  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_species_id::text, v_request_id::text), 0));
  if p_species_id is null then
    select coalesce(max(media.ordinal), 0) + 1 into v_ordinal
    from public.species_media media where media.change_request_id = v_request_id;
  else
    select coalesce(max(media.ordinal), 0) + 1 into v_ordinal
    from public.species_media media where media.species_id = p_species_id;
  end if;

  v_safe_name := regexp_replace(coalesce(nullif(p_original_filename,''), 'original'), '[^A-Za-z0-9._-]', '_', 'g');
  v_incoming := v_actor::text || '/' || v_media_id::text || '/' || v_safe_name;
  if p_type = 'image' then
    v_storage := 'species/' || v_catalog_code || '/' || lpad(v_ordinal::text, 2, '0') || '.webp';
    v_thumb := 'species/' || v_catalog_code || '/thumbs/' || lpad(v_ordinal::text, 2, '0') || '.webp';
  else
    v_storage := 'species/' || v_catalog_code || '/' || lpad(v_ordinal::text, 2, '0') || '.mp3';
    v_thumb := null;
  end if;

  insert into public.species_media(
    id, species_id, change_request_id, ordinal, type, storage_path, thumbnail_path,
    author, license, source, source_url, original_filename, uploaded_by
  ) values (
    v_media_id, p_species_id, v_request_id, v_ordinal, p_type, v_storage, v_thumb,
    trim(p_author), p_license, trim(p_source), nullif(trim(p_source_url), ''),
    nullif(p_original_filename, ''), v_actor
  );
  insert into public.media_jobs(
    id, species_media_id, incoming_path, clip_start_seconds, clip_duration_seconds, requested_by
  ) values (v_job_id, v_media_id, v_incoming, p_clip_start_seconds, p_clip_duration_seconds, v_actor);

  if p_make_primary then
    if p_type <> 'image' then raise exception 'primary_media_must_be_image'; end if;
    update public.species_change_requests
    set proposed_changes = jsonb_set(proposed_changes, '{primary_image_id}', to_jsonb(v_media_id), true)
    where id = v_request_id;
  end if;

  return query select v_media_id, v_job_id, v_request_id, v_ordinal, v_incoming, v_storage, v_thumb;
end;
$$;

create or replace function public.request_catalog_publish()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := public.require_admin(); v_state public.catalog_state; v_release_id uuid; v_version bigint;
begin
  select * into v_state from public.catalog_state where singleton for update;
  if not v_state.dirty then raise exception 'catalog_not_dirty'; end if;
  select id into v_release_id from public.catalog_releases
  where status in ('pending','building') order by requested_at desc limit 1;
  if v_release_id is not null then return v_release_id; end if;
  select coalesce(max(version),0)+1 into v_version from public.catalog_releases;
  insert into public.catalog_releases(version, requested_by, source_audit_id)
  values (v_version, v_actor, (select max(id) from public.species_audit))
  returning id into v_release_id;
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id,payload)
  values(v_actor,'catalog.publish_requested','release',v_release_id::text,jsonb_build_object('version',v_version));
  return v_release_id;
end;
$$;

create or replace function public.sync_favorites(p_changes jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_entry jsonb; v_species_id uuid;
begin
  if v_actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 5000 then raise exception 'invalid_favorites_batch'; end if;
  for v_entry in select value from jsonb_array_elements(p_changes) loop
    select id into v_species_id from public.species where catalog_code = trim(v_entry->>'catalogCode');
    if v_species_id is null then continue; end if;
    if coalesce((v_entry->>'isFavorite')::boolean, false) then
      insert into public.favorites(user_id,species_id) values (v_actor,v_species_id) on conflict do nothing;
    else
      delete from public.favorites where user_id=v_actor and species_id=v_species_id;
    end if;
  end loop;
  return coalesce((select jsonb_agg(species.catalog_code order by species.catalog_code)
    from public.favorites favorite join public.species species on species.id=favorite.species_id
    where favorite.user_id=v_actor), '[]'::jsonb);
end;
$$;

create or replace function public.record_game_result(p_game_mode text, p_score integer, p_games_delta integer default 1)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_game_mode !~ '^[a-z0-9_-]+:[a-z0-9_:-]+$' or p_score not between 0 and 1000000
    or p_games_delta not between 1 and 10000 then raise exception 'invalid_game_result'; end if;
  insert into public.game_stats(user_id,game_mode,best_score,games_played)
  values(v_actor,p_game_mode,p_score,p_games_delta)
  on conflict(user_id,game_mode) do update set
    best_score=greatest(public.game_stats.best_score,excluded.best_score),
    games_played=public.game_stats.games_played+excluded.games_played,
    updated_at=now();
end;
$$;

create or replace function public.get_game_leaderboard(p_game_mode text, p_limit integer default 50)
returns table(rank bigint, public_alias text, best_score integer, games_played integer)
language sql
stable
security definer
set search_path = ''
as $$
  select row_number() over(order by stat.best_score desc, stat.updated_at asc),
    profile.public_alias, stat.best_score, stat.games_played
  from public.game_stats stat
  join public.profiles profile on profile.user_id=stat.user_id
  where stat.game_mode=p_game_mode and profile.public_alias is not null
  order by stat.best_score desc, stat.updated_at asc
  limit least(greatest(coalesce(p_limit,50),1),100)
$$;

create or replace function public.submit_bug_report(p_message text, p_app_version text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid:=auth.uid(); v_id uuid;
begin
  if v_actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if exists(select 1 from public.bug_reports where user_id=v_actor and created_at > now()-interval '24 hours')
  then raise exception 'bug_report_rate_limited'; end if;
  insert into public.bug_reports(user_id,message,app_version)
  values(v_actor,trim(p_message),trim(p_app_version)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.submit_suggestion(p_message text)
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_actor uuid:=auth.uid(); v_id uuid; begin
  if v_actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
  insert into public.suggestions(user_id,message) values(v_actor,trim(p_message)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.submit_review_request(p_catalog_code text, p_reason text)
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_actor uuid:=auth.uid(); v_species uuid; v_id uuid; begin
  if v_actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select id into v_species from public.species where catalog_code=trim(p_catalog_code) and status='active';
  if v_species is null then raise exception 'species_not_found'; end if;
  insert into public.review_requests(species_id,requested_by,reason)
  values(v_species,v_actor,trim(p_reason)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.resolve_bug_report(p_id uuid)
returns void language plpgsql security definer set search_path=''
as $$ declare v_actor uuid:=public.require_editor(); begin
  update public.bug_reports set status='resolved' where id=p_id;
  if not found then raise exception 'bug_report_not_found'; end if;
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id)
  values(v_actor,'bug_report.resolved','bug_report',p_id::text);
end $$;

create or replace function public.resolve_suggestion(p_id uuid)
returns void language plpgsql security definer set search_path=''
as $$ declare v_actor uuid:=public.require_editor(); begin
  update public.suggestions set status='resolved' where id=p_id;
  if not found then raise exception 'suggestion_not_found'; end if;
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id)
  values(v_actor,'suggestion.resolved','suggestion',p_id::text);
end $$;

create or replace function public.resolve_review_request(p_id uuid)
returns void language plpgsql security definer set search_path=''
as $$ declare v_actor uuid:=public.require_editor(); begin
  update public.review_requests set status='resolved',resolved_by=v_actor,resolved_at=now() where id=p_id;
  if not found then raise exception 'review_request_not_found'; end if;
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id)
  values(v_actor,'review_request.resolved','review_request',p_id::text);
end $$;

-- Editor-facing read models. security_invoker keeps base-table RLS authoritative.
create view public.species_editor with (security_invoker=true) as
select species.*,
  media.thumbnail_path as primary_thumbnail_path,
  media.storage_path as primary_storage_path,
  exists(select 1 from public.species_media audio where audio.species_id=species.id and audio.type='audio' and audio.status='approved') as has_audio
from public.species species
left join public.species_media media on media.id=species.primary_image_id;

create view public.change_request_queue with (security_invoker=true) as
select request.*, species.catalog_code, species.scientific_name, species.common_name,
  to_jsonb(species) - array['created_at','updated_at'] as current_values,
  proposer.display_name as proposed_by_name, validator.display_name as validated_by_name
from public.species_change_requests request
left join public.species species on species.id=request.species_id
join public.profiles proposer on proposer.user_id=request.proposed_by
left join public.profiles validator on validator.user_id=request.validated_by;

create view public.species_audit_history with (security_invoker=true) as
select audit.*, proposer.display_name as proposed_by_name, validator.display_name as validated_by_name
from public.species_audit audit
join public.profiles proposer on proposer.user_id=audit.proposed_by
join public.profiles validator on validator.user_id=audit.validated_by;

create view public.media_queue with (security_invoker=true) as
select media.*, species.common_name as species_name, job.id as job_id, job.status as processing_status,
  job.error as processing_error, uploader.display_name as uploaded_by_name
from public.species_media media
left join public.species species on species.id=media.species_id
left join public.media_jobs job on job.species_media_id=media.id
join public.profiles uploader on uploader.user_id=media.uploaded_by;

create view public.catalog_release_history with (security_invoker=true) as
select release.*, profile.display_name as requested_by_name
from public.catalog_releases release join public.profiles profile on profile.user_id=release.requested_by;

create view public.admin_profiles as
select profile.user_id,profile.display_name,auth_user.email,membership.role,membership.active
from public.editor_memberships membership
join public.profiles profile on profile.user_id=membership.user_id
join auth.users auth_user on auth_user.id=membership.user_id
where public.has_admin_access();

create view public.dashboard_stats with (security_invoker=true) as
select
  (select count(*) from public.species where status='active')::integer as active_species,
  (select count(*) from public.species where status='archived')::integer as archived_species,
  (select count(*) from public.species_change_requests where status='pending')::integer as pending_changes,
  (select count(distinct species_id) from public.species_media where type='image' and status='approved')::integer as with_image,
  (select count(distinct species_id) from public.species_media where type='audio' and status='approved')::integer as with_audio,
  (select count(*) from public.media_jobs where status in ('pending','processing'))::integer as pending_media,
  state.dirty_changes,state.last_release_version,state.last_published_at
from public.catalog_state state where singleton;

create view public.feedback_queue with (security_invoker=true) as
select 'bug'::text as type,id,user_id,null::uuid as species_id,message,status,created_at from public.bug_reports
union all
select 'suggestion',id,user_id,null::uuid,message,status,created_at from public.suggestions
union all
select 'review',id,requested_by,species_id,reason,status,created_at from public.review_requests;

-- RLS: clients can read public approved catalogue data, while every mutation
-- that affects publication is mediated by an authorized RPC.
alter table public.profiles enable row level security;
alter table public.editor_memberships enable row level security;
alter table public.species enable row level security;
alter table public.species_change_requests enable row level security;
alter table public.species_audit enable row level security;
alter table public.species_media enable row level security;
alter table public.media_jobs enable row level security;
alter table public.catalog_state enable row level security;
alter table public.catalog_releases enable row level security;
alter table public.favorites enable row level security;
alter table public.game_stats enable row level security;
alter table public.bug_reports enable row level security;
alter table public.suggestions enable row level security;
alter table public.review_requests enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (user_id=auth.uid() or public.has_editor_access());
drop policy if exists editor_memberships_read on public.editor_memberships;
create policy editor_memberships_read on public.editor_memberships for select to authenticated
  using (user_id=auth.uid() or public.has_admin_access());
create policy species_public_read on public.species for select to anon,authenticated
  using (status='active' or public.has_editor_access());
create policy change_requests_editor_read on public.species_change_requests for select to authenticated
  using (public.has_editor_access());
create policy species_audit_editor_read on public.species_audit for select to authenticated
  using (public.has_editor_access());
create policy species_media_read on public.species_media for select to anon,authenticated
  using (status='approved' or public.has_editor_access());
create policy media_jobs_editor_read on public.media_jobs for select to authenticated
  using (public.has_editor_access());
create policy catalog_state_editor_read on public.catalog_state for select to authenticated
  using (public.has_editor_access());
create policy catalog_releases_editor_read on public.catalog_releases for select to authenticated
  using (public.has_editor_access());
create policy favorites_own_select on public.favorites for select to authenticated using(user_id=auth.uid());
create policy favorites_own_insert on public.favorites for insert to authenticated with check(user_id=auth.uid());
create policy favorites_own_delete on public.favorites for delete to authenticated using(user_id=auth.uid());
create policy game_stats_own_select on public.game_stats for select to authenticated using(user_id=auth.uid());
create policy bug_reports_read on public.bug_reports for select to authenticated
  using(user_id=auth.uid() or public.has_editor_access());
create policy suggestions_read on public.suggestions for select to authenticated
  using(user_id=auth.uid() or public.has_editor_access());
create policy review_requests_read on public.review_requests for select to authenticated
  using(requested_by=auth.uid() or public.has_editor_access());
drop policy if exists audit_read on public.audit_events;
create policy audit_admin_read on public.audit_events for select to authenticated
  using(public.has_admin_access());

drop policy if exists incoming_insert_own on storage.objects;
drop policy if exists incoming_read_own on storage.objects;
drop policy if exists media_public_read on storage.objects;
drop policy if exists evidence_insert_own on storage.objects;
drop policy if exists evidence_read_own_or_admin on storage.objects;
create policy incoming_insert_reserved on storage.objects for insert to authenticated
with check (
  bucket_id='incoming' and public.has_editor_access()
  and exists(
    select 1 from public.media_jobs job
    join public.species_media media on media.id=job.species_media_id
    where job.incoming_path=name and job.requested_by=auth.uid() and job.status='pending'
      and case media.type
        when 'image' then lower(coalesce(metadata->>'mimetype','')) in ('image/jpeg','image/png','image/webp','image/heic','image/heif')
          and coalesce((metadata->>'size')::bigint,0) between 1 and 20971520
        when 'audio' then lower(coalesce(metadata->>'mimetype','')) in ('audio/mpeg','audio/wav','audio/x-wav','audio/flac','audio/x-flac','audio/mp4','audio/ogg')
          and coalesce((metadata->>'size')::bigint,0) between 1 and 47185920
        else false
      end
  )
);
create policy incoming_read_reserved on storage.objects for select to authenticated
using (
  bucket_id='incoming' and public.has_editor_access()
  and exists(select 1 from public.media_jobs job where job.incoming_path=name and job.requested_by=auth.uid())
);
create policy public_artifact_read on storage.objects for select to anon,authenticated
  using(bucket_id in ('media-public','catalog-public'));

-- Storage prevents direct bucket deletion through SQL. The preflight above
-- guarantees this legacy bucket is empty; keep it inert so deployments remain
-- reproducible. It can later be removed through the Storage API if desired.
update storage.buckets set
  file_size_limit=47185920,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','image/heic','image/heif','audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/flac','audio/x-flac','audio/ogg']
where id='incoming';

revoke all on all tables in schema public from anon,authenticated;
revoke execute on all functions in schema public from public,anon,authenticated;
grant usage on schema public to anon,authenticated;
grant select on public.species,public.species_media to anon,authenticated;
grant select on public.profiles,public.editor_memberships,public.species_change_requests,
  public.species_audit,public.media_jobs,public.catalog_state,public.catalog_releases,
  public.favorites,public.game_stats,public.bug_reports,public.suggestions,public.review_requests,
  public.audit_events
  to authenticated;
grant insert,delete on public.favorites to authenticated;
grant select on public.species_editor,public.change_request_queue,public.species_audit_history,
  public.media_queue,public.catalog_release_history,public.admin_profiles,public.dashboard_stats,
  public.feedback_queue to authenticated;

grant execute on function public.has_editor_access(),public.has_admin_access() to anon,authenticated;
grant execute on function public.set_public_alias(text),
  public.submit_species_change(uuid,text,jsonb,text),
  public.approve_species_change(uuid,boolean),
  public.reject_species_change(uuid),
  public.reserve_species_media_upload(uuid,uuid,text,text,text,text,text,text,boolean,boolean,numeric,numeric),
  public.request_catalog_publish(),public.sync_favorites(jsonb),
  public.record_game_result(text,integer,integer),public.get_game_leaderboard(text,integer),
  public.submit_bug_report(text,text),public.submit_suggestion(text),
  public.submit_review_request(text,text),public.resolve_bug_report(uuid),
  public.resolve_suggestion(uuid),public.resolve_review_request(uuid)
to authenticated;
grant execute on function public.get_game_leaderboard(text,integer) to anon;

comment on table public.species is 'Current approved public species state; clients cannot mutate it directly.';
comment on table public.species_change_requests is 'Small proposed diffs awaiting explicit editorial approval.';
comment on table public.media_jobs is 'Technical GitHub Actions processing state, separate from editorial media approval.';
