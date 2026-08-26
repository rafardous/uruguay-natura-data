-- Separate a generic Natura UY identity from privileged editorial membership.
-- The foundation migration is intentionally kept intact; this migration can
-- upgrade an already-created local database as well as a fresh hosted project.

alter table public.profiles
  add column if not exists public_alias text,
  add column if not exists avatar_url text;

alter table public.profiles
  add constraint profiles_public_alias_format
  check (public_alias is null or public_alias ~ '^[A-Za-z0-9_]{3,24}$') not valid;

create unique index if not exists profiles_public_alias_unique
  on public.profiles (lower(public_alias))
  where public_alias is not null;

create table public.editor_memberships (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.app_role not null,
  is_active boolean not null default true,
  mfa_required boolean not null default false,
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role <> 'admin' or mfa_required)
);

-- Preserve any users created with the original editorial-only model.
insert into public.editor_memberships(user_id, role, is_active, mfa_required)
select id, role, is_active, (mfa_required or role = 'admin')
from public.profiles
on conflict (user_id) do nothing;

comment on column public.profiles.role is
  'Legacy compatibility column. Authorization uses editor_memberships.role.';
comment on column public.profiles.is_active is
  'Legacy compatibility column. Editorial access uses editor_memberships.is_active.';
comment on column public.profiles.mfa_required is
  'Legacy compatibility column. Editorial MFA uses editor_memberships.mfa_required.';
comment on table public.editor_memberships is
  'Invitation-only editorial privilege. A normal mobile account has no row here.';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(
    id, display_name, avatar_url,
    -- Required only while the legacy columns remain in the foundation schema.
    role, is_active, mfa_required
  ) values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      split_part(coalesce(new.email, new.id::text), '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data->>'avatar_url'), ''),
    'collaborator'::public.app_role,
    false,
    false
  )
  on conflict (id) do update set
    display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();
  return new;
end;
$$;

create or replace function public.has_editor_access()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1
    from public.editor_memberships membership
    where membership.user_id = auth.uid()
      and membership.is_active
      and (not membership.mfa_required or auth.jwt()->>'aal' = 'aal2')
  )
$$;

create or replace function public.has_admin_access()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1
    from public.editor_memberships membership
    where membership.user_id = auth.uid()
      and membership.is_active
      and membership.role = 'admin'
      and auth.jwt()->>'aal' = 'aal2'
  )
$$;

create or replace view public.admin_profiles as
select
  profile.id,
  profile.display_name,
  auth_user.email,
  membership.role,
  membership.is_active,
  membership.mfa_required
from public.editor_memberships membership
join public.profiles profile on profile.id = membership.user_id
join auth.users auth_user on auth_user.id = membership.user_id
where public.has_admin_access();

create type public.report_kind as enum ('data_error', 'app_bug');
create type public.report_state as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.mobile_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  catalog_code text not null check (catalog_code ~ '^[A-Za-z0-9_-]{2,80}$'),
  is_favorite boolean not null,
  client_updated_at bigint not null check (client_updated_at > 0),
  device_id text not null check (length(device_id) between 8 and 100),
  server_updated_at timestamptz not null default now(),
  primary key (user_id, catalog_code)
);

create table public.mobile_quiz_records (
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('classic', 'timed', 'survival')),
  scope text not null check (scope ~ '^[a-z0-9_:-]{2,80}$'),
  best_score integer not null default 0 check (best_score between 0 and 1000000),
  best_streak integer not null default 0 check (best_streak between 0 and 1000000),
  played_at bigint,
  client_updated_at bigint not null check (client_updated_at > 0),
  device_id text not null check (length(device_id) between 8 and 100),
  server_updated_at timestamptz not null default now(),
  primary key (user_id, mode, scope)
);

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  kind public.report_kind not null,
  catalog_code text,
  description text not null check (length(trim(description)) between 10 and 4000),
  app_version text not null check (length(app_version) between 1 and 40),
  platform text not null check (platform in ('android', 'ios', 'web')),
  state public.report_state not null default 'open',
  resolution_note text,
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_mobile_favorites_catalog
  on public.mobile_favorites(catalog_code) where is_favorite;
create index idx_mobile_quiz_leaderboard
  on public.mobile_quiz_records(mode, scope, best_score desc, best_streak desc);
create index idx_user_reports_state
  on public.user_reports(state, created_at desc);

create or replace function public.set_public_alias(p_alias text)
returns text language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_alias text := trim(coalesce(p_alias, ''));
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if v_alias !~ '^[A-Za-z0-9_]{3,24}$' then
    raise exception 'invalid_alias';
  end if;
  begin
    update public.profiles
    set public_alias = v_alias, updated_at = now()
    where id = v_actor;
  exception when unique_violation then
    raise exception 'alias_unavailable';
  end;
  return v_alias;
