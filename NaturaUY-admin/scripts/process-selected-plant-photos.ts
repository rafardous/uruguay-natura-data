import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { adminClient } from './shared';
const client = adminClient();
const animals = process.argv.includes('--animals');
const plants = animals ? JSON.parse(readFileSync(resolve(import.meta.dirname,'../../NaturaUY-source/data/reference/media/approved-image-baseline.json'),'utf8')).map((row:any)=>({...row,media:{image:row.image}})) : JSON.parse(readFileSync(resolve(import.meta.dirname,'../../NaturaUY-source/data/catalog/plantae.json'),'utf8'));
const byCode = new Map<string,any>(plants.map((row:any)=>[row.catalogCode,row]));
const {data:assets,error}=await client.from('species_media').select('*,species!inner(catalog_code,kingdom,status)').eq('type','image').in('status',['reserved','failed']).eq('species.kingdom',animals?'Animalia':'Plantae').eq('species.status','active');
if(error)throw error;
console.log(`Pendientes: ${(assets??[]).length}; snapshot: ${plants.length}`);
const hash=(body:Buffer)=>createHash('sha256').update(body).digest('hex');
let next=0; let ready=0; const failures:Array<{code:string;reason:string}>=[];
await Promise.all(Array.from({length:6},async()=>{while(next<(assets??[]).length){const asset=assets![next++]; const code=asset.species.catalog_code; const row=byCode.get(code); if(!row?.media.image||asset.license!==row.media.image.license||!['CC0','CC-BY-4.0'].includes(asset.license)||asset.source_url!==row.media.image.sourcePage)continue;
  try {
    const response=await fetch(row.media.image.fullUrl,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'Arapy-approved-media-restoration/1.0'}}); if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const original=Buffer.from(await response.arrayBuffer()); if(original.length>20*1024*1024)throw new Error('Imagen demasiado grande');
    const input=sharp(original,{failOn:'error',limitInputPixels:50000000}); const meta=await input.metadata(); if(!['jpeg','png','webp'].includes(meta.format??'')||!meta.width||!meta.height)throw new Error('Imagen inválida');
    const main=await input.clone().rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:80,effort:5}).toBuffer();
    const thumb=await input.clone().rotate().resize({width:480,height:480,fit:'inside',withoutEnlargement:true}).webp({quality:76,effort:5}).toBuffer();
    const path=`${asset.species_id}/${asset.id}.webp`; const thumbnail=path.replace('.webp','-480.webp');
    for(const [key,body] of [[path,main],[thumbnail,thumb]] as const){const existing=await client.storage.from('media-public').download(key); if(existing.data){if(hash(Buffer.from(await existing.data.arrayBuffer()))!==hash(body))throw new Error('Objeto existente con otro checksum');}else{const uploaded=await client.storage.from('media-public').upload(key,body,{contentType:'image/webp',upsert:false,cacheControl:'31536000'});if(uploaded.error)throw uploaded.error;}const saved=await client.storage.from('media-public').download(key);if(saved.error||!saved.data||hash(Buffer.from(await saved.data.arrayBuffer()))!==hash(body))throw new Error('Falló SHA-256 en Storage');}
    const updated=await client.from('species_media').update({status:'ready',storage_path:path,thumbnail_path:thumbnail,checksum_sha256:hash(main),license_url:row.media.image.licenseUrl,original_license:row.media.image.originalLicense,external_id:animals?null:row.media.image.externalId,source_width:meta.width,source_height:meta.height,selection_details:{restoredFrom:animals?'approved animal catalog':'seed-100 approved catalog',sourceExternalId:row.media.image.externalId,thumbnailSha256:hash(thumb)},processed_at:new Date().toISOString(),processing_error:null}).eq('id',asset.id);if(updated.error)throw updated.error;
    ready++; if(ready%20===0)console.log(`Fotos verificadas: ${ready}`);
  }catch(error){const reason=error instanceof Error?error.message:JSON.stringify(error);failures.push({code,reason});console.error(`${code}: ${reason}`);}
}}));
console.log(JSON.stringify({ready,failures},null,2)); if(failures.length)process.exitCode=1;
