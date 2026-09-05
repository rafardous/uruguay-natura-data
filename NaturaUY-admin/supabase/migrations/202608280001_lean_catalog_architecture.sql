-- Natura UY: cutover from the empty experimental schema to the lean
-- editorial model. This migration is intentionally valid only before the
-- initial catalogue import.

do $$
begin
  if exists (select 1 from public.species)
    or exists (select 1 from public.species_revisions)
    or exists (select 1 from public.media_assets)
    or exists (select 1 from public.mobile_favorites)
    or exists (select 1 from public.mobile_quiz_records)
    or exists (select 1 from public.user_reports)
    or exists (select 1 from storage.objects where bucket_id in ('incoming', 'media-evidence'))
  then
    raise exception 'lean_catalog_requires_empty_experimental_project';
  end if;
end $$;

-- Old catalogue contracts. Auth users and their generic profile survive.
drop view if exists public.species_current cascade;
drop view if exists public.species_revision_history cascade;
drop view if exists public.media_queue cascade;
drop view if exists public.catalog_release_history cascade;
drop view if exists public.admin_profiles cascade;
drop view if exists public.dashboard_stats cascade;
drop view if exists public.public_media_routes cascade;
drop view if exists public.editor_report_queue cascade;
drop table if exists public.species_field_sources cascade;
drop table if exists public.sources cascade;
drop table if exists public.species_revisions cascade;
drop table if exists public.media_jobs cascade;
drop table if exists public.media_assets cascade;
drop table if exists public.mobile_favorites cascade;
drop table if exists public.mobile_quiz_records cascade;
drop table if exists public.user_reports cascade;
drop table if exists public.catalog_state cascade;
drop table if exists public.catalog_releases cascade;
drop table if exists public.audit_events cascade;
drop table if exists public.species cascade;

-- A single access table represents both a pending email invitation and an
-- accepted editorial membership. Normal mobile users never have a row here.
create table public.editor_access (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (position('@' in email) > 1),
  user_id uuid unique references public.profiles(id) on delete cascade,
  role text not null check (role in ('collaborator', 'admin')),
  active boolean not null default true,
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz
);

insert into public.editor_access(email, user_id, role, active, accepted_at)
select lower(auth_user.email), membership.user_id, membership.role::text,
       membership.is_active, now()
from public.editor_memberships membership
join auth.users auth_user on auth_user.id = membership.user_id
on conflict (email) do nothing;
drop table if exists public.editor_memberships cascade;
drop table if exists public.editor_email_invitations cascade;

alter table public.profiles rename column id to user_id;
alter table public.profiles drop column role;
alter table public.profiles drop column is_active;
alter table public.profiles drop column mfa_required;
alter table public.profiles drop column updated_at;
alter table public.profiles alter column display_name set default 'Usuario Natura UY';

