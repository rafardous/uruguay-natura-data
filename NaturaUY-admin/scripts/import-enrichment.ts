import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { adminClient, chunks } from './shared';

type Report={targetClasses:string[];sourceVersions?:Record<string,string>;candidates:Array<Record<string,any>>};
const reports=resolve(import.meta.dirname,'../../NaturaUY-source/data/reports');
const taxonomy=JSON.parse(readFileSync(resolve(reports,'target-group-enrichment-candidates.json'),'utf8')) as Report;
const traitPath=resolve(reports,'trait-enrichment-candidates.json');
const traits:Report=existsSync(traitPath)?JSON.parse(readFileSync(traitPath,'utf8')):{targetClasses:[],candidates:[]};
const candidates=[...taxonomy.candidates,...traits.candidates];
const observability=JSON.parse(readFileSync(resolve(reports,'observability-snapshots.json'),'utf8')) as {complete:boolean;snapshots:Array<Record<string,any>>};
const apply=process.argv.includes('--apply');console.log(`${candidates.length} candidatos; ${observability.snapshots.length} snapshots (${observability.complete?'completos':'parciales'}).`);if(!apply){console.log('Dry run: agregá --apply para importar en Supabase.');process.exit(0);}
const client=adminClient();const [{data:species,error:speciesError},{data:sources,error:sourcesError}]=await Promise.all([client.from('species').select('id,catalog_code,scientific_name'),client.from('catalog_sources').select('id,code,use_policy')]);if(speciesError)throw speciesError;if(sourcesError)throw sourcesError;
const speciesByName=new Map((species??[]).map((row)=>[String(row.scientific_name).toLocaleLowerCase(),row]));const sourceByCode=new Map((sources??[]).map((row)=>[row.code,row]));
const {data:run,error:runError}=await client.from('enrichment_runs').insert({target_classes:[...new Set([...taxonomy.targetClasses,...traits.targetClasses])],status:'running',source_versions:{candidateSchema:1,traitSchema:1,observabilityMethod:'gbif-uy-observability-v1',...(taxonomy.sourceVersions??{}),...(traits.sourceVersions??{})}}).select('id').single();if(runError)throw runError;
const candidateRows=candidates.map((row)=>{const source=sourceByCode.get(row.sourceCode);const referenceOnly=source?.use_policy!=='redistributable';return {run_id:run.id,species_id:speciesByName.get(String(row.scientificName).toLocaleLowerCase())?.id??null,catalog_code:row.speciesId,scientific_name:row.scientificName,field_path:row.fieldPath,current_value:row.currentValue,proposed_value:row.proposedValue,source_id:source?.id,source_record_id:row.sourceRecordId,confidence:row.confidence,status:row.decision==='review'||referenceOnly?'conflict':'pending',rationale:referenceOnly?`${row.rationale} · Fuente de referencia: publicación automática bloqueada.`:row.rationale};}).filter((row)=>row.species_id&&row.source_id);
for(const batch of chunks(candidateRows,500)){const {error}=await client.from('enrichment_candidates').insert(batch);if(error)throw error;}
if(!observability.complete)console.log('Observabilidad incompleta: los snapshots se omiten hasta completar todas las especies.');
const snapshotRows=(observability.complete?observability.snapshots:[]).map((row)=>({species_id:speciesByName.get(String(row.scientificName).toLocaleLowerCase())?.id,method_version:row.methodVersion,period_start:row.periodStart,period_end:row.periodEnd,occurrence_count:row.occurrenceCount,occupied_cells:row.occupiedCells,years_observed:row.yearsObserved,score:row.score,band:row.band,comparison_class:row.comparisonClass,source_id:sourceByCode.get(row.sourceCode)?.id,metadata:row.metadata})).filter((row)=>row.species_id&&row.source_id);
for(const batch of chunks(snapshotRows,500)){const {error}=await client.from('species_observability_snapshots').upsert(batch,{onConflict:'species_id,method_version,period_start,period_end'});if(error)throw error;}
const {error:finishError}=await client.from('enrichment_runs').update({status:'completed',completed_at:new Date().toISOString(),summary:{candidates:candidateRows.length,observabilitySnapshots:snapshotRows.length,observabilityComplete:observability.complete}}).eq('id',run.id);if(finishError)throw finishError;console.log(`Corrida ${run.id} importada.`);
