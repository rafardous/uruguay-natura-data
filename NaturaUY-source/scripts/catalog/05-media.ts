/** Stage 05 — deterministic, license-safe selection of one identification image per species. */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fetchJson, RateLimiter } from '../lib/http';
import { PATHS, ensureDirs, readJson, writeJson, type CatalogImage } from './lib';

interface ResolvedItem { scientificName:string; resolution:{acceptedName:string|null} }
interface PlantItem { scientificName:string; acceptedName:string|null }
interface InatPhoto { id?:number; sha1?:string|null; url?:string; license_code?:string|null; attribution?:string; original_dimensions?:{width?:number;height?:number} }
interface InatObservation { id?:number; photos?:InatPhoto[] }
interface InatResponse { results?:InatObservation[] }
interface InatTaxa { results?:Array<{id?:number;name?:string;taxon_photos?:Array<{photo?:InatPhoto}>}> }
interface WikiPages { query?:{pages?:Record<string,{pageimage?:string;original?:{source?:string}}>} }
interface WikiInfo { query?:{pages?:Record<string,{imageinfo?:Array<{descriptionurl?:string;sha1?:string;width?:number;height?:number;extmetadata?:Record<string,{value?:string}>}>}>} }

// iNaturalist's `cc-by` code does not expose the licence version. Natura UY
// cannot infer CC BY 4.0 from it, so only exact CC0 media is publishable there.
const ALLOWED_INAT=new Set(['cc0']);
const ALLOWED_WIKI=/^(cc0|cc by 4\.0)/i;
const LICENSE_URLS:Record<string,string>={cc0:'https://creativecommons.org/publicdomain/zero/1.0/'};
const URUGUAY_PLACE_ID=7259;
const inatLimiter=new RateLimiter(1_000); const wikiLimiter=new RateLimiter(150);
const inatSize=(url:string,size:'medium'|'large')=>url.replace(/\/(square|small|medium|large|original)\.(jpe?g|png|gif)/i,`/${size}.$2`);
const stripHtml=(value:string)=>value.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();

function score(photo:InatPhoto,curated:boolean,uruguay:boolean):number{
  const width=photo.original_dimensions?.width??0; const height=photo.original_dimensions?.height??0;
  const resolution=Math.min(30,Math.log2(Math.max(1,width*height))*1.2);
  const crop=Math.min(width,height)>0?Math.min(width,height)/Math.max(width,height)*10:0;
  return Math.round((curated?50:25)+resolution+crop+(uruguay?10:0)+(photo.license_code?.toLowerCase()==='cc0'?3:0));
}

function inatImage(photo:InatPhoto,taxonId:number,observationId:number|null,curated:boolean,uruguay:boolean):CatalogImage|null{
  const license=photo.license_code?.toLowerCase(); if(!photo.url||!license||!ALLOWED_INAT.has(license))return null;
  const width=photo.original_dimensions?.width; const height=photo.original_dimensions?.height;if(!width||!height||Math.max(width,height)<1200)return null;
  return {url:inatSize(photo.url,'medium'),fullUrl:inatSize(photo.url,'large'),license:'CC0',originalLicense:license,attribution:photo.attribution??'iNaturalist',source:'inaturalist',sourcePage:observationId?`https://www.inaturalist.org/observations/${observationId}`:`https://www.inaturalist.org/taxa/${taxonId}`,licenseUrl:LICENSE_URLS[license],externalId:photo.id?`inat-photo:${photo.id}`:undefined,sourceTaxonId:String(taxonId),sourceChecksum:photo.sha1??null,width,height,selectionScore:score(photo,curated,uruguay),selectionDetails:{curated,uruguay,resolutionWidth:width??0,resolutionHeight:height??0},retrievedAt:new Date().toISOString()};
}

