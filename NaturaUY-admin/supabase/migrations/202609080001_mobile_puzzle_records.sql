create table if not exists public.mobile_puzzle_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('animals_all','birds','mammals','reptiles','amphibians','fish')),
  grid_size integer not null check (grid_size in (3,4)),
  best_time_ms integer not null check (best_time_ms > 0),
  fewest_moves integer not null check (fewest_moves > 0),
  played_at bigint not null check (played_at > 0),
  updated_at bigint not null check (updated_at > 0),
  primary key (user_id, scope, grid_size)
);
alter table public.mobile_puzzle_records enable row level security;
drop policy if exists mobile_puzzle_records_owner on public.mobile_puzzle_records;
create policy mobile_puzzle_records_owner on public.mobile_puzzle_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.sync_puzzle_records(p_records jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare item jsonb; accepted integer := 0; uid uuid := auth.uid(); scope_value text; grid_value integer; time_value integer; moves_value integer; played_value bigint; updated_value bigint;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) > 24 then raise exception 'invalid records'; end if;
  for item in select * from jsonb_array_elements(p_records) loop
    scope_value := item->>'scope'; grid_value := (item->>'gridSize')::integer; time_value := (item->>'bestTimeMs')::integer; moves_value := (item->>'fewestMoves')::integer; played_value := (item->>'playedAt')::bigint; updated_value := (item->>'updatedAt')::bigint;
    if scope_value not in ('animals_all','birds','mammals','reptiles','amphibians','fish') or grid_value not in (3,4) or time_value <= 0 or moves_value <= 0 or played_value <= 0 or updated_value <= 0 then raise exception 'invalid puzzle record'; end if;
    insert into public.mobile_puzzle_records(user_id,scope,grid_size,best_time_ms,fewest_moves,played_at,updated_at) values(uid,scope_value,grid_value,time_value,moves_value,played_value,updated_value)
    on conflict(user_id,scope,grid_size) do update set best_time_ms=least(mobile_puzzle_records.best_time_ms,excluded.best_time_ms), fewest_moves=least(mobile_puzzle_records.fewest_moves,excluded.fewest_moves), played_at=greatest(mobile_puzzle_records.played_at,excluded.played_at), updated_at=greatest(mobile_puzzle_records.updated_at,excluded.updated_at);
    accepted := accepted + 1;
  end loop;
  return jsonb_build_object('accepted', accepted);
end $$;
grant execute on function public.sync_puzzle_records(jsonb) to authenticated;
