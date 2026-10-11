import { supabase } from './supabase';
import type { SpeciesSummary } from '../domain';
import { listSpecies } from './api';

export function editorialClient() {
  if (!supabase) throw new Error('Supabase no está configurado');
  return supabase;
}

/** Supabase limita cada respuesta: nunca truncar bibliotecas o selectores. */
export async function readAll<T>(table: string, select = '*', orders = ['id']): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    let query = editorialClient().from(table).select(select);
    for (const order of orders) query = query.order(order);
    const { data, error } = await query.range(from, from + 999);
    if (error) throw error;
    rows.push(...(data as unknown as T[]));
    if (data.length < 1000) return rows;
  }
}

export async function activeSpecies(): Promise<SpeciesSummary[]> {
  const first = await listSpecies({ lifecycle: 'active', pageSize: 1000 });
  const pages = await Promise.all(Array.from({ length: Math.max(0, Math.ceil(first.count / 1000) - 1) }, (_, i) => listSpecies({ lifecycle: 'active', page: i + 1, pageSize: 1000 })));
  return [...first.rows, ...pages.flatMap(p => p.rows)];
}

export async function editorialRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await editorialClient().rpc(name, args);
  if (error) throw error;
  return data;
}

export const GAME_LABELS = { quiz: 'Identificá · imagen', naming: 'Identificá · nombre', puzzle: 'Puzzle · deslizante', jigsaw: 'Puzzle · Encastrar', guess: 'Adiviá', trivia: 'Trivia', classify: 'Clasificá', habitat: 'Ambientes' };
export type GameKey = keyof typeof GAME_LABELS;
export interface GameRule { id: string; species_id: string; game_key: GameKey; enabled: boolean; min_knowledge_level: string | null; note: string | null }
export interface Fact { id: string; species_id: string; body: string; source_id: string; source_record_id: string | null; sort_order: number; active: boolean }
export interface Trivia { id: string; species_id: string | null; prompt: string; explanation: string | null; source_id: string; source_record_id: string | null; image_media_id: string | null; active: boolean; trivia_options: { body: string; is_correct: boolean; sort_order: number }[] }
