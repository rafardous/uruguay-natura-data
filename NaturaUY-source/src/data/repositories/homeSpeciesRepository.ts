import type { SQLiteDatabase } from 'expo-sqlite';
export interface HomeSpeciesSelection { day: string; slot: 'daily' | 'threatened' | 'curiosity' | 'native'; catalog_code: string }
export const uruguayDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const homeSpeciesRepository = {
  async list(db: SQLiteDatabase, day: string): Promise<HomeSpeciesSelection[]> {
    // Los catálogos publicados anteriores no tienen el calendario opcional.
    const table = await db.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name='home_species_schedule'");
    return table ? db.getAllAsync<HomeSpeciesSelection>('SELECT day,slot,catalog_code FROM home_species_schedule WHERE day=?', [day]) : [];
  },
};
