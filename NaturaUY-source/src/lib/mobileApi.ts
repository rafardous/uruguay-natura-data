import type { QuizMode, QuizScope } from '../domain/entities/quiz';
import { mobileSupabase } from './supabase';

export interface LeaderboardEntry {
  position: number;
  publicAlias: string;
  bestScore: number;
  bestStreak: number;
  playedAt: number | null;
}

export async function getQuizLeaderboard(mode: QuizMode, scope: QuizScope): Promise<LeaderboardEntry[]> {
  if (!mobileSupabase) return [];
  const { data, error } = await mobileSupabase.rpc('get_quiz_leaderboard', {
    p_mode: mode,
    p_scope: scope,
    p_limit: 50,
  });
  if (error) throw error;
  return (data ?? []).map((entry: Record<string, unknown>) => ({
    position: Number(entry.rank),
    publicAlias: String(entry.public_alias),
    bestScore: Number(entry.best_score),
    bestStreak: Number(entry.best_streak),
    playedAt: entry.played_at === null ? null : Number(entry.played_at),
  }));
}

export async function getMostFavoritedSpecies(limit = 10): Promise<{ catalogCode: string; count: number }[]> {
  if (!mobileSupabase) return [];
  const { data, error } = await mobileSupabase.rpc('get_most_favorited_species', { p_limit: limit });
  if (error) throw error;
  return (data ?? []).map((entry: Record<string, unknown>) => ({ catalogCode: String(entry.catalog_code), count: Number(entry.favorite_count) }));
}

export async function submitUserReport(input: {
  kind: 'data_error' | 'app_bug';
  catalogCode?: string;
  description: string;
  appVersion: string;
  platform: 'android' | 'ios' | 'web';
}): Promise<void> {
  if (!mobileSupabase) throw new Error('La conexión todavía no está configurada.');
  const { error } = await mobileSupabase.rpc('submit_user_report', {
    p_kind: input.kind,
    p_catalog_code: input.catalogCode ?? null,
    p_description: input.description,
    p_app_version: input.appVersion,
    p_platform: input.platform,
  });
  if (error) throw error;
}
