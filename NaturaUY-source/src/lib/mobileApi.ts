import type { QuizMode, QuizScope } from '../domain/entities/quiz';
import { Platform } from 'react-native';
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
    p_mode_arg: mode,
    p_scope_arg: scope,
    p_limit: 50,
  });
  if (error) throw error;
  return (data ?? []).map((entry: Record<string, unknown>) => ({
    position: Number(entry.rank),
    publicAlias: String(entry.public_alias),
    bestScore: Number(entry.best_score),
    bestStreak: 0,
    playedAt: null,
    gamesPlayed: Number(entry.games_played ?? 0),
  }));
}

export async function submitUserReport(input: {
  kind: 'review' | 'bug' | 'suggestion';
  area?: 'species' | 'general' | 'app' | 'games';
  catalogCode?: string;
  description: string;
  appVersion: string;
  referenceUrl?: string;
}): Promise<void> {
  if (!mobileSupabase) throw new Error('La conexión todavía no está configurada.');
  const area = input.area ?? (input.kind === 'review' ? 'species' : 'general');
  const type = input.kind === 'review' ? 'review' : input.kind === 'suggestion' ? 'suggestion' : 'bug';
  const { error } = await mobileSupabase.rpc('submit_feedback', {
    p_type: type,
    p_message: input.description,
    p_catalog_code: input.catalogCode ?? null,
    p_app_version: input.appVersion,
    p_area: area,
    p_platform: Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web' ? Platform.OS : 'unknown',
    p_reference_url: input.referenceUrl ?? null,
  });
  if (error) throw error;
}
