create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'collaborator');
create type public.species_lifecycle as enum ('active', 'retired');
create type public.validation_state as enum ('unreviewed', 'validated', 'needs_review');
create type public.media_kind as enum ('image', 'audio');
create type public.media_state as enum ('incoming', 'processing', 'ready', 'failed', 'retired');
create type public.media_license as enum ('CC0', 'CC-BY-4.0', 'permission', 'legacy');
create type public.release_state as enum ('pending', 'building', 'published', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 100),
  role public.app_role not null default 'collaborator',
  is_active boolean not null default true,
  mfa_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.species (
  id uuid primary key default gen_random_uuid(),
  catalog_code text not null unique check (catalog_code ~ '^[A-Za-z0-9_-]{2,80}$'),
  lifecycle public.species_lifecycle not null default 'active',
  current_revision integer not null default 0 check (current_revision >= 0),
  retired_reason text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.species_revisions (
  id uuid primary key default gen_random_uuid(),
  species_id uuid not null references public.species(id) on delete restrict,
  revision integer not null check (revision > 0),
  payload jsonb not null,
  validation_state public.validation_state not null default 'unreviewed',
  edited_by uuid not null references public.profiles(id),
  edited_at timestamptz not null default now(),
  validated_by uuid references public.profiles(id),
  validated_at timestamptz,
  reason text not null default 'Actualización editorial',
  unique (species_id, revision),
  check (jsonb_typeof(payload) = 'object'),
  check (length(trim(payload->>'scientificName')) > 2)
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  citation text,
  url text,
  accessed_at date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique nulls not distinct (name, url)
);

create table public.species_field_sources (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.species_revisions(id) on delete cascade,
  field_path text not null check (field_path ~ '^[A-Za-z][A-Za-z0-9_.\[\]-]*$'),
  source_id uuid not null references public.sources(id) on delete restrict,
  note text,
  unique (revision_id, field_path, source_id)
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  species_id uuid not null references public.species(id) on delete restrict,
  kind public.media_kind not null,
  state public.media_state not null default 'incoming',
  incoming_key text not null,
  main_key text,
  thumbnail_key text,
  app_audio_key text,
  external_url text,
  r2_main_key text,
  r2_thumbnail_key text,
  r2_audio_key text,
  evidence_key text,
  author text not null check (length(trim(author)) > 1),
  license public.media_license not null,
  original_license text,
  source_url text,
  terms_version text not null,
  rights_declared_at timestamptz not null default now(),
  uploaded_by uuid not null references public.profiles(id),
  checksum_sha256 text,
  width integer,
  height integer,
  duration_seconds numeric,
  palette jsonb,
  processing_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (license <> 'permission' or evidence_key is not null)
);

create table public.media_jobs (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  state public.media_state not null default 'incoming',
  attempts integer not null default 0,
  requested_by uuid not null references public.profiles(id),
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table public.catalog_state (
  singleton boolean primary key default true check (singleton),
  dirty boolean not null default true,
  dirty_changes integer not null default 0,
  last_changed_at timestamptz not null default now(),
  last_release_version bigint,
  last_published_at timestamptz
);
insert into public.catalog_state(singleton) values (true);

create table public.catalog_releases (
  id uuid primary key default gen_random_uuid(),
  data_version bigint not null unique,
  schema_version integer not null default 4,
  status public.release_state not null default 'pending',
  requested_by uuid not null references public.profiles(id),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  published_at timestamptz,
  species_count integer,
  database_size bigint,
  database_url text,
  database_sha256 text,
  quality_report_url text,
  github_release_url text,
  min_app_version text not null default '1.0.0',
  source_revision bigint,
  error text
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_species_lifecycle on public.species(lifecycle);
create index idx_species_revisions_current on public.species_revisions(species_id, revision desc);
create index idx_species_revisions_validation on public.species_revisions(validation_state);
create index idx_field_sources_revision on public.species_field_sources(revision_id, field_path);
create index idx_media_species_state on public.media_assets(species_id, state, kind);
create index idx_media_jobs_state on public.media_jobs(state, created_at);
create index idx_releases_status on public.catalog_releases(status, requested_at);
create index idx_audit_entity on public.audit_events(entity_type, entity_id, created_at desc);
create index idx_audit_actor on public.audit_events(actor_id, created_at desc);

create or replace function public.has_editor_access()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and is_active and (role <> 'admin' or auth.jwt()->>'aal' = 'aal2')) $$;

create or replace function public.has_admin_access()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and is_active and role = 'admin' and auth.jwt()->>'aal' = 'aal2') $$;

create or replace function public.require_editor()
returns uuid language plpgsql stable security definer set search_path = public
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.has_editor_access() then raise exception 'editor_access_required' using errcode = '42501'; end if;
  return v_actor;
end;
$$;

create or replace function public.mark_catalog_dirty()
returns void language sql security definer set search_path = public
as $$ update public.catalog_state set dirty = true, dirty_changes = dirty_changes + 1, last_changed_at = now() where singleton $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, display_name, role, mfa_required)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data->>'role' = 'admin' then 'admin'::public.app_role else 'collaborator'::public.app_role end,
    new.raw_user_meta_data->>'role' = 'admin')
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.save_species(p_species_id uuid, p_catalog_code text, p_payload jsonb, p_expected_revision integer, p_reason text default 'Actualización editorial')
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_actor uuid := public.require_editor(); v_species public.species; v_id uuid; v_next integer; v_revision_id uuid; v_entry jsonb; v_source_id uuid;
begin
  if jsonb_typeof(p_payload) <> 'object' or length(trim(p_payload->>'scientificName')) < 3 then raise exception 'invalid_species_payload'; end if;
  if p_species_id is null then
    if p_expected_revision <> 0 then raise exception 'revision_conflict'; end if;
    insert into public.species(catalog_code, created_by) values (trim(p_catalog_code), v_actor) returning * into v_species;
    v_id := v_species.id; v_next := 1;
  else
    select * into v_species from public.species where id = p_species_id for update;
    if not found then raise exception 'species_not_found'; end if;
    if v_species.current_revision <> p_expected_revision then raise exception 'revision_conflict'; end if;
    update public.species set catalog_code = trim(p_catalog_code), updated_at = now() where id = p_species_id;
    v_id := p_species_id; v_next := v_species.current_revision + 1;
  end if;
  insert into public.species_revisions(species_id, revision, payload, edited_by, reason)
  values (v_id, v_next, p_payload, v_actor, coalesce(nullif(trim(p_reason), ''), 'Actualización editorial')) returning id into v_revision_id;
  for v_entry in select value from jsonb_array_elements(coalesce(p_payload->'fieldSources', '[]'::jsonb)) loop
    if length(trim(coalesce(v_entry->>'fieldPath', ''))) > 0 and length(trim(coalesce(v_entry->>'name', ''))) > 0 then
      insert into public.sources(name, citation, url, created_by)
      values (trim(v_entry->>'name'), nullif(trim(v_entry->>'citation'), ''), nullif(trim(v_entry->>'url'), ''), v_actor)
      on conflict (name, url) do update set citation = coalesce(excluded.citation, public.sources.citation)
      returning id into v_source_id;
      insert into public.species_field_sources(revision_id, field_path, source_id, note)
      values (v_revision_id, trim(v_entry->>'fieldPath'), v_source_id, nullif(trim(v_entry->>'note'), ''));
    end if;
  end loop;
  update public.species set current_revision = v_next, updated_at = now() where id = v_id;
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, payload)
  values (v_actor, case when v_next = 1 then 'species.created' else 'species.updated' end, 'species', v_id::text, jsonb_build_object('revision', v_next, 'reason', p_reason));
  perform public.mark_catalog_dirty(); return v_id;
