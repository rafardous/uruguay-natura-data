import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import type { SQLiteDatabase } from 'expo-sqlite';
import { habitatRepository } from '../habitatRepository';
import { speciesRepository } from '../speciesRepository';

const sqlite = new DatabaseSync(resolve(__dirname, '../../../../assets/db/natura.db'), { readOnly: true });
const db = {
  getFirstAsync: async (sql: string, params: any[] = []) => sqlite.prepare(sql).get(...params),
  getAllAsync: async (sql: string, params: any[] = []) => sqlite.prepare(sql).all(...params),
} as unknown as SQLiteDatabase;
afterAll(() => sqlite.close());

test('family counts and paginated species agree without duplicates on the real catalog', async () => {
  for (const h of (await habitatRepository.list(db)).filter(h => h.kind === 'group')) {
    expect(await speciesRepository.count(db, { habitatId: h.id })).toBe(h.count);
    const first = await speciesRepository.findPaged(db, { habitatId: h.id }, 24, 0);
    const next = await speciesRepository.findPaged(db, { habitatId: h.id }, 24, 24);
    const codes = [...first.items, ...next.items].map(s => s.codigo);
    expect(new Set(codes).size).toBe(codes.length);
  }
});

test('broad evidence does not imply presence in a subtype', async () => {
  const parent = await habitatRepository.get(db, 'pastizales');
  const child = await habitatRepository.get(db, 'pastizal_mesofilo');
  expect(parent!.count).toBeGreaterThan(child!.count);
  const rows = await speciesRepository.findPaged(db, { habitatId: child!.id }, 1000, 0);
  expect(rows.items.length).toBe(child!.count);
  expect(await habitatRepository.get(db, 'no-existe')).toBeNull();
});

test('an empty documented subtype has a graphic fallback and no invented species', async () => {
  const h = await habitatRepository.get(db, 'pastizal_arbolado');
  expect(h).not.toBeNull();
  expect(h!.photo).toBeNull();
  expect(h!.count).toBe(0);
});