async function resolveTaxon(name:string):Promise<{id:number;photos:InatPhoto[]}|null>{
  const response=await fetchJson<InatTaxa>(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(name)}&rank=species&per_page=10`,{limiter:inatLimiter});
  const exact=response?.results?.find((item)=>item.id&&item.name?.toLocaleLowerCase()===name.toLocaleLowerCase());
  return exact?.id?{id:exact.id,photos:(exact.taxon_photos??[]).map((item)=>item.photo).filter((item):item is InatPhoto=>Boolean(item))}:null;
}

async function observations(taxonId:number,uruguay:boolean):Promise<CatalogImage|null>{
  const params=new URLSearchParams({taxon_id:String(taxonId),photo_license:'cc0',quality_grade:'research',per_page:'30',order_by:'votes'});if(uruguay)params.set('place_id',String(URUGUAY_PLACE_ID));
  const response=await fetchJson<InatResponse>(`https://api.inaturalist.org/v1/observations?${params}`,{limiter:inatLimiter});
  return (response?.results??[]).flatMap((observation)=>(observation.photos??[]).map((photo)=>inatImage(photo,taxonId,observation.id??null,false,uruguay))).filter((item):item is CatalogImage=>Boolean(item)).sort((a,b)=>(b.selectionScore??0)-(a.selectionScore??0))[0]??null;
}

async function wikimedia(name:string,lang:'es'|'en'):Promise<CatalogImage|null>{
  const pageParams=new URLSearchParams({action:'query',prop:'pageimages',piprop:'original|name',format:'json',redirects:'1',titles:name});const page=await fetchJson<WikiPages>(`https://${lang}.wikipedia.org/w/api.php?${pageParams}`,{limiter:wikiLimiter});const entry=Object.values(page?.query?.pages??{})[0];if(!entry?.pageimage||!entry.original?.source)return null;
  const infoParams=new URLSearchParams({action:'query',prop:'imageinfo',iiprop:'url|size|sha1|extmetadata',format:'json',titles:`File:${entry.pageimage}`});const info=await fetchJson<WikiInfo>(`https://commons.wikimedia.org/w/api.php?${infoParams}`,{limiter:wikiLimiter});const imageInfo=Object.values(info?.query?.pages??{})[0]?.imageinfo?.[0];const metadata=imageInfo?.extmetadata;const license=stripHtml(metadata?.LicenseShortName?.value??'');if(!license||!ALLOWED_WIKI.test(license))return null;if(!imageInfo?.width||!imageInfo.height||Math.max(imageInfo.width,imageInfo.height)<1200)return null;
  const ccBy=/^cc by 4\.0/i.test(license);const cc0=/^cc0/i.test(license);if(!ccBy&&!cc0)return null;const artist=stripHtml(metadata?.Artist?.value??'')||'Wikimedia Commons';return {url:entry.original.source,fullUrl:entry.original.source,license:ccBy?'CC-BY-4.0':'CC0',originalLicense:license,attribution:`${artist} vía Wikimedia Commons`,source:'wikimedia',sourcePage:imageInfo?.descriptionurl??null,licenseUrl:ccBy?'https://creativecommons.org/licenses/by/4.0/':LICENSE_URLS.cc0,externalId:`commons:${entry.pageimage}`,sourceChecksum:imageInfo?.sha1??null,width:imageInfo?.width,height:imageInfo?.height,selectionScore:20,selectionDetails:{curated:false,uruguay:false,wikimedia:true,licenseLabel:license},retrievedAt:new Date().toISOString()};
}

function readLimit():number{const inline=process.argv.find((arg)=>arg.startsWith('--limit='));if(inline)return Number(inline.slice(8));const index=process.argv.indexOf('--limit');return index>=0?Number(process.argv[index+1]):Number.POSITIVE_INFINITY;}
async function findImage(accepted:string,originals:string[]):Promise<CatalogImage|null>{for(const name of [accepted,...originals.filter((item)=>item!==accepted)]){const taxon=await resolveTaxon(name);if(!taxon)continue;const curated=taxon.photos.map((photo)=>inatImage(photo,taxon.id,null,true,false)).filter((item):item is CatalogImage=>Boolean(item)).sort((a,b)=>(b.selectionScore??0)-(a.selectionScore??0))[0];if(curated)return curated;const local=await observations(taxon.id,true);if(local)return local;const global=await observations(taxon.id,false);if(global)return global;}return await wikimedia(accepted,'es')??await wikimedia(accepted,'en');}