end;
$$;

create or replace function public.change_species_lifecycle(p_species_id uuid, p_expected_revision integer, p_lifecycle public.species_lifecycle, p_reason text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_actor uuid := public.require_editor(); v_species public.species; v_payload jsonb; v_next integer; v_previous_revision_id uuid; v_new_revision_id uuid;
begin
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required'; end if;
  select * into v_species from public.species where id = p_species_id for update;
  if not found then raise exception 'species_not_found'; end if;
  if v_species.current_revision <> p_expected_revision then raise exception 'revision_conflict'; end if;
  select id, payload into v_previous_revision_id, v_payload from public.species_revisions where species_id = p_species_id and revision = v_species.current_revision;
  v_next := v_species.current_revision + 1;
  insert into public.species_revisions(species_id, revision, payload, edited_by, reason) values (p_species_id, v_next, v_payload, v_actor, p_reason) returning id into v_new_revision_id;
  insert into public.species_field_sources(revision_id, field_path, source_id, note)
  select v_new_revision_id, field_path, source_id, note from public.species_field_sources where revision_id = v_previous_revision_id;
  update public.species set lifecycle = p_lifecycle, retired_reason = case when p_lifecycle = 'retired' then p_reason else null end, current_revision = v_next, updated_at = now() where id = p_species_id;
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, payload) values (v_actor, case when p_lifecycle = 'retired' then 'species.retired' else 'species.restored' end, 'species', p_species_id::text, jsonb_build_object('revision', v_next, 'reason', p_reason));
  perform public.mark_catalog_dirty();