create table public.species (
  id uuid primary key default gen_random_uuid(),
  catalog_code text not null unique check (catalog_code ~ '^[A-Za-z0-9_-]{2,80}$'),
  scientific_name text not null check (length(trim(scientific_name)) >= 3),
  accepted_name text,
  common_name text not null check (length(trim(common_name)) >= 2),
  alternate_common_names text[] not null default '{}',
  kingdom text not null default 'Animalia', phylum text not null default '', class text not null default '',
  order_name text not null default '', family text not null default '', genus text not null default '',
  origin text not null default 'unknown' check (origin in ('native','introduced','unknown')),
  establishment text not null default 'uncertain' check (establishment in ('established','casual','uncertain')),
  seasonality text not null default 'unknown' check (seasonality in ('resident','migratory','occasional','unknown')),
  presence_certainty text not null default 'uncertain' check (presence_certainty in ('confirmed','probable','uncertain')),
  abundance_status text, conservation_system text, conservation_category text, conservation_label text,
  conservation_source text, conservation_rank smallint not null default 0 check (conservation_rank between 0 and 3),
  conservation_assessed_at date, description text not null default '', habitat text[] not null default '{}',
  diet text[] not null default '{}', size text, relevant_note text,
  field_sources jsonb not null default '{}'::jsonb check (jsonb_typeof(field_sources) = 'object'),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.species_changes (
  id uuid primary key default gen_random_uuid(),
  species_id uuid references public.species(id) on delete restrict,
  change_type text not null check (change_type in ('create','update','archive','media')),
  proposed_values jsonb not null check (jsonb_typeof(proposed_values) = 'object'),
  before_values jsonb not null default '{}'::jsonb,
  after_values jsonb not null default '{}'::jsonb,
  base_updated_at timestamptz,
  status text not null default 'pending' check (status in ('pending','approved','rejected','archived')),
  proposed_by uuid not null references public.profiles(user_id) on delete restrict,
  reviewed_by uuid references public.profiles(user_id) on delete restrict,
  comment text, created_at timestamptz not null default now(), reviewed_at timestamptz,
  self_validation_confirmed boolean not null default false
);

create table public.species_media (
  id uuid primary key default gen_random_uuid(),
  species_id uuid references public.species(id) on delete restrict,
  change_id uuid references public.species_changes(id) on delete restrict,
  type text not null check (type in ('image','audio')),
  ordinal smallint not null default 1 check (ordinal between 1 and 2),
  is_primary boolean not null default false,
  status text not null default 'reserved' check (status in ('reserved','processing','ready','approved','rejected','failed','archived')),
  incoming_path text unique, storage_path text unique, thumbnail_path text unique, evidence_path text,
  author text not null check (length(trim(author)) >= 2),
  license text not null check (license in ('CC0','CC-BY-4.0','permission','legacy')),
  source text not null check (length(trim(source)) >= 2), source_url text, original_filename text,
  clip_start_seconds numeric, clip_duration_seconds numeric check (clip_duration_seconds is null or clip_duration_seconds > 0 and clip_duration_seconds <= 15),
  checksum_sha256 text, uploaded_by uuid not null references public.profiles(user_id) on delete restrict,
  processing_error text, created_at timestamptz not null default now(), processed_at timestamptz,
  check ((type = 'image' and clip_start_seconds is null and clip_duration_seconds is null) or type = 'audio'),
  check (license <> 'permission' or evidence_path is not null),
  check (species_id is not null or change_id is not null)
);

create table public.catalog_releases (
  id uuid primary key default gen_random_uuid(), version bigint not null unique,
  schema_version integer not null default 6, status text not null default 'pending' check (status in ('pending','building','published','failed')),
  requested_by uuid not null references public.profiles(user_id) on delete restrict,
  requested_at timestamptz not null default now(), started_at timestamptz, published_at timestamptz,
  species_count integer, database_size bigint, database_url text, database_sha256 text,
  quality_report_url text, github_release_url text, min_app_version text not null default '1.0.0', error text
);

create table public.favorites (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  species_id uuid not null references public.species(id) on delete restrict,
  updated_at bigint not null check (updated_at > 0), is_favorite boolean not null default true,
  primary key (user_id, species_id)
);
create table public.game_stats (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  mode text not null check (mode in ('classic','timed','survival')),
  scope text not null check (scope ~ '^[a-z0-9_:-]{2,80}$'),
  best_score integer not null default 0 check (best_score >= 0), best_streak integer not null default 0 check (best_streak >= 0),
  games_played integer not null default 0 check (games_played >= 0), updated_at bigint not null,
  primary key (user_id, mode, scope)
);
create table public.feedback (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(user_id) on delete restrict,
  type text not null check (type in ('bug','suggestion','review')), species_id uuid references public.species(id) on delete set null,
  message text not null check (length(trim(message)) between 10 and 4000), app_version text,
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  resolved_by uuid references public.profiles(user_id), resolution_note text, created_at timestamptz not null default now(), resolved_at timestamptz
);

create index species_search_idx on public.species(scientific_name, common_name);
create index species_class_idx on public.species(class, family);
create index changes_queue_idx on public.species_changes(status, created_at);
create index media_queue_idx on public.species_media(status, type, created_at);
create index feedback_queue_idx on public.feedback(status, created_at);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(user_id, display_name, public_alias, avatar_url)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(coalesce(new.email, new.id::text), '@', 1)), null, nullif(trim(new.raw_user_meta_data->>'avatar_url'), ''))
  on conflict (user_id) do nothing;
  update public.editor_access set user_id = new.id, accepted_at = now()
  where user_id is null and lower(email) = lower(new.email);
  return new;
