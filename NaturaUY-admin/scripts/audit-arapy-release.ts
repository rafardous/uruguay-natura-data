import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadApprovedCatalog } from './catalog-data';
const source = resolve(import.meta.dirname, '../../NaturaUY-source');
const items = await loadApprovedCatalog();
const birds = items.filter((item) => item.species.class === 'Aves');
const profiles = birds.filter((item) => item.species.natural_history?.bird);
const originalProfiles = JSON.parse(readFileSync(resolve(source, 'data/reference/azpiroz-2003/normalized.json'), 'utf8'));
const canonical = (value:any):string => JSON.stringify(value && typeof value==='object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map((key)=>[key,JSON.parse(canonical(value[key]))])) : Array.isArray(value) ? value.map((item)=>JSON.parse(canonical(item))) : value);
for (const row of originalProfiles.filter((row:any)=>row.speciesId)) {
  const actual=profiles.find((item)=>item.species.natural_history.bird.guide.number===row.number);
  if(!actual || canonical(actual.species.natural_history.bird)!==canonical(row.profile)) throw new Error(`Perfil editorial distinto del Excel auditado: ${row.number}`);
  for (const field of ['measurements','presence','habitat','diet','abundanceCode']) {
    const value=row.profile[field]; if(!(Array.isArray(value)?value.length:Boolean(value)))continue;
    if(!Object.keys(actual.species.field_sources).some((key)=>key.includes(field) && actual.species.field_sources[key]?.some((ref:string)=>ref.startsWith('azpiroz_2003:'))))throw new Error(`Campo sin procedencia Azpiroz: ${row.number}/${field}`);
  }
}
const crosswalk = JSON.parse(readFileSync(resolve(source, 'data/reference/azpiroz-2003/crosswalk.json'), 'utf8')) as Array<Record<string, any>>;
const correspondence = crosswalk.map((row) => {
  const item = row.speciesId ? birds.find((item) => item.species.natural_history?.bird?.guide?.number === row.number) : null;
  if (row.speciesId && !item) throw new Error(`Falta correspondencia editorial ${row.number}`);
  return { ...row, catalogCode: item?.species.catalog_code ?? null, editorialSpeciesId: item?.species.id ?? null };
});
if (profiles.length !== 432 || new Set(correspondence.filter((row) => row.editorialSpeciesId).map((row) => row.editorialSpeciesId)).size !== 432) throw new Error('Cobertura Azpiroz incorrecta');
const plants = items.filter((item) => item.species.kingdom === 'Plantae');
const photoGaps = plants.filter((item) => !item.image).map((item) => item.species.scientific_name);
const originGaps = plants.filter((item) => item.species.origin !== 'native' || !item.species.field_sources?.origin?.length).map((item) => item.species.scientific_name);
const report = { checkedAt: new Date().toISOString(), schemaVersion: 14, selectedSpecies: items.length, animals: items.length-plants.length, plants: plants.length, birds: birds.length, birdProfiles: profiles.length,
  birdPhotos: birds.reduce((sum,item)=>sum+item.images.length,0), twoPhotoBirds: birds.filter((item)=>item.images.length===2).length,
  coverage: Object.fromEntries(['measurements','presence','habitat','diet','abundanceCode'].map((field)=>[field,profiles.filter((item)=>{const value=item.species.natural_history.bird[field];return Array.isArray(value)?value.length:Boolean(value);}).length])),
  plantPhotoGaps:photoGaps, plantOriginGaps:originGaps };
if (process.argv.includes('--write')) { writeFileSync(resolve(source,'data/reference/azpiroz-2003/crosswalk-editorial.json'),JSON.stringify(correspondence,null,2)+'\n'); writeFileSync(resolve(source,'data/reports/arapy-release-audit.json'),JSON.stringify(report,null,2)+'\n'); }
console.log(JSON.stringify(report,null,2));