async function main():Promise<void>{ensureDirs();const onlyPlants=process.argv.includes('--only-plants');const resolved=onlyPlants?[]:readJson<ResolvedItem[]>(PATHS.resolved);const plantsFile=resolve(PATHS.catalog,'plantae.json');const plants=onlyPlants?(existsSync(plantsFile)?readJson<PlantItem[]>(plantsFile):[]):[];const cache=existsSync(PATHS.media)?readJson<Record<string,CatalogImage|null>>(PATHS.media):{};const retryMissing=process.argv.includes('--retry-missing');const reelectAll=process.argv.includes('--reelect-all');const reelectWikimedia=process.argv.includes('--reelect-wikimedia');const retryInvalid=process.argv.includes('--retry-invalid');const isInvalid=(item:CatalogImage|null|undefined)=>Boolean(item&&(!item.width||!item.height||Math.max(item.width,item.height)<1200||!['CC0','CC-BY-4.0'].includes(item.license)||!item.licenseUrl));const limit=readLimit();if((!Number.isFinite(limit)&&limit!==Number.POSITIVE_INFINITY)||limit<=0)throw new Error('--limit must be a positive number');const originalsByAccepted=new Map<string,string[]>();for(const row of resolved){const accepted=row.resolution.acceptedName;if(!accepted)continue;const names=originalsByAccepted.get(accepted)??[];if(!names.includes(row.scientificName))names.push(row.scientificName);originalsByAccepted.set(accepted,names);}for(const row of plants){const accepted=row.acceptedName??row.scientificName;const names=originalsByAccepted.get(accepted)??[];if(!names.includes(row.scientificName))names.push(row.scientificName);originalsByAccepted.set(accepted,names);}const pending=[...originalsByAccepted].filter(([name])=>reelectAll||!(name in cache)||(retryMissing&&cache[name]===null)||(reelectWikimedia&&cache[name]?.source==='wikimedia')||(retryInvalid&&isInvalid(cache[name]))).slice(0,limit);console.log(`05-media: ${pending.length} pending (${onlyPlants?'Plantae':'Animalia'}); CC0 iNaturalist → CC0/CC BY 4.0 Wikimedia`);let found=0;for(const [index,[accepted,originals]] of pending.entries()){let image=await findImage(accepted,originals);if(image?.externalId&&Object.entries(cache).some(([name,item])=>name!==accepted&&item?.externalId===image?.externalId))image=null;cache[accepted]=image;writeJson(PATHS.media,cache);if(image)found++;if((index+1)%25===0)console.log(`  ${index+1}/${pending.length} evaluadas; ${found} seleccionadas`);}const scopedHits=[...originalsByAccepted.keys()].map((name)=>cache[name]).filter((item):item is CatalogImage=>item!==null&&!isInvalid(item));const countBy=(key:'source'|'license')=>Object.fromEntries([...new Set(scopedHits.map((item)=>item[key]))].sort().map((value)=>[value,scopedHits.filter((item)=>item[key]===value).length]));const reportName=onlyPlants?'plant-image-selection-report.json':'image-selection-report.json';writeJson(`${PATHS.reports}/${reportName}`,{schemaVersion:1,generatedAt:new Date().toISOString(),scope:onlyPlants?'Plantae':'Animalia',speciesCount:originalsByAccepted.size,selectedCount:scopedHits.length,missingCount:originalsByAccepted.size-scopedHits.length,coverage:scopedHits.length/originalsByAccepted.size,bySource:countBy('source'),byLicense:countBy('license'),missing:[...originalsByAccepted.keys()].filter((name)=>!cache[name]||isInvalid(cache[name]))});console.log(`  ${found}/${pending.length} selected; valid ${onlyPlants?'plant':'animal'} coverage ${scopedHits.length}/${originalsByAccepted.size}`);}
main().catch((error:unknown)=>{console.error(error);process.exit(1);});