end $$;

-- Email editorial is invite-only. Google accounts remain available for the
-- mobile application; an account only becomes editorial through editor_access.
create or replace function public.hook_restrict_new_auth_user(event jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare v_provider text := event->'user'->'app_metadata'->>'provider'; v_email text := lower(trim(coalesce(event->'user'->>'email','')));
begin
  if v_provider = 'google' then return '{}'::jsonb; end if;
  if v_provider = 'email' and exists(select 1 from public.editor_access where email=v_email and active) then return '{}'::jsonb; end if;
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','El registro por correo es únicamente por invitación.'));
end $$;

create or replace function public.has_editor_access() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.editor_access where user_id = auth.uid() and active)
$$;
create or replace function public.has_admin_access() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.editor_access where user_id = auth.uid() and active and role = 'admin') and auth.jwt()->>'aal' = 'aal2'
$$;
create or replace function public.require_editor() returns uuid language plpgsql stable security definer set search_path = public as $$
begin if auth.uid() is null or not public.has_editor_access() then raise exception 'editor_access_required' using errcode='42501'; end if; return auth.uid(); end $$;
create or replace function public.require_admin() returns uuid language plpgsql stable security definer set search_path = public as $$
begin if auth.uid() is null or not public.has_admin_access() then raise exception 'admin_access_required' using errcode='42501'; end if; return auth.uid(); end $$;

