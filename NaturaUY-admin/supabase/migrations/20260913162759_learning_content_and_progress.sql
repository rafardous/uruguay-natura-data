-- Aprender v1: reviewed curriculum documents plus private, offline-first
-- mastery snapshots. Editorial content is release-bound; personal progress is
-- intentionally excluded from the public catalogue tables.

create table public.learning_paths (
  id text not null check (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  version integer not null check (version > 0),
  language text not null default 'es-UY',
  title text not null,
  short_title text not null,
  description text not null,
  accent_color text not null check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  source_codes text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','in_review','approved','archived')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, version)
);

comment on table public.learning_paths is 'Versioned learning routes. Only approved rows are exported to the offline catalogue.';
create unique index learning_paths_one_approved_version_idx on public.learning_paths(id) where status = 'approved';
alter table public.learning_paths enable row level security;
revoke all on table public.learning_paths from public, anon, authenticated;

create table public.mobile_learning_module_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  path_id text not null,
  module_id text not null,
  content_version integer not null check (content_version > 0),
  completed_at bigint not null check (completed_at > 0),
  updated_at bigint not null check (updated_at > 0),
  primary key (user_id, path_id, module_id)
);

create table public.mobile_learning_objective_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  objective_id text not null,
  question_version integer not null check (question_version > 0),
  correct_streak integer not null check (correct_streak between 0 and 3),
  last_result boolean not null,
  last_answered_at bigint not null check (last_answered_at > 0),
  due_at bigint not null check (due_at > 0),
  updated_at bigint not null check (updated_at > 0),
  primary key (user_id, objective_id)
);

create index mobile_learning_objective_due_idx on public.mobile_learning_objective_progress(user_id, due_at);
alter table public.mobile_learning_module_progress enable row level security;
alter table public.mobile_learning_objective_progress enable row level security;
revoke all on table public.mobile_learning_module_progress from public, anon, authenticated;
revoke all on table public.mobile_learning_objective_progress from public, anon, authenticated;

create or replace function public.sync_learning_progress(p_modules jsonb, p_objectives jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_modules) <> 'array' or jsonb_array_length(p_modules) > 100
     or jsonb_typeof(p_objectives) <> 'array' or jsonb_array_length(p_objectives) > 200 then
    raise exception 'invalid_learning_progress' using errcode = '22023';
  end if;

  insert into public.mobile_learning_module_progress(user_id,path_id,module_id,content_version,completed_at,updated_at)
  select v_actor, x.path_id, x.module_id, x.content_version, x.completed_at, x.updated_at
  from jsonb_to_recordset(p_modules) as x(path_id text,module_id text,content_version integer,completed_at bigint,updated_at bigint)
  where x.path_id is not null and x.module_id is not null and x.content_version > 0 and x.completed_at > 0 and x.updated_at > 0
  on conflict (user_id,path_id,module_id) do update set
    content_version = excluded.content_version,
    completed_at = least(public.mobile_learning_module_progress.completed_at, excluded.completed_at),
    updated_at = excluded.updated_at
  where excluded.updated_at > public.mobile_learning_module_progress.updated_at;

  insert into public.mobile_learning_objective_progress(user_id,objective_id,question_version,correct_streak,last_result,last_answered_at,due_at,updated_at)
  select v_actor, x.objective_id, x.question_version, x.correct_streak, x.last_result, x.last_answered_at, x.due_at, x.updated_at
  from jsonb_to_recordset(p_objectives) as x(objective_id text,question_version integer,correct_streak integer,last_result boolean,last_answered_at bigint,due_at bigint,updated_at bigint)
  where x.objective_id is not null and x.question_version > 0 and x.correct_streak between 0 and 3
    and x.last_answered_at > 0 and x.due_at > 0 and x.updated_at > 0
  on conflict (user_id,objective_id) do update set
    question_version = excluded.question_version,
    correct_streak = excluded.correct_streak,
    last_result = excluded.last_result,
    last_answered_at = excluded.last_answered_at,
    due_at = excluded.due_at,
    updated_at = excluded.updated_at
  where excluded.updated_at > public.mobile_learning_objective_progress.updated_at;
end;
$$;

revoke all on function public.sync_learning_progress(jsonb,jsonb) from public, anon;
grant execute on function public.sync_learning_progress(jsonb,jsonb) to authenticated;

create or replace function public.get_personal_mobile_progress()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return jsonb_build_object(
    'quizRecords', coalesce((select jsonb_agg(jsonb_build_object('mode',s.mode,'scope',s.scope,'bestScore',s.best_score,'bestStreak',s.best_streak,'playedAt',s.updated_at,'updatedAt',s.updated_at) order by s.scope,s.mode) from public.game_stats s where s.user_id=v_actor),'[]'::jsonb),
    'puzzleRecords', coalesce((select jsonb_agg(jsonb_build_object('scope',r.scope,'gridSize',r.grid_size,'bestTimeMs',r.best_time_ms,'fewestMoves',r.fewest_moves,'playedAt',r.played_at,'updatedAt',r.updated_at) order by r.scope,r.grid_size) from public.mobile_puzzle_records r where r.user_id=v_actor),'[]'::jsonb),
    'learningModules', coalesce((select jsonb_agg(jsonb_build_object('pathId',m.path_id,'moduleId',m.module_id,'contentVersion',m.content_version,'completedAt',m.completed_at,'updatedAt',m.updated_at) order by m.path_id,m.module_id) from public.mobile_learning_module_progress m where m.user_id=v_actor),'[]'::jsonb),
    'learningObjectives', coalesce((select jsonb_agg(jsonb_build_object('objectiveId',o.objective_id,'questionVersion',o.question_version,'correctStreak',o.correct_streak,'lastResult',o.last_result,'lastAnsweredAt',o.last_answered_at,'dueAt',o.due_at,'updatedAt',o.updated_at) order by o.objective_id) from public.mobile_learning_objective_progress o where o.user_id=v_actor),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_personal_mobile_progress() from public, anon;
grant execute on function public.get_personal_mobile_progress() to authenticated;

drop trigger if exists force_catalog_schema_12 on public.catalog_releases;
drop function if exists private.force_catalog_schema_12();
alter table public.catalog_releases alter column schema_version set default 13;
update public.catalog_releases set schema_version = 13 where status in ('pending','building');
create function private.force_catalog_schema_13()
returns trigger language plpgsql set search_path = '' as $$ begin new.schema_version:=13; return new; end $$;
create trigger force_catalog_schema_13 before insert on public.catalog_releases
for each row execute function private.force_catalog_schema_13();
revoke all on function private.force_catalog_schema_13() from public, anon, authenticated;