end;
$$;

create or replace function public.retire_species(p_species_id uuid, p_expected_revision integer, p_reason text)
returns void language sql security definer set search_path = public as $$ select public.change_species_lifecycle(p_species_id, p_expected_revision, 'retired', p_reason) $$;
create or replace function public.restore_species(p_species_id uuid, p_expected_revision integer, p_reason text)
returns void language sql security definer set search_path = public as $$ select public.change_species_lifecycle(p_species_id, p_expected_revision, 'active', p_reason) $$;

create or replace function public.validate_revision(p_species_id uuid, p_expected_revision integer)
returns void language plpgsql security definer set search_path = public
as $$
declare v_actor uuid := public.require_editor(); v_current integer;
begin
  select current_revision into v_current from public.species where id = p_species_id for update;
  if not found then raise exception 'species_not_found'; end if;
  if v_current <> p_expected_revision then raise exception 'revision_conflict'; end if;
  update public.species_revisions set validation_state = 'validated', validated_by = v_actor, validated_at = now() where species_id = p_species_id and revision = v_current;
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, payload) values (v_actor, 'species.validated', 'species', p_species_id::text, jsonb_build_object('revision', v_current));
end;
$$;

create or replace function public.rollback_revision(p_species_id uuid, p_revision integer, p_expected_revision integer, p_reason text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_payload jsonb; v_code text;
begin
  perform public.require_editor();
  select payload into v_payload from public.species_revisions where species_id = p_species_id and revision = p_revision;
  if not found then raise exception 'revision_not_found'; end if;
  select catalog_code into v_code from public.species where id = p_species_id;
  perform public.save_species(p_species_id, v_code, v_payload, p_expected_revision, coalesce(nullif(p_reason, ''), format('Restauración de revisión %s', p_revision)));
end;
$$;

create or replace function public.create_media_asset(p_species_id uuid, p_kind public.media_kind, p_author text, p_license public.media_license, p_source_url text, p_evidence_key text, p_incoming_key text, p_terms_version text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_actor uuid := public.require_editor(); v_asset uuid; v_job uuid;
begin
  if p_incoming_key not like (v_actor::text || '/%') then raise exception 'invalid_incoming_key'; end if;
  if p_license = 'permission' and p_evidence_key is null then raise exception 'permission_evidence_required'; end if;
  insert into public.media_assets(species_id, kind, incoming_key, evidence_key, author, license, source_url, terms_version, uploaded_by)
  values (p_species_id, p_kind, p_incoming_key, p_evidence_key, trim(p_author), p_license, p_source_url, p_terms_version, v_actor) returning id into v_asset;
  insert into public.media_jobs(media_asset_id, requested_by) values (v_asset, v_actor) returning id into v_job;
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, payload) values (v_actor, 'media.uploaded', 'media', v_asset::text, jsonb_build_object('kind', p_kind, 'license', p_license));
  return v_job;
end;
$$;

create or replace function public.request_publish()
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_actor uuid := public.require_editor(); v_dirty boolean; v_release uuid; v_version bigint;
begin
  select dirty into v_dirty from public.catalog_state where singleton for update;
  if not v_dirty then raise exception 'catalog_not_dirty'; end if;
  select id into v_release from public.catalog_releases where status in ('pending', 'building') order by requested_at desc limit 1;
  if v_release is not null then return v_release; end if;
  select coalesce(max(data_version), 0) + 1 into v_version from public.catalog_releases;
  insert into public.catalog_releases(data_version, requested_by, source_revision) values (v_version, v_actor, (select max(id) from public.audit_events)) returning id into v_release;
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, payload) values (v_actor, 'catalog.publish_requested', 'release', v_release::text, jsonb_build_object('data_version', v_version));
  return v_release;