create or replace function public.submit_species_change(p_species_id uuid, p_change_type text, p_proposed_values jsonb, p_comment text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.require_editor(); v_id uuid; v_species public.species;
begin
  if p_change_type not in ('create','update','archive','media') or jsonb_typeof(p_proposed_values) <> 'object' then raise exception 'invalid_change'; end if;
  if p_change_type = 'create' and p_species_id is not null then raise exception 'create_change_cannot_target_species'; end if;
  if p_change_type <> 'create' then select * into v_species from public.species where id=p_species_id; if not found then raise exception 'species_not_found'; end if; end if;
  insert into public.species_changes(species_id,change_type,proposed_values,base_updated_at,proposed_by,comment)
  values(p_species_id,p_change_type,p_proposed_values,case when p_species_id is null then null else v_species.updated_at end,v_actor,nullif(trim(p_comment),'')) returning id into v_id;
  return v_id;
end $$;

create or replace function public.review_species_change(p_change_id uuid, p_approve boolean, p_confirm_self_validation boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.require_editor(); v_change public.species_changes; v_species public.species; v_before jsonb := '{}'::jsonb; v_species_id uuid; v_patch jsonb;
begin
  select * into v_change from public.species_changes where id=p_change_id for update;
  if not found or v_change.status <> 'pending' then raise exception 'change_not_pending'; end if;
  if v_change.proposed_by=v_actor and not p_confirm_self_validation then raise exception 'self_validation_confirmation_required'; end if;
  if not p_approve then update public.species_changes set status='rejected',reviewed_by=v_actor,reviewed_at=now(),self_validation_confirmed=p_confirm_self_validation where id=p_change_id; return coalesce(v_change.species_id,p_change_id); end if;
  if v_change.change_type='create' then
    insert into public.species(catalog_code,scientific_name,common_name,accepted_name,description,field_sources,habitat,diet)
    values(trim(v_change.proposed_values->>'catalog_code'),trim(v_change.proposed_values->>'scientific_name'),trim(v_change.proposed_values->>'common_name'),nullif(trim(v_change.proposed_values->>'accepted_name'),''),coalesce(v_change.proposed_values->>'description',''),coalesce(v_change.proposed_values->'field_sources','{}'::jsonb),coalesce(array(select jsonb_array_elements_text(v_change.proposed_values->'habitat')),'{}'),coalesce(array(select jsonb_array_elements_text(v_change.proposed_values->'diet')),'{}')) returning * into v_species;
    v_species_id:=v_species.id;
  else
    select * into v_species from public.species where id=v_change.species_id for update;
    if v_change.base_updated_at <> v_species.updated_at then raise exception 'species_change_conflict'; end if;
    v_before:=to_jsonb(v_species);
    v_patch:=v_change.proposed_values;
    update public.species set
      scientific_name=coalesce(nullif(trim(v_patch->>'scientific_name'),''),scientific_name), common_name=coalesce(nullif(trim(v_patch->>'common_name'),''),common_name),
      accepted_name=coalesce(nullif(trim(v_patch->>'accepted_name'),''),accepted_name), description=coalesce(v_patch->>'description',description),
      relevant_note=coalesce(v_patch->>'relevant_note',relevant_note), field_sources=coalesce(v_patch->'field_sources',field_sources),
      status=case when v_change.change_type='archive' then 'archived' else status end, updated_at=now() where id=v_species.id returning * into v_species;
    v_species_id:=v_species.id;
  end if;
  if exists(select 1 from public.species_media where change_id=p_change_id and status not in ('ready','approved')) then raise exception 'media_not_ready'; end if;
  if (select count(*) from public.species_media where species_id=v_species_id and type='image' and status='approved') + (select count(*) from public.species_media where change_id=p_change_id and type='image') > 2 then raise exception 'image_limit_exceeded'; end if;
  if (select count(*) from public.species_media where species_id=v_species_id and type='audio' and status='approved') + (select count(*) from public.species_media where change_id=p_change_id and type='audio') > 1 then raise exception 'audio_limit_exceeded'; end if;
  update public.species_media set species_id=v_species_id,status='approved' where change_id=p_change_id and status='ready';
  update public.species_changes set status='approved', species_id=v_species_id, before_values=v_before, after_values=coalesce(to_jsonb(v_species),'{}'::jsonb), reviewed_by=v_actor, reviewed_at=now(), self_validation_confirmed=p_confirm_self_validation where id=p_change_id;
  return v_species_id;
end $$;

create or replace function public.reserve_species_media_upload(p_species_id uuid, p_change_id uuid, p_type text, p_author text, p_license text, p_source text, p_source_url text, p_original_filename text, p_is_primary boolean default false, p_evidence_path text default null)
returns table(media_id uuid, incoming_path text) language plpgsql security definer set search_path = public as $$
declare v_actor uuid := public.require_editor(); v_ordinal smallint; v_id uuid; v_path text;
begin
  if p_type not in ('image','audio') or p_license not in ('CC0','CC-BY-4.0','permission','legacy') then raise exception 'invalid_media'; end if;
  if p_species_id is null and p_change_id is null then raise exception 'media_target_required'; end if;
  if p_license='permission' and coalesce(p_evidence_path,'')='' then raise exception 'permission_evidence_required'; end if;
  select coalesce(max(ordinal),0)+1 into v_ordinal from public.species_media where (species_id is not distinct from p_species_id) and (change_id is not distinct from p_change_id) and type=p_type and status not in ('rejected','archived');
  if (p_type='image' and v_ordinal>2) or (p_type='audio' and v_ordinal>1) then raise exception 'media_limit_exceeded'; end if;
  insert into public.species_media(species_id,change_id,type,ordinal,is_primary,author,license,source,source_url,original_filename,evidence_path,uploaded_by,incoming_path)
  values(p_species_id,p_change_id,p_type,v_ordinal,p_is_primary,trim(p_author),p_license,trim(p_source),nullif(trim(p_source_url),''),nullif(trim(p_original_filename),''),p_evidence_path,v_actor,format('%s/%s',v_actor,gen_random_uuid())) returning id,incoming_path into v_id,v_path;
  media_id:=v_id; incoming_path:=v_path; return next;
end $$;

create or replace function public.request_catalog_publish() returns uuid language plpgsql security definer set search_path = public as $$
declare v_actor uuid:=public.require_admin(); v_id uuid; v_version bigint;
begin
  if not exists(select 1 from public.species_changes c where c.status='approved' and c.reviewed_at > coalesce((select max(published_at) from public.catalog_releases where status='published'),'epoch'::timestamptz)) then raise exception 'catalog_not_dirty'; end if;
  select id into v_id from public.catalog_releases where status in ('pending','building') order by requested_at desc limit 1; if v_id is not null then return v_id; end if;
  select coalesce(max(version),0)+1 into v_version from public.catalog_releases;
  insert into public.catalog_releases(version,requested_by) values(v_version,v_actor) returning id into v_id; return v_id;
end $$;

create or replace function public.set_public_alias(p_alias text) returns text language plpgsql security definer set search_path = public as $$
begin if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if; if trim(p_alias) !~ '^[A-Za-z0-9_]{3,24}$' then raise exception 'invalid_alias'; end if; update public.profiles set public_alias=trim(p_alias) where user_id=auth.uid(); return trim(p_alias); end $$;
create or replace function public.sync_favorites(p_changes jsonb default '[]'::jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_item jsonb; v_actor uuid:=auth.uid();
begin if v_actor is null or jsonb_typeof(p_changes)<>'array' then raise exception 'invalid_favorites'; end if;
for v_item in select value from jsonb_array_elements(p_changes) loop
  insert into public.favorites(user_id,species_id,is_favorite,updated_at) select v_actor,s.id,coalesce((v_item->>'isFavorite')::boolean,true),(v_item->>'updatedAt')::bigint from public.species s where s.catalog_code=v_item->>'catalogCode'
  on conflict(user_id,species_id) do update set is_favorite=excluded.is_favorite,updated_at=greatest(public.favorites.updated_at,excluded.updated_at);
end loop;
return coalesce((select jsonb_agg(jsonb_build_object('catalogCode',s.catalog_code,'isFavorite',f.is_favorite,'updatedAt',f.updated_at)) from public.favorites f join public.species s on s.id=f.species_id where f.user_id=v_actor),'[]'::jsonb); end $$;
create or replace function public.record_game_result(p_mode text,p_scope text,p_score integer,p_streak integer,p_updated_at bigint) returns void language plpgsql security definer set search_path=public as $$
begin if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if; insert into public.game_stats(user_id,mode,scope,best_score,best_streak,games_played,updated_at) values(auth.uid(),p_mode,p_scope,greatest(p_score,0),greatest(p_streak,0),1,p_updated_at) on conflict(user_id,mode,scope) do update set best_score=greatest(game_stats.best_score,excluded.best_score),best_streak=greatest(game_stats.best_streak,excluded.best_streak),games_played=game_stats.games_played+1,updated_at=greatest(game_stats.updated_at,excluded.updated_at); end $$;
create or replace function public.get_game_leaderboard(p_mode_arg text,p_scope_arg text,p_limit integer default 50) returns table(rank bigint,public_alias text,best_score integer,best_streak integer) language sql stable security definer set search_path=public as $$ select row_number() over(order by g.best_score desc,g.best_streak desc),p.public_alias,g.best_score,g.best_streak from public.game_stats g join public.profiles p on p.user_id=g.user_id where g.mode=p_mode_arg and g.scope=p_scope_arg and p.public_alias is not null order by g.best_score desc,g.best_streak desc limit least(greatest(p_limit,1),100) $$;
create or replace function public.submit_feedback(p_type text,p_message text,p_catalog_code text default null,p_app_version text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; begin if auth.uid() is null or p_type not in ('bug','suggestion','review') then raise exception 'invalid_feedback' using errcode='42501'; end if; insert into public.feedback(user_id,type,species_id,message,app_version) values(auth.uid(),p_type,(select id from public.species where catalog_code=p_catalog_code),trim(p_message),nullif(trim(p_app_version),'')) returning id into v_id; return v_id; end $$;
create or replace function public.resolve_feedback(p_id uuid,p_status text,p_note text default null) returns void language plpgsql security definer set search_path=public as $$
begin perform public.require_editor(); if p_status not in ('reviewing','resolved','dismissed') then raise exception 'invalid_feedback_status'; end if; update public.feedback set status=p_status,resolution_note=nullif(trim(p_note),''),resolved_by=auth.uid(),resolved_at=case when p_status in ('resolved','dismissed') then now() else null end where id=p_id; if not found then raise exception 'feedback_not_found'; end if; end $$;

alter table public.profiles enable row level security; alter table public.editor_access enable row level security; alter table public.species enable row level security; alter table public.species_changes enable row level security; alter table public.species_media enable row level security; alter table public.catalog_releases enable row level security; alter table public.favorites enable row level security; alter table public.game_stats enable row level security; alter table public.feedback enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(user_id=auth.uid() or public.has_editor_access());
create policy editor_access_read on public.editor_access for select to authenticated using(user_id=auth.uid() or public.has_admin_access());
create policy species_public_read on public.species for select to anon,authenticated using(status='active' or public.has_editor_access());
create policy changes_editor_read on public.species_changes for select to authenticated using(public.has_editor_access());
create policy media_read on public.species_media for select to anon,authenticated using(status='approved' or public.has_editor_access());
create policy releases_editor_read on public.catalog_releases for select to authenticated using(public.has_editor_access());
create policy favorites_own on public.favorites for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy game_stats_own on public.game_stats for select to authenticated using(user_id=auth.uid());
create policy feedback_read on public.feedback for select to authenticated using(user_id=auth.uid() or public.has_editor_access());

create view public.species_editor with (security_invoker=true) as select s.*, coalesce(jsonb_agg(jsonb_build_object('id',m.id,'type',m.type,'ordinal',m.ordinal,'is_primary',m.is_primary,'status',m.status,'storage_path',m.storage_path,'thumbnail_path',m.thumbnail_path,'author',m.author,'license',m.license,'source',m.source,'source_url',m.source_url) order by m.type,m.ordinal) filter(where m.id is not null),'[]'::jsonb) as media from public.species s left join public.species_media m on m.species_id=s.id and m.status='approved' group by s.id;
create view public.change_request_queue with (security_invoker=true) as select c.*,p.display_name as proposed_by_name,r.display_name as reviewed_by_name from public.species_changes c join public.profiles p on p.user_id=c.proposed_by left join public.profiles r on r.user_id=c.reviewed_by;
create view public.media_queue with (security_invoker=true) as select m.*,coalesce(s.common_name,c.proposed_values->>'common_name') as species_name,p.display_name as uploaded_by_name from public.species_media m left join public.species s on s.id=m.species_id left join public.species_changes c on c.id=m.change_id join public.profiles p on p.user_id=m.uploaded_by;
create view public.catalog_release_history with (security_invoker=true) as select * from public.catalog_releases;
create view public.feedback_queue with (security_invoker=true) as select f.*,p.display_name as reporter_name,s.catalog_code from public.feedback f join public.profiles p on p.user_id=f.user_id left join public.species s on s.id=f.species_id;
create view public.admin_profiles with (security_invoker=true) as select p.user_id,p.display_name,a.email,a.role,a.active from public.editor_access a join public.profiles p on p.user_id=a.user_id where public.has_admin_access();
create view public.dashboard_stats with (security_invoker=true) as select
  count(*) filter(where s.status='active')::integer as active_species,
  count(*) filter(where s.status='archived')::integer as archived_species,
  (select count(*)::integer from public.species_changes where status='pending') as pending_changes,
  count(*) filter(where exists(select 1 from public.species_media m where m.species_id=s.id and m.type='image' and m.status='approved'))::integer as with_image,
  count(*) filter(where exists(select 1 from public.species_media m where m.species_id=s.id and m.type='audio' and m.status='approved'))::integer as with_audio,
  (select count(*)::integer from public.species_media where status in ('reserved','processing','ready')) as pending_media,
  exists(select 1 from public.species_changes c where c.status='approved' and c.reviewed_at > coalesce((select max(r.published_at) from public.catalog_releases r where r.status='published'),'epoch'::timestamptz)) as dirty_changes,
  (select max(version) from public.catalog_releases where status='published') as last_release_version,
  (select max(published_at) from public.catalog_releases where status='published') as last_published_at
from public.species s;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('incoming','incoming',false,20971520,array['image/webp','audio/wav']),
 ('media-public','media-public',true,12582912,array['image/webp','audio/mpeg']),
 ('media-evidence','media-evidence',false,10485760,array['image/jpeg','image/png','application/pdf','text/plain']),
 ('catalog-public','catalog-public',true,52428800,array['application/json']) on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists incoming_insert_own on storage.objects; drop policy if exists incoming_read_own on storage.objects; drop policy if exists evidence_insert_own on storage.objects; drop policy if exists evidence_read_own_or_admin on storage.objects; drop policy if exists media_public_read on storage.objects;
create policy incoming_insert_reserved on storage.objects for insert to authenticated with check(bucket_id='incoming' and public.has_editor_access() and exists(select 1 from public.species_media m where m.incoming_path=name and m.uploaded_by=auth.uid() and m.status='reserved'));
create policy incoming_read_reserved on storage.objects for select to authenticated using(bucket_id='incoming' and public.has_editor_access() and exists(select 1 from public.species_media m where m.incoming_path=name and m.uploaded_by=auth.uid()));
create policy evidence_insert_editor on storage.objects for insert to authenticated with check(bucket_id='media-evidence' and public.has_editor_access());
create policy evidence_read_editor on storage.objects for select to authenticated using(bucket_id='media-evidence' and public.has_editor_access());
create policy public_media_read on storage.objects for select to anon,authenticated using(bucket_id in ('media-public','catalog-public'));

-- A deliberately conservative ceiling leaves room below the 1 GB free tier.
-- Storage reports size in object metadata; an overwrite replaces its own size.
create or replace function public.enforce_natura_storage_budget() returns trigger language plpgsql security definer set search_path = public as $$
declare v_used bigint; v_next bigint := coalesce((new.metadata->>'size')::bigint,0); v_previous bigint := coalesce((old.metadata->>'size')::bigint,0);
begin
  if new.bucket_id not in ('incoming','media-public','media-evidence','catalog-public') then return new; end if;
  select coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0) into v_used from storage.objects where bucket_id in ('incoming','media-public','media-evidence','catalog-public');
  if v_used - case when tg_op='UPDATE' then v_previous else 0 end + v_next > 900*1024*1024 then raise exception 'storage_budget_exceeded'; end if;
  return new;
end $$;
drop trigger if exists enforce_natura_storage_budget on storage.objects;
create trigger enforce_natura_storage_budget before insert or update on storage.objects for each row execute function public.enforce_natura_storage_budget();

revoke all on all tables in schema public from anon,authenticated;
grant usage on schema public to anon,authenticated;
grant select on public.species to anon,authenticated;
grant select on public.species_editor,public.change_request_queue,public.media_queue,public.catalog_release_history,public.feedback_queue,public.admin_profiles,public.dashboard_stats to authenticated;
grant select on public.profiles,public.editor_access,public.species_changes,public.species_media,public.catalog_releases,public.favorites,public.game_stats,public.feedback to authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_restrict_new_auth_user(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_new_auth_user(jsonb) from public,anon,authenticated;
grant execute on function public.has_editor_access(),public.has_admin_access(),public.set_public_alias(text),public.sync_favorites(jsonb),public.record_game_result(text,text,integer,integer,bigint),public.get_game_leaderboard(text,text,integer),public.submit_feedback(text,text,text,text) to authenticated;
grant execute on function public.submit_species_change(uuid,text,jsonb,text),public.review_species_change(uuid,boolean,boolean),public.reserve_species_media_upload(uuid,uuid,text,text,text,text,text,text,boolean,text),public.request_catalog_publish(),public.resolve_feedback(uuid,text,text) to authenticated;
