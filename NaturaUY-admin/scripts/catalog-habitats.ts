import type { DatabaseSync } from 'node:sqlite';
import type { CatalogRecord, DatabaseRow } from './catalog-data';
import { adminClient } from './shared';
import { publicMediaUrl } from './catalog-data';
import { habitatCoverage } from './habitat-seed';

export async function loadPublishedHabitats(items: CatalogRecord[]) {
  const client=adminClient();
  const read=async(table:string,order='id')=>{
    const rows: DatabaseRow[]=[];
    for(let from=0;;from+=1000){let query=client.from(table).select('*').order(order);if(table==='habitat_relations')query=query.order('child_id');if(table==='species_habitats')query=query.order('habitat_id');const {data,error}=await query.range(from,from+999);if(error)throw error;rows.push(...data);if(data.length<1000)break;}return rows;
  };
  const [all,relations,aliases,links,metrics,media]=await Promise.all([read('habitats'),read('habitat_relations','parent_id'),read('habitat_aliases','raw_value'),read('species_habitats','species_id'),read('habitat_metrics'),read('habitat_public_media')]);
  const habitats=all.filter(h=>h.status==='approved');const ids=new Set(habitats.map(h=>h.id));const speciesIds=new Set(items.map(i=>i.species.id));
  const result={coverage:habitatCoverage,habitats,relations:relations.filter(r=>ids.has(r.parent_id)&&ids.has(r.child_id)),aliases:aliases.filter(a=>ids.has(a.habitat_id)),links:links.filter(l=>speciesIds.has(l.species_id)&&ids.has(l.habitat_id)),metrics:metrics.filter(m=>ids.has(m.habitat_id)),media:media.filter(m=>ids.has(m.habitat_id)).map((m):DatabaseRow=>({...m,url:publicMediaUrl(m.storage_path),thumbnail_url:publicMediaUrl(m.thumbnail_path)}))};
  const byId=new Map(habitats.map(h=>[h.id,h]));
  for(const item of items){
    const linked=result.links.filter(l=>l.species_id===item.species.id).map(l=>byId.get(l.habitat_id)!);
    const canonical=linked.map(h=>h.code).sort();
    if(JSON.stringify(canonical)!==JSON.stringify([...(item.species.ecology.habitats??[])].sort()))throw new Error(`habitat_projection_mismatch:${item.species.catalog_code}`);
    item.species.ecology={...item.species.ecology,habitatGameGroups:[...new Set(linked.flatMap(h=>h.game_groups))]};
  }
  for(const m of result.media){
    if(!m.author||!m.source_url||!m.location||!['CC0','CC-BY-4.0','permission'].includes(m.license))throw new Error(`habitat_media_invalid:${m.id}`);
    for(const path of [m.storage_path,m.thumbnail_path]){const {error}=await client.storage.from('media-public').info(path);if(error)throw new Error(`habitat_media_missing:${m.id}`);}
  }
  return result;
}
export type HabitatCatalog=Awaited<ReturnType<typeof loadPublishedHabitats>>;
/** Proyección de compatibilidad, sólo en artefactos schema 14. La autoridad sigue canónica. */
export function applySchema14Habitats(items:CatalogRecord[],data:HabitatCatalog) {
  const historical=new Set(['pastizal_campo_natural','monte_nativo','matorral','humedal','rio_arroyo','laguna_estero','costa_playa_dunas','roquedal_sierras','agroecosistema','bosques_palmares','ambientes_acuaticos','islas_oceano','mar_costero','mar_abierto','urbano_suburbano']);
  const general:Record<string,string>={'Campo natural':'pastizal_campo_natural','Monte y matorral':'monte_nativo','Humedales y aguas continentales':'humedal','Costa y mar':'costa_playa_dunas','Sierras y roquedales':'roquedal_sierras','Ambientes humanos':'agroecosistema'};
  const byId=new Map(data.habitats.map(h=>[h.id,h]));
  for(const item of items) {
    const associations=data.links.filter(l=>l.species_id===item.species.id);
    const original=associations.flatMap(l=>l.evidence.filter((e:any)=>e.field==='ecology.habitats').map((e:any)=>e.rawValue));
    const compatible=original.flatMap((value:string)=>historical.has(value)?[value]:[]);
    for(const link of associations) {
      const node=byId.get(link.habitat_id)!;
      if(link.evidence.some((e:any)=>e.field==='ecology.habitats'&&historical.has(e.rawValue)))continue;
      if(historical.has(node.code))compatible.push(node.code);
      else compatible.push(...node.game_groups.map((g:string)=>general[g]).filter(Boolean));
    }
    item.species.ecology={...item.species.ecology,habitats:[...new Set(compatible)].sort()};
  }
}
export function writePublishedHabitats(db:DatabaseSync,data:HabitatCatalog) {
  db.exec(`create table habitats(id text primary key,code text not null unique,name text not null,kind text not null,family_code text not null,sort_order integer not null,color text not null,game_groups text not null,content text not null,field_sources text not null);
create table habitat_relations(parent_id text references habitats(id),child_id text references habitats(id),primary key(parent_id,child_id));
create index habitat_relations_child on habitat_relations(child_id);
create table habitat_aliases(raw_value text primary key,habitat_id text references habitats(id),rule text not null);
create table species_habitats(stable_id text references species(stable_id),habitat_id text references habitats(id),scope text not null,evidence text not null,primary key(stable_id,habitat_id));
create index species_habitats_habitat on species_habitats(habitat_id,stable_id);
create table habitat_metrics(id text primary key,habitat_id text references habitats(id),metric text,value real,unit text,reference_year integer,denominator text,method text,source text,note text);
create table habitat_media(id text primary key,habitat_id text references habitats(id),url text,thumbnail_url text,author text,license text,source_url text,license_url text,location text,caption text,checksum_sha256 text);`);
  const h=db.prepare('insert into habitats values(?,?,?,?,?,?,?,?,?,?)');data.habitats.forEach(r=>h.run(r.id,r.code,r.name,r.kind,r.family_code,r.sort_order,r.color,JSON.stringify(r.game_groups),JSON.stringify(r.content),JSON.stringify(r.field_sources)));
  const rel=db.prepare('insert into habitat_relations values(?,?)');data.relations.forEach(r=>rel.run(r.parent_id,r.child_id));
  const a=db.prepare('insert into habitat_aliases values(?,?,?)');data.aliases.forEach(r=>a.run(r.raw_value,r.habitat_id,r.rule));
  const l=db.prepare('insert into species_habitats values(?,?,?,?)');data.links.forEach(r=>l.run(r.species_id,r.habitat_id,r.scope,JSON.stringify(r.evidence)));
  const mt=db.prepare('insert into habitat_metrics values(?,?,?,?,?,?,?,?,?,?)');data.metrics.forEach(r=>mt.run(r.id,r.habitat_id,r.metric,r.value,r.unit,r.reference_year,r.denominator,r.method,JSON.stringify(r.source),r.note));
  const m=db.prepare('insert into habitat_media values(?,?,?,?,?,?,?,?,?,?,?)');data.media.forEach(r=>m.run(r.id,r.habitat_id,r.url,r.thumbnail_url,r.author,r.license,r.source_url,r.license_url,r.location,r.caption,r.checksum_sha256));
}
