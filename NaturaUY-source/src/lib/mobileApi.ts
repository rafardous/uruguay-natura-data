import type { QuizMode, QuizScope } from '../domain/entities/quiz';
import { mobileSupabase } from './supabase';

export interface LeaderboardEntry {
  position: number;
  publicAlias: string;
  bestScore: number;
  bestStreak: number;
  playedAt: number | null;
  gamesPlayed: number;
}

export async function getQuizLeaderboard(mode: QuizMode, scope: QuizScope): Promise<LeaderboardEntry[]> {
  if (!mobileSupabase) return [];
  const { data, error } = await mobileSupabase.rpc('get_game_leaderboard', {
    p_game_mode: `${mode}:${scope}`,
    p_limit: 50,
  });
  if (error) throw error;
  return (data ?? []).map((entry: Record<string, unknown>) => ({
    position: Number(entry.rank),
    publicAlias: String(entry.public_alias),
    bestScore: Number(entry.best_score),
    bestStreak: 0,
    playedAt: null,
    gamesPlayed: Number(entry.games_played),
  }));
}

export async function submitUserReport(input: {
  kind: 'review' | 'bug' | 'suggestion';
  catalogCode?: string;
  description: string;
  appVersion: string;
}): Promise<void> {
  if (!mobileSupabase) throw new Error('La conexión todavía no está configurada.');
  const rpc = input.kind === 'review' ? 'submit_review_request' : input.kind === 'bug' ? 'submit_bug_report' : 'submit_suggestion';
  const args = input.kind === 'review'
    ? { p_catalog_code: input.catalogCode, p_reason: input.description }
    : input.kind === 'bug'
      ? { p_message: input.description, p_app_version: input.appVersion }
      : { p_message: input.description };
  const { error } = await mobileSupabase.rpc(rpc, args);
  if (error) throw error;
}
