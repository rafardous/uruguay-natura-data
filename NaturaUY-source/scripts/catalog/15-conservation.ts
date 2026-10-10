/** Build reviewable national/IUCN conservation assessments for schema 14. */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { PATHS, readJson, writeJson } from './lib';

type Category = 'DD'|'LC'|'NT'|'VU'|'EN'|'CR'|'EW'|'EX'|'RE';
interface Candidate { scientificName: string; system: 'uy_red_list'|'iucn_global'; category: Category; sourceCode: string; sourceRecordId: string|null; version: string|null; assessedAt: string|null }
interface NationalInput { sourceCode: 'lista_roja_uy'; version: string; assessedAt?: string|null; assessments: Array<{ scientificName:string; category:Exclude<Category,'EW'|'EX'>; sourceRecordId?:string|null }> }

const token = process.env.IUCN_RED_LIST_TOKEN;
const cacheAllowed = process.env.IUCN_CACHE_PERMISSION_CONFIRMED === 'true';
const nationalPath = process.env.NATIONAL_RED_LIST_PATH;
const onlyNational = process.argv.includes('--national-only');
const output: Candidate[] = [];

if (nationalPath) {
  const national = readJson<NationalInput>(resolve(nationalPath));
  if (national.sourceCode !== 'lista_roja_uy' || !national.version || !Array.isArray(national.assessments)) throw new Error('invalid_national_red_list_input');
  for (const row of national.assessments) output.push({ scientificName:row.scientificName,system:'uy_red_list',category:row.category,sourceCode:national.sourceCode,sourceRecordId:row.sourceRecordId??null,version:national.version,assessedAt:national.assessedAt??null });
}

if (!onlyNational) {
  if (!token) throw new Error('IUCN_RED_LIST_TOKEN is required');
  if (!cacheAllowed) throw new Error('Set IUCN_CACHE_PERMISSION_CONFIRMED=true only after IUCN confirms caching/redistribution permission');
  const catalogFiles = ['aves','mammalia','reptilia','amphibia','actinopterygii','chondrichthyes','arachnida','insecta','malacostraca','plantae'];
  const names = [...new Set(catalogFiles.flatMap((file) => {
    const path = resolve(PATHS.catalog, `${file}.json`);
    return existsSync(path) ? readJson<Array<{ scientificName:string; acceptedName?:string|null }>>(path).map((row) => row.acceptedName ?? row.scientificName) : [];
  }))].sort();
  const cachePath = resolve(PATHS.cache, 'iucn-red-list-v4.json');
  const cache = existsSync(cachePath) ? readJson<Record<string, unknown>>(cachePath) : {};
  for (const [index, scientificName] of names.entries()) {
    let response = cache[scientificName] as Record<string, unknown>|undefined;
    if (!response) {
      const [genusName, ...speciesParts] = scientificName.split(/\s+/);
      if (!genusName || speciesParts.length === 0) continue;
      const url = new URL('https://api.iucnredlist.org/api/v4/taxa/scientific_name');
      url.searchParams.set('genus_name',genusName); url.searchParams.set('species_name',speciesParts.join(' '));
      const request = await fetch(url,{headers:{Authorization:token,Accept:'application/json'}});
      if (request.status===404) { cache[scientificName]={assessments:[]}; continue; }
      if (!request.ok) throw new Error(`iucn_${request.status}:${scientificName}`);
      response=await request.json() as Record<string,unknown>; cache[scientificName]=response;
      writeJson(cachePath,cache);
      await new Promise((done)=>setTimeout(done,300));
    }
    const assessments = Array.isArray(response.assessments) ? response.assessments as Array<Record<string,unknown>> : [];
    const current = assessments[0] ?? {};
    const category = current.red_list_category_code ?? current.category;
    if (typeof category==='string' && ['DD','LC','NT','VU','EN','CR','EW','EX'].includes(category)) output.push({scientificName,system:'iucn_global',category:category as Category,sourceCode:'iucn_red_list',sourceRecordId:typeof current.assessment_id==='string'?current.assessment_id:null,version:typeof current.year_published==='string'?current.year_published:null,assessedAt:typeof current.assessment_date==='string'?current.assessment_date:null});
    if ((index+1)%100===0) console.log(`IUCN ${index+1}/${names.length}`);
  }
}

writeJson(resolve(PATHS.normalized,'conservation-assessments.json'),{schemaVersion:14,generatedAt:new Date().toISOString(),requiresHumanApproval:true,assessments:output});
console.log(`15-conservation: ${output.length} candidates; none are published automatically`);
