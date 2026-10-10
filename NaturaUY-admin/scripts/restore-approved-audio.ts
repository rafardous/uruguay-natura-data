/** Recupera únicamente los clips previamente aprobados e incluidos en la app. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { adminClient, required } from './shared';
const source = resolve(import.meta.dirname, '../../NaturaUY-source');
const rows = JSON.parse(readFileSync(resolve(source, 'data/reference/media/approved-audio-baseline.json'), 'utf8'));
const actor = required('EDITORIAL_SYSTEM_USER_ID');
if (!/^[a-f0-9-]{36}$/i.test(actor)) throw new Error('Actor inválido');
const evidence = `${actor}/pedro-rinaldi-audios-authorization.txt`;
for (const row of rows) {
  if (row.author !== 'Pedro Rinaldi' || row.license !== 'Autorización adicional del titular' || !/^bundled:\/\/xc-\d+\.mp3$/.test(row.url) || row.duration_seconds > 15 || row.duration_seconds <= 0) throw new Error('Clip ajeno al snapshot aprobado');
}
if (process.argv.includes('--sql')) {
  console.log(`begin;
select set_config('request.jwt.claims',jsonb_build_object('sub','${actor}','role','authenticated')::text,true);
do $audio$ declare entry jsonb; target uuid; change_id uuid; begin
perform public.require_admin();
for entry in select value from jsonb_array_elements('${JSON.stringify(rows).replaceAll("'","''")}'::jsonb) loop
 select id into strict target from public.species where catalog_code=entry->>'catalogCode' and class='Aves' and status='active';
 if exists(select 1 from public.species_media where species_id=target and type='audio' and status not in ('archived','rejected')) then continue; end if;
 change_id:=public.submit_species_change(target,'media','{}','Recuperar audio previamente aprobado de Pedro Rinaldi');
 perform public.reserve_species_media_upload(target,change_id,'audio',entry->>'author','permission',entry->>'source',entry->>'source_url',replace(entry->>'url','bundled://',''),false,'${evidence}');
end loop; end $audio$; commit;`);
} else if (process.argv.includes('--process')) {
  const client = adminClient();
  const statement = `Arapy — autorización declarada por el titular del proyecto\nAutor: Pedro Rinaldi\nRegistrada por: ${actor}\nFecha: ${new Date().toISOString()}\nEl titular confirma que su padre, Pedro Rinaldi, autorizó todos sus medios, incluyendo los 177 clips de aves previamente aprobados e incluidos en Arapy. Se conservan las licencias originales de Xeno-canto como metadata histórica.\n`;
  const previous = await client.storage.from('media-evidence').download(evidence);
  if (!previous.data) { const saved = await client.storage.from('media-evidence').upload(evidence, Buffer.from(statement), { contentType:'text/plain', upsert:false }); if(saved.error)throw saved.error; }
  const {data:assets,error}=await client.from('species_media').select('*,species!inner(catalog_code)').eq('type','audio').in('status',['reserved','failed']); if(error)throw error;
  const hash=(body:Buffer)=>createHash('sha256').update(body).digest('hex');
  let next=0,ready=0; const failures:Array<{code:string;error:string}>=[];
  await Promise.all(Array.from({length:6},async()=>{while(next<(assets??[]).length){const asset=assets![next++]; const row=rows.find((r:any)=>r.catalogCode===asset.species.catalog_code && r.external_id && r.url.endsWith(asset.original_filename)); if(!row||asset.evidence_path!==evidence)continue;
    try {const body=readFileSync(resolve(source,'assets/audio',row.url.slice('bundled://'.length))); const path=`${asset.species_id}/${asset.id}.mp3`;
      const existing=await client.storage.from('media-public').download(path);
      if(existing.data){if(hash(Buffer.from(await existing.data.arrayBuffer()))!==hash(body))throw new Error('Checksum existente distinto');}else{const saved=await client.storage.from('media-public').upload(path,body,{contentType:'audio/mpeg',upsert:false,cacheControl:'31536000'});if(saved.error)throw saved.error;}
      const saved=await client.storage.from('media-public').download(path);if(saved.error||!saved.data||hash(Buffer.from(await saved.data.arrayBuffer()))!==hash(body))throw new Error('Falló verificación de Storage');
      const updated=await client.from('species_media').update({status:'ready',storage_path:path,checksum_sha256:hash(body),external_id:row.external_id,original_license:row.original_license,clip_start_seconds:0,clip_duration_seconds:row.duration_seconds,authorization_evidence_ref:evidence,selection_details:{restoredFrom:'approved bundled audio baseline'},processed_at:new Date().toISOString()}).eq('id',asset.id);if(updated.error)throw updated.error;ready++;
    }catch(error){failures.push({code:row.catalogCode,error:String(error)});}
  }}));console.log(JSON.stringify({ready,failures},null,2));if(failures.length)process.exitCode=1;
} else console.log(JSON.stringify({clips:rows.length,mode:'dry-run'}));