end;
$$;

create view public.species_current as
select s.id, s.catalog_code, s.lifecycle, s.current_revision as revision, r.validation_state,
  validator.display_name as validated_by_name, r.validated_at, r.payload, s.updated_at,
  editor.display_name as updated_by_name, r.payload->'taxonomy'->>'class' as taxonomic_class,
  coalesce(r.payload->'commonNames'->>0, r.payload->>'scientificName') as display_name,
  concat_ws(' ', r.payload->>'scientificName', r.payload->'commonNames', r.payload->'taxonomy'->>'family', r.payload->'taxonomy'->>'genus') as search_text,
  nullif(r.payload->>'description', '') is not null as has_description,
  (select case when m.thumbnail_key is not null then '/m/' || m.id || '/thumb' else m.external_url end from public.media_assets m where m.species_id = s.id and m.kind = 'image' and m.state = 'ready' order by m.created_at desc limit 1) as image_url,
  exists(select 1 from public.media_assets m where m.species_id = s.id and m.kind = 'audio' and m.state = 'ready') as has_audio
from public.species s join public.species_revisions r on r.species_id = s.id and r.revision = s.current_revision
join public.profiles editor on editor.id = r.edited_by left join public.profiles validator on validator.id = r.validated_by
where public.has_editor_access();

create view public.species_revision_history as
select r.*, editor.display_name as edited_by_name, validator.display_name as validated_by_name
from public.species_revisions r join public.profiles editor on editor.id = r.edited_by
left join public.profiles validator on validator.id = r.validated_by where public.has_editor_access();

create view public.media_queue as
select m.id, m.species_id, coalesce(r.payload->'commonNames'->>0, r.payload->>'scientificName') as species_name,
  m.kind, m.state, m.author, coalesce(m.original_license, m.license::text) as license, m.source_url, uploader.display_name as uploaded_by_name,
  m.created_at, j.id as job_id, coalesce(m.processing_error, j.error) as error
from public.media_assets m join public.species s on s.id = m.species_id
join public.species_revisions r on r.species_id = s.id and r.revision = s.current_revision
join public.profiles uploader on uploader.id = m.uploaded_by left join lateral
  (select id, error from public.media_jobs where media_asset_id = m.id order by created_at desc limit 1) j on true
where public.has_editor_access();

create view public.catalog_release_history as
select c.*, p.display_name as requested_by_name from public.catalog_releases c join public.profiles p on p.id = c.requested_by where public.has_editor_access();

create view public.admin_profiles as
select p.id, p.display_name, u.email, p.role, p.is_active, p.mfa_required
from public.profiles p join auth.users u on u.id = p.id where public.has_admin_access();

create view public.dashboard_stats as
select
  (select count(*) from public.species where lifecycle = 'active')::integer as active_species,
  (select count(*) from public.species where lifecycle = 'retired')::integer as retired_species,
  (select count(*) from public.species_current where validation_state <> 'validated')::integer as unreviewed_species,
  (select count(distinct species_id) from public.media_assets where kind = 'image' and state = 'ready')::integer as with_image,
  (select count(distinct species_id) from public.media_assets where kind = 'audio' and state = 'ready')::integer as with_audio,
  (select count(*) from public.media_jobs where state in ('incoming', 'processing'))::integer as pending_media,
  (select dirty_changes from public.catalog_state where singleton) as dirty_changes,
  (select last_release_version from public.catalog_state where singleton) as last_release,
  (select last_published_at from public.catalog_state where singleton) as last_published_at
