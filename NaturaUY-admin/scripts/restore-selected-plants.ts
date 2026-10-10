/** Recupera los datos y fotos CC0 del JSON de 100 plantas indicado por el usuario. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { required } from './shared';
const rows = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../NaturaUY-source/data/catalog/plantae.json'), 'utf8'));
if (rows.length !== 100 || new Set(rows.map((row: any) => row.catalogCode)).size !== 100) throw new Error('Snapshot vegetal inválido');
const planned = rows.map((row: any) => {
  const image = row.media?.image;
  if (image && (image.license !== 'CC0' || image.licenseUrl !== 'https://creativecommons.org/publicdomain/zero/1.0/' || !image.fullUrl?.startsWith('https://') || !image.sourcePage?.startsWith('https://'))) throw new Error(`Derechos inválidos: ${row.catalogCode}`);
  const origin = row.sources.filter((ref: any) => ref.fieldPath === 'origin').map((ref: any) => `${ref.source}: ${ref.record}`);
  if (row.origin === 'native' && !origin.length) throw new Error(`Origen sin fuente: ${row.catalogCode}`);
  return { code: row.catalogCode, name: row.scientificName, commonName: row.commonName, commonNames: row.commonNames ?? [], origin: row.origin, originSources: origin, image };
});
if (!process.argv.includes('--sql')) { console.log(JSON.stringify({ plants: planned.length, photos: planned.filter((row: any)=>row.image).length, native: planned.filter((row: any)=>row.origin==='native').length, mode:'dry-run' })); process.exit(0); }
const actor = required('EDITORIAL_SYSTEM_USER_ID');
if (!/^[a-f0-9-]{36}$/i.test(actor)) throw new Error('Actor inválido');
console.log(`begin;
select set_config('request.jwt.claims',jsonb_build_object('sub','${actor}','role','authenticated')::text,true);
do $restore$
declare entry jsonb; current_row public.species; patch jsonb; v_references jsonb; change_id uuid; pending_id uuid;
begin
  perform public.require_admin();
  for entry in select value from jsonb_array_elements('${JSON.stringify(planned).replaceAll("'","''")}'::jsonb) loop
    select * into strict current_row from public.species where catalog_code=entry->>'code' and scientific_name=entry->>'name' and kingdom='Plantae' and status='active' for update;
    v_references:=current_row.field_sources || jsonb_build_object('commonName',jsonb_build_array('natura_uy_editorial: seed-100'));
    if entry->>'origin'='native' then v_references:=v_references || jsonb_build_object('origin',entry->'originSources'); end if;
    patch:=jsonb_build_object('common_name',entry->'commonName','alternate_common_names',entry->'commonNames','field_sources',v_references);
    if entry->>'origin'='native' then patch:=patch||jsonb_build_object('origin','native'); end if;
    select id into pending_id from public.species_changes where species_id=current_row.id and status='pending' and comment='Recuperar datos y foto CC0 del JSON aprobado de 100 plantas' limit 1;
    if pending_id is not null then continue; end if;
    if current_row.common_name=entry->>'commonName' and current_row.field_sources=v_references
      and (entry->>'origin' is distinct from 'native' or current_row.origin='native')
      and (entry->'image'='null'::jsonb or exists(select 1 from public.species_media where species_id=current_row.id and type='image' and status='approved')) then continue; end if;
    change_id:=public.submit_species_change(current_row.id,'update',patch,'Recuperar datos y foto CC0 del JSON aprobado de 100 plantas');
    if entry->'image'<>'null'::jsonb and not exists(select 1 from public.species_media where species_id=current_row.id and type='image' and status='approved') then
      perform public.reserve_species_media_upload(current_row.id,change_id,'image',coalesce(nullif(entry#>>'{image,attribution}',''),'Autor no informado'), 'CC0',entry#>>'{image,source}',entry#>>'{image,sourcePage}',entry->>'code'||'.jpg',true,null);
    else perform public.review_species_change(change_id,true,true); end if;
  end loop;
end $restore$;
commit;`);

