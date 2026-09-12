import type { KnowledgeLevel, QuizMode, QuizScope } from '../domain/entities/quiz';
import { Platform } from 'react-native';
import { mobileSupabase } from './supabase';

export interface MobileHomeNews {
  id: string;
  title: string;
  source: string;
  articleUrl: string;
  imageUrl: string | null;
  publishedAt: string | null;
}

export interface CollaboratorApplicationInput {
  interests: string[];
  experience: string;
  motivation: string;
  availability: 'occasional' | 'monthly' | 'weekly' | 'more';
  referenceUrl?: string | null;
  consent: boolean;
}

export interface OwnCollaboratorApplication {
  id: string;
  contactName: string;
  contactEmail: string;
  interests: string[];
  experience: string;
  motivation: string;
  availability: CollaboratorApplicationInput['availability'];
  referenceUrl: string | null;
  consent: boolean;
  status: 'pending' | 'reviewing' | 'accepted' | 'rejected' | 'withdrawn';
  reviewerNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export async function getHomeNews(limit = 3): Promise<MobileHomeNews[]> {
  if (!mobileSupabase) return [];
  const { data, error } = await mobileSupabase
    .from('home_news')
    .select('id,title,source,article_url,image_url,published_at')
    .eq('status', 'published')
    .order('sort_order', { ascending: true })
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    source: String(row.source),
    articleUrl: String(row.article_url),
    imageUrl: typeof row.image_url === 'string' ? row.image_url : null,
    publishedAt: typeof row.published_at === 'string' ? row.published_at : null,
  }));
}

export async function getOwnCollaboratorApplication(): Promise<OwnCollaboratorApplication | null> {
  if (!mobileSupabase) return null;
  const { data, error } = await mobileSupabase
    .from('collaborator_applications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: String(data.id),
    contactName: String(data.contact_name),
    contactEmail: String(data.contact_email),
    interests: Array.isArray(data.interests) ? data.interests.map(String) : [],
    experience: String(data.experience),
    motivation: String(data.motivation),
    availability: data.availability,
    referenceUrl: typeof data.reference_url === 'string' ? data.reference_url : null,
    consent: Boolean(data.consent),
    status: data.status,
    reviewerNote: typeof data.reviewer_note === 'string' ? data.reviewer_note : null,
    createdAt: String(data.created_at),
    reviewedAt: typeof data.reviewed_at === 'string' ? data.reviewed_at : null,
  };
}

export async function submitCollaboratorApplication(input: CollaboratorApplicationInput): Promise<string> {
  if (!mobileSupabase) throw new Error('La conexión todavía no está configurada.');
  const { data, error } = await mobileSupabase.rpc('submit_collaborator_application', {
    p_interests: input.interests,
    p_experience: input.experience,
    p_motivation: input.motivation,
    p_availability: input.availability,
    p_reference_url: input.referenceUrl ?? null,
    p_consent: input.consent,
  });
  if (error) throw error;
  return String(data);
}

export interface LeaderboardEntry {
  position: number;
  publicAlias: string;
  bestScore: number;
  bestStreak: number;
  playedAt: number | null;
  gamesPlayed: number;
}

/** Returns only public catalog codes; species data is hydrated from offline SQLite. */
export async function getMostFavoritedSpecies(limit = 1): Promise<string[]> {
  if (!mobileSupabase) return [];
  const { data, error } = await mobileSupabase.rpc('get_most_favorited_species', { p_limit: limit });
  if (error) throw error;
  return (data ?? [])
    .map((entry: Record<string, unknown>) => String(entry.catalog_code ?? '').trim())
    .filter(Boolean);
}

export async function getQuizLeaderboard(mode: QuizMode, scope: QuizScope, knowledgeLevel: KnowledgeLevel = 'hard'): Promise<LeaderboardEntry[]> {
  if (!mobileSupabase) return [];
  const { data, error } = await mobileSupabase.rpc('get_game_leaderboard', {
    p_mode_arg: mode,
    p_scope_arg: `${scope}:${knowledgeLevel}`,
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
