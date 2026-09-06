-- Mobile contracts after the lean catalog cutover.
-- This migration keeps the public client surface small and lets old rows
-- remain readable while adding enough context for editorial triage.

alter table public.feedback
  add column if not exists area text not null default 'general',
  add column if not exists reference_url text,
  add column if not exists platform text not null default 'unknown',
  add column if not exists updated_at timestamptz not null default now();

alter table public.feedback
  drop constraint if exists feedback_area_check,
  drop constraint if exists feedback_platform_check;

alter table public.feedback
  add constraint feedback_area_check check (area in ('species', 'general', 'app', 'games')),
  add constraint feedback_platform_check check (platform in ('android', 'ios', 'web', 'unknown'));

alter table public.game_stats
  drop constraint if exists game_stats_mode_check;

alter table public.game_stats
  add constraint game_stats_mode_check check (mode in ('classic', 'timed', 'survival', 'naming'));

drop function if exists public.sync_favorites(jsonb);
create or replace function public.sync_favorites(p_changes jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_actor uuid := auth.uid();
  v_catalog_code text;
  v_updated_at bigint;
begin
  if v_actor is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 5000 then raise exception 'invalid_favorites'; end if;

  for v_item in select value from jsonb_array_elements(p_changes) loop
    v_catalog_code := trim(coalesce(v_item->>'catalogCode', ''));
    v_updated_at := nullif(v_item->>'updatedAt', '')::bigint;
    if v_catalog_code = '' or v_updated_at is null or v_updated_at <= 0 then raise exception 'invalid_favorite_change'; end if;
    insert into public.favorites(user_id, species_id, is_favorite, updated_at)
      select v_actor, s.id, coalesce((v_item->>'isFavorite')::boolean, false), v_updated_at
      from public.species s where s.catalog_code = v_catalog_code
    on conflict(user_id, species_id) do update set
      is_favorite = excluded.is_favorite,
      updated_at = excluded.updated_at
    where excluded.updated_at >= public.favorites.updated_at;
  end loop;

  return coalesce((select jsonb_agg(jsonb_build_object(
    'catalogCode', s.catalog_code,
    'isFavorite', f.is_favorite,
    'updatedAt', f.updated_at
  ) order by s.catalog_code)
  from public.favorites f join public.species s on s.id = f.species_id
  where f.user_id = v_actor), '[]'::jsonb);
end $$;

drop function if exists public.record_game_result(text, text, integer, integer, bigint);
create or replace function public.record_game_result(
  p_mode text,
  p_scope text,
  p_score integer,
  p_streak integer,
  p_updated_at bigint,
  p_games_delta integer default 1
) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_mode not in ('classic', 'timed', 'survival', 'naming') or p_games_delta < 1 or p_updated_at <= 0 then
    raise exception 'invalid_game_result';
  end if;
  insert into public.game_stats(user_id, mode, scope, best_score, best_streak, games_played, updated_at)
    values (auth.uid(), trim(p_mode), trim(p_scope), greatest(p_score, 0), greatest(p_streak, 0), p_games_delta, p_updated_at)
  on conflict(user_id, mode, scope) do update set
    best_score = greatest(game_stats.best_score, excluded.best_score),
    best_streak = greatest(game_stats.best_streak, excluded.best_streak),
    games_played = game_stats.games_played + excluded.games_played,
    updated_at = greatest(game_stats.updated_at, excluded.updated_at);
end $$;

drop function if exists public.submit_feedback(text, text, text, text);
create or replace function public.submit_feedback(
  p_type text,
  p_message text,
  p_catalog_code text default null,
  p_app_version text default null,
  p_area text default 'general',
  p_platform text default 'unknown',
  p_reference_url text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_species_id uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null or p_type not in ('bug', 'suggestion', 'review') then raise exception 'invalid_feedback' using errcode = '42501'; end if;
  if p_area not in ('species', 'general', 'app', 'games') then raise exception 'invalid_feedback_area'; end if;
  if p_platform not in ('android', 'ios', 'web', 'unknown') then raise exception 'invalid_feedback_platform'; end if;
  if p_area = 'species' then
    select id into v_species_id from public.species where catalog_code = nullif(trim(p_catalog_code), '');
    if v_species_id is null then raise exception 'feedback_species_not_found'; end if;
  elsif nullif(trim(p_catalog_code), '') is not null then
    select id into v_species_id from public.species where catalog_code = trim(p_catalog_code);
  end if;
  insert into public.feedback(user_id, type, species_id, message, app_version, area, platform, reference_url)
    values (v_actor, p_type, v_species_id, trim(p_message), nullif(trim(p_app_version), ''), p_area, p_platform, nullif(trim(p_reference_url), ''))
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.resolve_feedback(p_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_editor();
  if p_status not in ('reviewing', 'resolved', 'dismissed') then raise exception 'invalid_feedback_status'; end if;
  if p_status in ('resolved', 'dismissed') and nullif(trim(p_note), '') is null then raise exception 'resolution_note_required'; end if;
  update public.feedback
  set status = p_status,
      resolution_note = nullif(trim(p_note), ''),
      resolved_by = case when p_status in ('resolved', 'dismissed') then auth.uid() else null end,
      resolved_at = case when p_status in ('resolved', 'dismissed') then now() else null end,
      updated_at = now()
  where id = p_id;
  if not found then raise exception 'feedback_not_found'; end if;
end $$;

drop view if exists public.feedback_queue;
create view public.feedback_queue with (security_invoker = true) as
select f.*, p.display_name as reporter_name, s.catalog_code, s.common_name as species_name
from public.feedback f
join public.profiles p on p.user_id = f.user_id
left join public.species s on s.id = f.species_id;

grant execute on function public.sync_favorites(jsonb),
  public.record_game_result(text, text, integer, integer, bigint, integer),
  public.submit_feedback(text, text, text, text, text, text, text),
  public.resolve_feedback(uuid, text, text) to authenticated;
grant select on public.feedback_queue to authenticated;
