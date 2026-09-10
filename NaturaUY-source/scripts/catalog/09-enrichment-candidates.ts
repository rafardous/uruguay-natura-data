import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PATHS, readJson, slug, writeJson } from './lib';

const TARGETS=new Set(['Reptilia','Amphibia','Actinopterygii','Chondrichthyes']);
interface Resolved { scientificName:string; evidence:Array<{source:string;sourceRecord:string|null;taxonomy:Record<string,string|null>}>; resolution:{status:string;acceptedName:string|null;confidence:number|null;taxonomy:Record<string,string|null>} }
interface Catalog { id:string; scientificName:string; taxonomy:Record<string,string|null>; origin:string|null; commonName:string|null }
interface Candidate { speciesId:string; scientificName:string; fieldPath:string; currentValue:unknown; proposedValue:unknown; sourceCode:string; sourceRecordId:string|null; confidence:number; decision:'update'|'exclude'|'review'; rationale:string }

const first=(row:Resolved,field:string)=>row.evidence.map((e)=>e.taxonomy[field]).find(Boolean)??row.resolution.taxonomy[field]??null;
function main(){
  if(!existsSync(PATHS.resolved))throw new Error('Falta normalized/resolved.json; ejecutá data:catalog-taxonomy.');
  const resolved=readJson<Resolved[]>(PATHS.resolved); const catalogFiles=['reptilia','amphibia','actinopterygii','chondrichthyes'];
  const catalog=catalogFiles.flatMap((file)=>readJson<Catalog[]>(resolve(PATHS.catalog,`${file}.json`)));
  const byId=new Map(catalog.map((item)=>[item.id,item])); const candidates:Candidate[]=[]; const acceptedIds=new Set<string>();
  for(const row of resolved){const sourceClass=row.evidence.map((e)=>e.taxonomy.class).find((value)=>value&&TARGETS.has(value));if(!sourceClass)continue;
    if(!row.resolution.acceptedName||row.resolution.status==='unresolved'){candidates.push({speciesId:slug(row.scientificName),scientificName:row.scientificName,fieldPath:'presence',currentValue:'included',proposedValue:'exclude',sourceCode:'gbif',sourceRecordId:null,confidence:(row.resolution.confidence??0)/100,decision:'exclude',rationale:'El nombre no quedó resuelto a rango especie; requiere revisión antes de publicar.'});continue;}
    const id=slug(row.resolution.acceptedName);acceptedIds.add(id);const current=byId.get(id);if(!current)continue;
    for(const [fieldPath,field] of [['taxonomy.order','order'],['taxonomy.family','family'],['taxonomy.genus','genus']] as const){const proposed=first(row,field);const value=current.taxonomy[field];if(proposed&&proposed!==value)candidates.push({speciesId:id,scientificName:row.resolution.acceptedName,fieldPath,currentValue:value,proposedValue:proposed,sourceCode:row.evidence.find((e)=>e.taxonomy[field]===proposed)?.source??'gbif',sourceRecordId:row.evidence.find((e)=>e.taxonomy[field]===proposed)?.sourceRecord??null,confidence:(row.resolution.confidence??80)/100,decision:'update',rationale:'Diferencia entre el catálogo publicado y la resolución reproducible.'});}
  }
  for(const item of catalog)if(!acceptedIds.has(item.id))candidates.push({speciesId:item.id,scientificName:item.scientificName,fieldPath:'presence',currentValue:'included',proposedValue:'review',sourceCode:'sibuy',sourceRecordId:null,confidence:0,decision:'review',rationale:'No aparece como especie aceptada en la resolución vigente; no se elimina automáticamente.'});
  const output=resolve(PATHS.reports,'target-group-enrichment-candidates.json');writeJson(output,{schemaVersion:1,generatedAt:new Date().toISOString(),targetClasses:[...TARGETS],candidateCount:candidates.length,candidates});
  console.log(`09-enrichment-candidates: ${candidates.length} candidatos; ${output}`);
}
main();