end;
$$;

create or replace function public.sync_mobile_state(
  p_device_id text,
  p_favorites jsonb default '[]'::jsonb,
  p_quiz_records jsonb default '[]'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_entry jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if length(coalesce(p_device_id, '')) not between 8 and 100 then
    raise exception 'invalid_device_id';
  end if;
  if jsonb_typeof(p_favorites) <> 'array' or jsonb_array_length(p_favorites) > 5000 then
    raise exception 'invalid_favorites_batch';
  end if;
  if jsonb_typeof(p_quiz_records) <> 'array' or jsonb_array_length(p_quiz_records) > 500 then
    raise exception 'invalid_quiz_batch';
  end if;

  for v_entry in select value from jsonb_array_elements(p_favorites) loop
    insert into public.mobile_favorites(
      user_id, catalog_code, is_favorite, client_updated_at, device_id
    ) values (
      v_actor,
      trim(v_entry->>'catalogCode'),
      coalesce((v_entry->>'isFavorite')::boolean, false),
      (v_entry->>'updatedAt')::bigint,
      p_device_id
    )
    on conflict (user_id, catalog_code) do update set
      is_favorite = excluded.is_favorite,
      client_updated_at = excluded.client_updated_at,
      device_id = excluded.device_id,
      server_updated_at = now()
    where excluded.client_updated_at >= public.mobile_favorites.client_updated_at;
  end loop;

  for v_entry in select value from jsonb_array_elements(p_quiz_records) loop
    insert into public.mobile_quiz_records(
      user_id, mode, scope, best_score, best_streak,
      played_at, client_updated_at, device_id
    ) values (
      v_actor,
      trim(v_entry->>'mode'),
      trim(v_entry->>'scope'),
      greatest(0, (v_entry->>'bestScore')::integer),
      greatest(0, (v_entry->>'bestStreak')::integer),
      nullif(v_entry->>'playedAt', '')::bigint,
      (v_entry->>'updatedAt')::bigint,
      p_device_id
    )
    on conflict (user_id, mode, scope) do update set
      best_score = greatest(public.mobile_quiz_records.best_score, excluded.best_score),
      best_streak = greatest(public.mobile_quiz_records.best_streak, excluded.best_streak),
      played_at = greatest(public.mobile_quiz_records.played_at, excluded.played_at),
      client_updated_at = greatest(public.mobile_quiz_records.client_updated_at, excluded.client_updated_at),
      device_id = case
        when excluded.client_updated_at >= public.mobile_quiz_records.client_updated_at then excluded.device_id
        else public.mobile_quiz_records.device_id
      end,
      server_updated_at = now();
  end loop;

  return jsonb_build_object(
    'favorites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'catalogCode', favorite.catalog_code,
        'isFavorite', favorite.is_favorite,
        'updatedAt', favorite.client_updated_at
      ) order by favorite.catalog_code)
      from public.mobile_favorites favorite
      where favorite.user_id = v_actor
    ), '[]'::jsonb),
    'quizRecords', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mode', record.mode,
        'scope', record.scope,
        'bestScore', record.best_score,
        'bestStreak', record.best_streak,
        'playedAt', record.played_at,
        'updatedAt', record.client_updated_at
      ) order by record.scope, record.mode)
      from public.mobile_quiz_records record
      where record.user_id = v_actor
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_quiz_leaderboard(
  p_mode text,
  p_scope text,
  p_limit integer default 50
)
returns table(
  rank bigint,
  public_alias text,
  best_score integer,
  best_streak integer,
  played_at bigint
)
language sql stable security definer set search_path = public
as $$
  select
    row_number() over (
      order by record.best_score desc, record.best_streak desc, record.played_at asc nulls last
    ) as rank,
    profile.public_alias,
    record.best_score,
    record.best_streak,
    record.played_at
  from public.mobile_quiz_records record
  join public.profiles profile on profile.id = record.user_id
  where record.mode = p_mode
    and record.scope = p_scope
    and profile.public_alias is not null
  order by record.best_score desc, record.best_streak desc, record.played_at asc nulls last
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

create or replace function public.get_species_favorite_counts(p_catalog_codes text[])
returns table(catalog_code text, favorite_count bigint)
language sql stable security definer set search_path = public
as $$
  select favorite.catalog_code, count(*)::bigint
  from public.mobile_favorites favorite
  where favorite.is_favorite
    and favorite.catalog_code = any(coalesce(p_catalog_codes, '{}'::text[]))
  group by favorite.catalog_code
