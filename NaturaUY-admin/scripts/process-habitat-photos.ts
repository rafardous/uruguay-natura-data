import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { adminClient, required, stableUuid } from './shared';
import { imageVariants } from './media-image';

type Selection={title:string;sourceUrl:string;author:string;license:string;licenseUrl:string;location:string;caption:string;codes:string[];reviewedAt:string};
const selected=JSON.parse(readFileSync(resolve(import.meta.dirname,'habitat-photo-selection.json'),'utf8')) as Selection[];
const client=adminClient();
const actor=required('EDITORIAL_SYSTEM_USER_ID');
if(!/^[0-9a-f-]{36}$/i.test(actor))throw new Error('Invalid editorial actor');
const local=resolve(import.meta.dirname,'../../.tmp/habitats/photos');
const assets=resolve(import.meta.dirname,'../../NaturaUY-source/assets/images/habitats');
mkdirSync(local,{recursive:true});mkdirSync(assets,{recursive:true});
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const sql=(value:unknown)=>JSON.stringify(value).replaceAll("'","''");
const records:Record<string,unknown>[]=[];const evidence:Record<string,unknown>[]=[];
for(const selection of selected) {
  if(!selection.reviewedAt)throw new Error('Photo has not been reviewed');
  const url=new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({action:'query',titles:selection.title,prop:'imageinfo',iiprop:'url|size|extmetadata|sha1|timestamp',format:'json'}).forEach(([k,v])=>url.searchParams.set(k,v));
  const response=await fetch(url,{headers:{'User-Agent':'Arapy/1.4 biodiversity education, photo rights audit'}});
  if(!response.ok)throw new Error('Commons metadata unavailable');
  const payload=await response.json();
  const info=(Object.values(payload.query.pages)[0] as any).imageinfo[0];
  const meta=info.extmetadata;
  const license=meta.LicenseShortName?.value==='CC0'?'CC0':meta.LicenseShortName?.value==='CC BY 4.0'?'CC-BY-4.0':null;
  const author=String(meta.Artist?.value??'').replace(/<[^>]*>/g,'');
  if(license!==selection.license||author!==selection.author||info.descriptionurl!==selection.sourceUrl||meta.LicenseUrl?.value!==selection.licenseUrl)throw new Error(`Provenance changed: ${selection.title}`);
  if(!/^https:\/\/upload\.wikimedia\.org\//.test(info.url)||info.size>20*1024*1024)throw new Error('Invalid original photo');
  const originalResponse=await fetch(info.url);if(!originalResponse.ok)throw new Error('Original unavailable');
  const original=Buffer.from(await originalResponse.arrayBuffer());
  const {main,thumbnail}=await imageVariants(original);
  const originalFile=resolve(local,stableUuid(selection.title)+'.original');
  writeFileSync(originalFile,original);
  evidence.push({selection,metadata:info,originalSha256:sha(original),mainSha256:sha(main),thumbnailSha256:sha(thumbnail)});
  for(const code of selection.codes) {
    const habitatId=stableUuid(`habitat:${code}`);const id=stableUuid(`habitat-photo:${code}:${selection.title}`);
    const path=`habitats/${habitatId}/${id}.webp`;const thumb=`habitats/${habitatId}/${id}-480.webp`;
    for(const [key,bytes] of [[path,main],[thumb,thumbnail]] as const) {
      const {error}=await client.storage.from('media-public').upload(key,bytes,{contentType:'image/webp',upsert:true,cacheControl:'31536000'});if(error)throw error;
      const {data,error:readError}=await client.storage.from('media-public').download(key);
      if(readError||!data||sha(new Uint8Array(await data.arrayBuffer()))!==sha(bytes))throw new Error(`storage_verification_failed:${key}`);
    }
    writeFileSync(resolve(assets,`${id}.webp`),thumbnail);
    records.push({id,habitat_id:habitatId,status:'approved',author,license,source_url:selection.sourceUrl,license_url:selection.licenseUrl,evidence_path:null,location:selection.location,caption:selection.caption,storage_path:path,thumbnail_path:thumb,checksum_sha256:sha(main)});
  }
  console.log(`Verificada: ${selection.title} (${selection.codes.length} ambientes)`);
}
// La carga SQL exige la identidad editorial real y crea una revisión por medio.
writeFileSync(resolve(local,'register.sql'),`begin; select set_config('request.jwt.claims',jsonb_build_object('sub','${actor}','role','authenticated')::text,true);\n${records.map(record=>`select public.save_habitat_media('${sql(record)}'::jsonb,'Fotografía real verificada individualmente');`).join('\n')}\ncommit;\n`);
writeFileSync(resolve(local,'rights-evidence.json'),JSON.stringify(evidence,null,2));
writeFileSync(resolve(local,'records.json'),JSON.stringify(records,null,2));
writeFileSync(resolve(import.meta.dirname,'../../NaturaUY-source/src/data/assets/habitatThumbMap.ts'),`// Generado desde fotografías aprobadas, verificadas en Storage.\nexport const habitatThumbMap: Record<string, number> = {\n${records.map(record=>`  '${record.id}': require('../../../assets/images/habitats/${record.id}.webp'),`).join('\n')}\n};\n`);
console.log(`${records.length} medios verificados; SQL auditado listo. Los originales se conservan hasta confirmar la carga.`);
