import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { homeSpeciesRepository } from '../homeSpeciesRepository';

function catalog() {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    getFirstAsync: async (sql: string, args: string[] = []) => sqlite.prepare(sql).get(...args) ?? null,
    getAllAsync: async (sql: string, args: string[] = []) => sqlite.prepare(sql).all(...args),
  } as unknown as SQLiteDatabase;
  return { sqlite, db };
}
test('un catálogo anterior mantiene la rotación sin exigir calendario', async () => {
  const {sqlite,db}=catalog();
  expect(await homeSpeciesRepository.list(db,'2026-10-11')).toEqual([]);
  sqlite.close();
});
test('la selección editorial offline respeta la fecha y tarjeta', async () => {
  const {sqlite,db}=catalog();
  sqlite.exec("create table home_species_schedule(day text,slot text,catalog_code text);insert into home_species_schedule values('2026-10-11','daily','A'),('2026-10-11','native','B'),('2026-10-12','daily','C')");
  expect(await homeSpeciesRepository.list(db,'2026-10-11')).toEqual([{day:'2026-10-11',slot:'daily',catalog_code:'A'},{day:'2026-10-11',slot:'native',catalog_code:'B'}]);
  expect(await homeSpeciesRepository.list(db,'2026-10-13')).toEqual([]);
  sqlite.close();
});