$$;

create or replace function public.get_most_favorited_species(p_limit integer default 10)
returns table(catalog_code text, favorite_count bigint)
language sql stable security definer set search_path = public
as $$
  select favorite.catalog_code, count(*)::bigint as favorite_count
  from public.mobile_favorites favorite
  where favorite.is_favorite
  group by favorite.catalog_code
  order by favorite_count desc, favorite.catalog_code
  limit least(greatest(coalesce(p_limit, 10), 1), 100)
$$;

create or replace function public.submit_user_report(
  p_kind public.report_kind,
  p_catalog_code text,
  p_description text,
  p_app_version text,
  p_platform text
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_report_id uuid;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  insert into public.user_reports(
    reporter_id, kind, catalog_code, description, app_version, platform
  ) values (
    v_actor, p_kind, nullif(trim(p_catalog_code), ''), trim(p_description),
    trim(p_app_version), p_platform
  ) returning id into v_report_id;
  return v_report_id;
end;
$$;

create or replace view public.editor_report_queue as
select
  report.id,
  report.kind,
  report.catalog_code,
  report.description,
  report.app_version,
  report.platform,
  report.state,
  report.resolution_note,
  report.created_at,
  profile.display_name as reporter_name,
  profile.public_alias as reporter_alias
from public.user_reports report
join public.profiles profile on profile.id = report.reporter_id
where public.has_editor_access();

create or replace function public.resolve_user_report(
  p_report_id uuid,
  p_state public.report_state,
  p_resolution_note text default null
)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_editor();
begin
  if p_state not in ('reviewing', 'resolved', 'dismissed') then
    raise exception 'invalid_report_state';
  end if;
  update public.user_reports
  set state = p_state,
      resolution_note = nullif(trim(p_resolution_note), ''),
      resolved_by = case when p_state in ('resolved', 'dismissed') then v_actor else null end,
      resolved_at = case when p_state in ('resolved', 'dismissed') then now() else null end,
      updated_at = now()
  where id = p_report_id;
  if not found then raise exception 'report_not_found'; end if;
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, payload)
  values (v_actor, 'report.' || p_state::text, 'user_report', p_report_id::text, jsonb_build_object('note', p_resolution_note));
end;
$$;

alter table public.editor_memberships enable row level security;
alter table public.mobile_favorites enable row level security;
alter table public.mobile_quiz_records enable row level security;
alter table public.user_reports enable row level security;

create policy editor_memberships_read on public.editor_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.has_admin_access());
create policy mobile_favorites_read_own on public.mobile_favorites
  for select to authenticated using (user_id = auth.uid());
create policy mobile_quiz_records_read_own on public.mobile_quiz_records
  for select to authenticated using (user_id = auth.uid());
create policy user_reports_read on public.user_reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.has_editor_access());

revoke all on public.editor_memberships, public.mobile_favorites,
  public.mobile_quiz_records, public.user_reports from anon, authenticated;
revoke select (role, is_active, mfa_required) on public.profiles from authenticated;
grant select (id, display_name, public_alias, avatar_url) on public.profiles to authenticated;
grant select on public.editor_memberships, public.mobile_favorites,
  public.mobile_quiz_records, public.user_reports to authenticated;
grant select on public.editor_report_queue to authenticated;

revoke execute on function public.set_public_alias(text) from public, anon, authenticated;
revoke execute on function public.sync_mobile_state(text,jsonb,jsonb) from public, anon, authenticated;
revoke execute on function public.get_quiz_leaderboard(text,text,integer) from public, anon, authenticated;
revoke execute on function public.get_species_favorite_counts(text[]) from public, anon, authenticated;
revoke execute on function public.get_most_favorited_species(integer) from public, anon, authenticated;
revoke execute on function public.submit_user_report(public.report_kind,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.resolve_user_report(uuid,public.report_state,text) from public, anon, authenticated;

grant execute on function public.set_public_alias(text) to authenticated;
grant execute on function public.sync_mobile_state(text,jsonb,jsonb) to authenticated;
grant execute on function public.get_quiz_leaderboard(text,text,integer) to anon, authenticated;
grant execute on function public.get_species_favorite_counts(text[]) to anon, authenticated;
grant execute on function public.get_most_favorited_species(integer) to anon, authenticated;
grant execute on function public.submit_user_report(public.report_kind,text,text,text,text) to authenticated;
grant execute on function public.resolve_user_report(uuid,public.report_state,text) to authenticated;
