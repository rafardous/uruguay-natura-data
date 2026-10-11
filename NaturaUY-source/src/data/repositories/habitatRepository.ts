import type { SQLiteDatabase } from 'expo-sqlite';
import type { Habitat, HabitatMetric } from '../../domain/entities/habitat';

const reach = `WITH RECURSIVE reach(ancestor_id,descendant_id) AS (
 SELECT id,id FROM habitats UNION SELECT reach.ancestor_id,r.child_id FROM reach JOIN habitat_relations r ON r.parent_id=reach.descendant_id
)`;
const select = `${reach} SELECT h.*,
 (SELECT COUNT(DISTINCT sh.stable_id) FROM species_habitats sh JOIN reach r ON r.descendant_id=sh.habitat_id WHERE r.ancestor_id=h.id) AS count,
 (SELECT json_object('id',m.id,'url',m.url,'thumbnailUrl',m.thumbnail_url,'author',m.author,'license',m.license,'licenseUrl',m.license_url,'sourceUrl',m.source_url,'location',m.location,'caption',m.caption) FROM habitat_media m WHERE m.habitat_id=h.id ORDER BY m.id LIMIT 1) AS photo
 FROM habitats h`;
const parse = (row: Record<string,any>):Habitat => ({id:row.id,code:row.code,name:row.name,kind:row.kind,familyCode:row.family_code,color:row.color,count:row.count,gameGroups:JSON.parse(row.game_groups),content:JSON.parse(row.content),fieldSources:JSON.parse(row.field_sources),photo:row.photo?JSON.parse(row.photo):null});
export const habitatRepository = {
  async available(db:SQLiteDatabase):Promise<boolean>{return Boolean(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='habitats'"));},
  async list(db:SQLiteDatabase):Promise<Habitat[]>{if(!await this.available(db))return [];return (await db.getAllAsync<Record<string,any>>(`${select} ORDER BY h.sort_order,h.name`)).map(parse);},
  async get(db:SQLiteDatabase,code:string):Promise<Habitat|null>{if(!await this.available(db))return null;const row=await db.getFirstAsync<Record<string,any>>(`${select} WHERE h.code=?`,[code]);return row?parse(row):null;},
  async children(db:SQLiteDatabase,id:string):Promise<Habitat[]>{return (await db.getAllAsync<Record<string,any>>(`${select} WHERE EXISTS(SELECT 1 FROM habitat_relations r WHERE r.parent_id=? AND r.child_id=h.id) ORDER BY h.sort_order,h.name`,[id])).map(parse);},
  async aliases(db:SQLiteDatabase):Promise<Record<string,string>>{if(!await this.available(db))return {};const rows=await db.getAllAsync<{raw_value:string;code:string}>('SELECT a.raw_value,h.code FROM habitat_aliases a JOIN habitats h ON h.id=a.habitat_id');return Object.fromEntries(rows.map(r=>[r.raw_value,r.code]));},
  async metrics(db:SQLiteDatabase,id:string):Promise<HabitatMetric[]>{return (await db.getAllAsync<Record<string,any>>('SELECT * FROM habitat_metrics WHERE habitat_id=?',[id])).map(r=>({id:r.id,metric:r.metric,value:r.value,unit:r.unit,referenceYear:r.reference_year,denominator:r.denominator,method:r.method,source:JSON.parse(r.source),note:r.note}));},
};
