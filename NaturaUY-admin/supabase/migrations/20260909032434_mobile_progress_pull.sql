-- Returns the private progress needed to hydrate a new device or a newly
-- selected mobile account. Writes continue through the existing validated
-- RPCs; this endpoint is deliberately read-only.
create or replace function public.get_personal_mobile_progress()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'quizRecords', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mode', stats.mode,
        'scope', stats.scope,
        'bestScore', stats.best_score,
        'bestStreak', stats.best_streak,
        'playedAt', stats.updated_at,
        'updatedAt', stats.updated_at
      ) order by stats.scope, stats.mode)
      from public.game_stats stats
      where stats.user_id = v_actor
    ), '[]'::jsonb),
    'puzzleRecords', coalesce((
      select jsonb_agg(jsonb_build_object(
        'scope', record.scope,
        'gridSize', record.grid_size,
        'bestTimeMs', record.best_time_ms,
        'fewestMoves', record.fewest_moves,
        'playedAt', record.played_at,
        'updatedAt', record.updated_at
      ) order by record.scope, record.grid_size)
      from public.mobile_puzzle_records record
      where record.user_id = v_actor
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_personal_mobile_progress() from public, anon;
grant execute on function public.get_personal_mobile_progress() to authenticated;