where public.has_editor_access();

create view public.public_media_routes as
select id as asset_id, species_id, kind, main_key, thumbnail_key, app_audio_key, external_url, checksum_sha256
from public.media_assets where state = 'ready';

alter table public.profiles enable row level security;
alter table public.species enable row level security;
alter table public.species_revisions enable row level security;
alter table public.sources enable row level security;
alter table public.species_field_sources enable row level security;
alter table public.media_assets enable row level security;
alter table public.media_jobs enable row level security;
alter table public.catalog_state enable row level security;
alter table public.catalog_releases enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.has_admin_access());
create policy species_read on public.species for select to authenticated using (public.has_editor_access());
create policy revisions_read on public.species_revisions for select to authenticated using (public.has_editor_access());
create policy sources_read on public.sources for select to authenticated using (public.has_editor_access());
create policy field_sources_read on public.species_field_sources for select to authenticated using (public.has_editor_access());
create policy media_read on public.media_assets for select to authenticated using (public.has_editor_access());
create policy media_jobs_read on public.media_jobs for select to authenticated using (public.has_editor_access());
create policy catalog_state_read on public.catalog_state for select to authenticated using (public.has_editor_access());
create policy releases_read on public.catalog_releases for select to authenticated using (public.has_editor_access());
create policy audit_read on public.audit_events for select to authenticated using (public.has_editor_access());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('incoming', 'incoming', false, 47185920, array['image/jpeg','image/png','image/webp','image/heic','audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/flac','audio/ogg']),
  ('media-public', 'media-public', true, 12582912, array['image/webp','audio/mpeg']),
  ('media-evidence', 'media-evidence', false, 10485760, array['image/jpeg','image/png','application/pdf','text/plain','message/rfc822']),
  ('catalog-public', 'catalog-public', true, 52428800, array['application/json','application/octet-stream','application/gzip'])
on conflict (id) do nothing;

create policy incoming_insert_own on storage.objects for insert to authenticated with check (bucket_id = 'incoming' and (storage.foldername(name))[1] = auth.uid()::text and public.has_editor_access());
create policy incoming_read_own on storage.objects for select to authenticated using (bucket_id = 'incoming' and (storage.foldername(name))[1] = auth.uid()::text and public.has_editor_access());
create policy evidence_insert_own on storage.objects for insert to authenticated with check (bucket_id = 'media-evidence' and (storage.foldername(name))[1] = auth.uid()::text and public.has_editor_access());
create policy evidence_read_own_or_admin on storage.objects for select to authenticated using (bucket_id = 'media-evidence' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_admin_access()));
create policy media_public_read on storage.objects for select to anon, authenticated using (bucket_id in ('media-public', 'catalog-public'));

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select (id, display_name, role, is_active, mfa_required) on public.profiles to authenticated;
grant select on public.species_current, public.species_revision_history, public.media_queue, public.catalog_release_history, public.dashboard_stats to authenticated;
grant select on public.admin_profiles to authenticated;
grant select on public.public_media_routes to anon, authenticated;
grant execute on function public.has_editor_access(), public.has_admin_access() to anon, authenticated;
grant execute on function public.save_species(uuid,text,jsonb,integer,text), public.retire_species(uuid,integer,text), public.restore_species(uuid,integer,text), public.validate_revision(uuid,integer), public.rollback_revision(uuid,integer,integer,text), public.create_media_asset(uuid,public.media_kind,text,public.media_license,text,text,text,text), public.request_publish() to authenticated;

comment on table public.species is 'Stable Natura UY identity and lifecycle; editable content lives in immutable revisions.';
comment on table public.media_assets is 'Rights-aware media metadata. Originals are temporary; verified derivatives live in two providers.';
