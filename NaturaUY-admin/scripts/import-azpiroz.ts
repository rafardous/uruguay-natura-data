/** Approved maintenance import through the existing editorial RPCs.
 * SQL output is executed by an authorized database administrator, never the browser.
 * The named actor must be an active editor; no MFA claim or permission is fabricated.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Profile = { guide: { number: number }; measurements: { kind: string; valueCm: number; sex?: string }[]; abundanceCode: string | null };
const source = resolve(import.meta.dirname, '../../NaturaUY-source');
const rows = JSON.parse(readFileSync(resolve(source, 'data/reference/azpiroz-2003/normalized.json'), 'utf8')) as { speciesId: string | null; profile: Profile }[];
const correspondence = JSON.parse(readFileSync(resolve(source, 'data/reference/azpiroz-2003/crosswalk-editorial.json'), 'utf8')) as { number: number; catalogCode: string | null; editorialSpeciesId: string | null }[];
const catalog = JSON.parse(readFileSync(resolve(source, 'data/catalog/aves.json'), 'utf8')) as { id: string; catalogCode: string; sources: { source: string; sourceCode?: string; fieldPath: string; record: string }[] }[];
const byCode = new Map(catalog.map((row) => [row.catalogCode, row]));
const planned = rows.filter((row) => row.speciesId).map((row) => {
  const target = correspondence.find((entry) => entry.number === row.profile.guide.number);
  if (!target?.catalogCode || !target.editorialSpeciesId) throw new Error(`No editorial correspondence for ${row.speciesId}`);
  const item = byCode.get(target.catalogCode);
  if (!item) throw new Error(`No catalog record for ${target.catalogCode}`);
  const references = Object.fromEntries(item.sources.filter((ref) => (ref.sourceCode ?? ref.source) === 'azpiroz_2003').map((ref) => [ref.fieldPath, [`azpiroz_2003: ${ref.record}`]]));
  const abundance = ({ C: 'common', BC: 'fairly_common', PC: 'uncommon', R: 'rare' } as Record<string,string>)[row.profile.abundanceCode ?? ''];
  return { catalogCode: target.catalogCode, editorialSpeciesId: target.editorialSpeciesId, profile: row.profile, ...(abundance ? { abundance_status: abundance } : {}), field_sources: references };
});
const batchArg = process.argv.find((arg) => arg.startsWith('--batch='));
const batch = Number(batchArg?.split('=')[1] ?? 0);
const batchSize = 30;
if (!Number.isInteger(batch) || batch < 0) throw new Error('Invalid batch');
if (batch >= Math.ceil(planned.length / batchSize)) throw new Error('Batch outside planned range');
if (!process.argv.includes('--sql')) {
  console.log(JSON.stringify({ species: planned.length, batches: Math.ceil(planned.length / batchSize), mode: 'dry-run', catalogCodes: planned.map((row) => row.catalogCode) }));
} else {
  const actor = process.env.EDITORIAL_SYSTEM_USER_ID?.trim();
  if (!actor || !/^[a-f0-9-]{36}$/i.test(actor)) throw new Error('EDITORIAL_SYSTEM_USER_ID must identify the authorized active editor');
  const payload = JSON.stringify(planned.slice(batch * batchSize, (batch + 1) * batchSize)).replaceAll("'", "''");
  const query = `begin;
select set_config('request.jwt.claims', jsonb_build_object('sub','${actor}','role','authenticated')::text, true);
do $azpiroz$
declare entry jsonb; current_row public.species; patch jsonb; change_id uuid;
begin
  perform public.require_editor();
  insert into public.catalog_sources(code,name,publisher,license,use_policy,citation,version_label,metadata)
  values('azpiroz_2003','Azpiroz — Aves del Uruguay','Aves Uruguay — GUPECA','Referencia bibliográfica; sin licencia abierta atribuida','identifier_only','Azpiroz, A. B. (2003). Aves del Uruguay. Lista e introducción a su biología y conservación. 104 pp.','2003', '{"userReviewed":true,"factualDataOnly":true}')
  on conflict(code) do nothing;
  for entry in select value from jsonb_array_elements('${payload}'::jsonb) loop
    select * into strict current_row from public.species where id=(entry->>'editorialSpeciesId')::uuid and catalog_code=entry->>'catalogCode' and class='Aves' and status='active' for update;
    patch := jsonb_build_object('natural_history', coalesce(current_row.natural_history,'{}'::jsonb) || jsonb_build_object('version',1,'bird',entry->'profile'), 'field_sources',coalesce(current_row.field_sources,'{}'::jsonb) || (entry->'field_sources'));
    if entry ? 'abundance_status' then patch := patch || jsonb_build_object('abundance_status',entry->'abundance_status'); end if;
    if current_row.natural_history is not distinct from patch->'natural_history'
      and current_row.field_sources is not distinct from patch->'field_sources'
      and (not (entry ? 'abundance_status') or current_row.abundance_status is not distinct from entry->>'abundance_status') then continue; end if;
    change_id := public.submit_species_change(current_row.id,'update',patch,'Azpiroz 2003: Excel revisado y aprobado por el editor; importación reproducible, sin cambios taxonómicos ni de conservación.');
    perform public.review_species_change(change_id,true,true);
    if not exists(select 1 from public.species where id=current_row.id and natural_history->'bird'=entry->'profile') then raise exception 'bird_profile_not_saved'; end if;
  end loop;
end $azpiroz$;
commit;`;
  console.log(JSON.stringify({ batch, count: planned.slice(batch * batchSize, (batch + 1) * batchSize).length, query }));
}
