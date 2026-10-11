import type { SQLiteDatabase } from 'expo-sqlite';
import { mobileSupabase } from '../../lib/supabase';
import { chunkForSync } from '../../domain/services/syncContracts';

export interface EnrichedGameRecord { mode: 'guess_search' | 'guess_choices' | 'jigsaw'; scope: string; best_score: number; best_time_ms: number; fewest_moves: number; played_at: number; updated_at: number }
export const ENRICHED_RECORDS_SQL = `CREATE TABLE IF NOT EXISTS enriched_game_records (
 mode TEXT NOT NULL, scope TEXT NOT NULL, best_score INTEGER NOT NULL DEFAULT 0,
 best_time_ms INTEGER NOT NULL DEFAULT 0, fewest_moves INTEGER NOT NULL DEFAULT 0,
 played_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(mode,scope));
 CREATE TABLE IF NOT EXISTS account_enriched_game_records (
 owner_id TEXT NOT NULL, mode TEXT NOT NULL, scope TEXT NOT NULL, best_score INTEGER NOT NULL DEFAULT 0,
 best_time_ms INTEGER NOT NULL DEFAULT 0, fewest_moves INTEGER NOT NULL DEFAULT 0,
 played_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(owner_id,mode,scope));`;

export async function mergeEnrichedRecords(db: SQLiteDatabase, records: EnrichedGameRecord[]): Promise<void> {
  for (const row of records) await db.runAsync(`INSERT INTO enriched_game_records VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(mode,scope) DO UPDATE SET best_score=MAX(best_score,excluded.best_score),
    best_time_ms=CASE WHEN best_time_ms=0 THEN excluded.best_time_ms WHEN excluded.best_time_ms=0 THEN best_time_ms ELSE MIN(best_time_ms,excluded.best_time_ms) END,
    fewest_moves=CASE WHEN fewest_moves=0 THEN excluded.fewest_moves WHEN excluded.fewest_moves=0 THEN fewest_moves ELSE MIN(fewest_moves,excluded.fewest_moves) END,
    played_at=MAX(played_at,excluded.played_at),updated_at=MAX(updated_at,excluded.updated_at)`,
  [row.mode,row.scope,row.best_score,row.best_time_ms,row.fewest_moves,row.played_at,row.updated_at]);
}
export const enrichedGameRepository = {
  async list(db: SQLiteDatabase): Promise<EnrichedGameRecord[]> { return db.getAllAsync<EnrichedGameRecord>('SELECT * FROM enriched_game_records ORDER BY mode,scope'); },
  async submit(db: SQLiteDatabase, record: EnrichedGameRecord): Promise<void> { await mergeEnrichedRecords(db,[record]); },
  async sync(db: SQLiteDatabase): Promise<void> {
    if (!mobileSupabase) return;
    const rows = await this.list(db);
    for (const batch of chunkForSync(rows,24)) {
      const { error } = await mobileSupabase.rpc('sync_enriched_game_records', { p_records: batch });
      if (error) throw error;
    }
    const { data, error } = await mobileSupabase.rpc('get_enriched_game_records');
    if (error) throw error;
    await mergeEnrichedRecords(db, (data??[]) as EnrichedGameRecord[]);
  },
};
