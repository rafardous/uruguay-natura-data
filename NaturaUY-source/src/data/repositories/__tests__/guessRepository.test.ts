import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import type { SQLiteDatabase } from 'expo-sqlite';
import { guessRepository } from '../guessRepository';

let sqlite:DatabaseSync;
let db:SQLiteDatabase;
beforeEach(()=>{
  sqlite=new DatabaseSync(':memory:');
  sqlite.exec(`ATTACH DATABASE '${resolve(__dirname,'../../../../assets/db/natura.db').replaceAll("'","''")}' AS catalog`);
  for(const table of ['species','species_game_rules','species_facts','catalog_sources','species_taxa','taxa','species_game_clues'])sqlite.exec(`CREATE TABLE ${table} AS SELECT * FROM catalog.${table}`);
  db={getFirstAsync:async(sql:string,params:any[]=[])=>sqlite.prepare(sql).get(...params),getAllAsync:async(sql:string,params:any[]=[])=>sqlite.prepare(sql).all(...params)} as unknown as SQLiteDatabase;
});
afterEach(()=>sqlite.close());
test('bundled editorial clues produce complete animal and plant rounds',async()=>{
  const animals=await guessRepository.load(db,'animals_all','hard');
  const plants=await guessRepository.load(db,'plants','hard');
  expect(animals.targets.map(t=>t.species.codigo)).toEqual(expect.arrayContaining(['H_hydrocha','R_american','S_magellan','V_chilensi','F_rufus','D_novemcin']));
  expect(plants.targets.map(t=>t.species.codigo)).toEqual(expect.arrayContaining(['plant-erythrina-crista-galli','plant-salix-humboldtiana']));
  expect([...animals.targets,...plants.targets].every(t=>t.clues.length===5)).toBe(true);
});
test('older catalogs, editorial exclusions and non-redistributable facts are respected',async()=>{
  const stableId=String(sqlite.prepare("SELECT stable_id FROM species WHERE codigo='H_hydrocha'").get()!.stable_id);
  sqlite.prepare('INSERT INTO species_game_rules VALUES(?,?,?,?)').run(stableId,'guess',0,null);
  sqlite.prepare('INSERT INTO catalog_sources VALUES(?,?,?,?,?,?,?)').run('test-review','Test',null,null,'Review only',null,'review_only');
  sqlite.prepare('INSERT INTO species_facts VALUES(?,?,?,?,?,?)').run('test-fact',stableId,'Texto que no se puede redistribuir.',0,'test-review',null);
  expect((await guessRepository.load(db,'animals_all','hard')).candidates.some(s=>s.codigo==='H_hydrocha')).toBe(false);
  sqlite.exec("DELETE FROM species_game_rules WHERE game_key='guess'; DROP TABLE species_game_clues;");
  const older=await guessRepository.load(db,'animals_all','hard');
  expect(older.candidates.find(s=>s.codigo==='H_hydrocha')?.facts.some(f=>f.id==='test-fact')).toBe(false);
});
