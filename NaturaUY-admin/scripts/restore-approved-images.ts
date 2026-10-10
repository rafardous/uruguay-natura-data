/** Sólo fotos abiertas del snapshot aprobado; no ejecuta búsquedas ni candidatos. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { required } from './shared';
const rows=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../NaturaUY-source/data/reference/media/approved-image-baseline.json'),'utf8'));
const actor=required('EDITORIAL_SYSTEM_USER_ID');
if(!/^[a-f0-9-]{36}$/i.test(actor))throw new Error('Actor inválido');
if(!process.argv.includes('--sql')){console.log(JSON.stringify({baseline:rows.length,mode:'dry-run'}));process.exit(0);}
console.log(`begin;
select set_config('request.jwt.claims',jsonb_build_object('sub','${actor}','role','authenticated')::text,true);
do $photos$ declare entry jsonb; target uuid; change_id uuid; begin
perform public.require_admin();
for entry in select value from jsonb_array_elements('${JSON.stringify(rows.map((row:any)=>({catalogCode:row.catalogCode,image:{license:row.image.license,attribution:row.image.attribution,source:row.image.source,sourcePage:row.image.sourcePage}}))).replaceAll("'","''")}'::jsonb) loop
 select id into target from public.species where catalog_code=entry->>'catalogCode' and kingdom='Animalia' and status='active';
 if target is null or exists(select 1 from public.species_media where species_id=target and type='image' and status not in ('archived','rejected')) then continue; end if;
 change_id:=public.submit_species_change(target,'media','{}','Recuperar imagen abierta previamente aprobada del catálogo animal');
 perform public.reserve_species_media_upload(target,change_id,'image',coalesce(entry#>>'{image,attribution}','Fuente externa'),entry#>>'{image,license}',entry#>>'{image,source}',entry#>>'{image,sourcePage}',entry->>'catalogCode'||'.jpg',true,null);
end loop; end $photos$; commit;`);
