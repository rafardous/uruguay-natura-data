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
  if (error) {
    const messages:Record<string,string>={species_change_conflict:'La ficha cambió desde que la abriste. Revisá la versión actual antes de guardar.',gallery_change_conflict:'La galería cambió desde que la abriste. Revisá los medios actuales antes de guardar.',media_limit_exceeded:'La especie admite hasta tres fotos y un audio.',media_not_ready:'Esperá a que los archivos terminen de procesarse antes de aplicar.',media_objects_missing:'No se encontró un archivo verificado en Storage. Reintentá el procesamiento.',permission_evidence_required:'Completá la referencia verificable de autorización.',bird_source_required:'El perfil de aves necesita una fuente por campo.',admin_required:'Esta acción requiere un administrador.',habitat_change_conflict:'El ambiente cambió desde que lo abriste. Actualizá su versión antes de guardar.'};
    Object.assign(messages, {
      abundance_source_required: 'La abundancia necesita una fuente. Corregí el alta e indicá su fuente o elegí «Sin dato».',
      self_validation_confirmation_required: 'Confirmá la revisión de tu propio cambio antes de aprobarlo.',
      change_not_pending: 'Esta solicitud ya fue resuelta. Actualizá la lista de revisiones.',
      pending_create_conflict: 'El alta cambió desde que la abriste. Volvé a abrirla desde Revisiones.',
      pending_create_owner_required: 'Sólo quien propuso el alta o un administrador puede corregirla.',
      image_limit_exceeded: 'La especie admite hasta tres fotos.',
      audio_limit_exceeded: 'La especie admite un solo audio.',
    });
    throw new Error(error.message.includes('species_measurements_items') ? 'Las medidas necesitan una fuente por valor. Corregí el alta y completá las fuentes dentro de Tamaño.' : messages[error.message]??error.message);
  }
  return data;
}

export const GAME_LABELS = { quiz: 'Identificá · imagen', naming: 'Identificá · nombre', puzzle: 'Puzzle · deslizante', jigsaw: 'Puzzle · Encastrar', guess: 'Adiviá', trivia: 'Trivia', classify: 'Clasificá', habitat: 'Ambientes' };
export type GameKey = keyof typeof GAME_LABELS;
export interface GameRule { id: string; species_id: string; game_key: GameKey; enabled: boolean; min_knowledge_level: string | null; note: string | null }
export interface Fact { id: string; species_id: string; body: string; source_id: string; source_record_id: string | null; sort_order: number; active: boolean }
export interface Trivia { id: string; species_id: string | null; prompt: string; explanation: string | null; source_id: string; source_record_id: string | null; image_media_id: string | null; active: boolean; trivia_options: { body: string; is_correct: boolean; sort_order: number }[] }
