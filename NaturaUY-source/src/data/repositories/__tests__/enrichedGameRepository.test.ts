import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { USER_MIGRATIONS } from '../../db/schema';
import { activateLocalAccount } from '../accountDataRepository';
import { enrichedGameRepository, type EnrichedGameRecord } from '../enrichedGameRepository';

jest.mock('../../../lib/supabase',()=>({mobileSupabase:null}));
let sqlite: DatabaseSync;
let db: SQLiteDatabase;
beforeEach(()=>{
  sqlite=new DatabaseSync(':memory:');
  for(const sql of USER_MIGRATIONS)sqlite.exec(sql);
  db={
    execAsync:async(sql:string)=>{sqlite.exec(sql);},
    runAsync:async(sql:string,params:unknown[]=[])=>sqlite.prepare(sql).run(...params as any[]),
    getFirstAsync:async(sql:string,params:unknown[]=[])=>sqlite.prepare(sql).get(...params as any[]),
    getAllAsync:async(sql:string,params:unknown[]=[])=>sqlite.prepare(sql).all(...params as any[]),
    withTransactionAsync:async(operation:()=>Promise<void>)=>{sqlite.exec('BEGIN');try{await operation();sqlite.exec('COMMIT');}catch(error){sqlite.exec('ROLLBACK');throw error;}},
  } as unknown as SQLiteDatabase;
});
afterEach(()=>sqlite.close());
const record=(values:Partial<EnrichedGameRecord>={}):EnrichedGameRecord=>({mode:'jigsaw',scope:'birds:hard:3',best_score:0,best_time_ms:10000,fewest_moves:40,played_at:1000,updated_at:1000,...values});
test('merges independent best time/moves and scores without regressing dates',async()=>{
  await enrichedGameRepository.submit(db,record());
  await enrichedGameRepository.submit(db,record({best_time_ms:12000,fewest_moves:30,played_at:2000,updated_at:2000}));
  await enrichedGameRepository.submit(db,record({best_time_ms:9000,fewest_moves:35}));
  await enrichedGameRepository.submit(db,record({mode:'guess_search',scope:'birds:hard',best_score:400,best_time_ms:0,fewest_moves:0}));
  await enrichedGameRepository.submit(db,record({mode:'guess_search',scope:'birds:hard',best_score:100,best_time_ms:0,fewest_moves:0}));
  const rows=await enrichedGameRepository.list(db);
  expect(rows.find(r=>r.mode==='jigsaw')).toMatchObject({best_time_ms:9000,fewest_moves:30,played_at:2000,updated_at:2000});
  expect(rows.find(r=>r.mode==='guess_search')?.best_score).toBe(400);
});
test('adopts offline progress on first login and isolates/restores both accounts',async()=>{
  await enrichedGameRepository.submit(db,record());
  expect(await activateLocalAccount(db,'account-a')).toBe(false);
  expect(await activateLocalAccount(db,'account-b')).toBe(true);
  expect(await enrichedGameRepository.list(db)).toEqual([]);
  await enrichedGameRepository.submit(db,record({best_time_ms:7000,fewest_moves:20}));
  await activateLocalAccount(db,'account-a');
  expect((await enrichedGameRepository.list(db))[0]).toMatchObject({best_time_ms:10000,fewest_moves:40});
  await activateLocalAccount(db,'account-b');
  expect((await enrichedGameRepository.list(db))[0]).toMatchObject({best_time_ms:7000,fewest_moves:20});
});
