/** Genera una transacción revisable; las bajas pasan por las RPCs y conservan historial. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { required } from './shared';
const seed = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../NaturaUY-source/data/raw/curated-plants/seed-100.json'), 'utf8'));
const selected = [...seed.arboles, ...seed.otras_plantas_nativas].map((row: { nombre_cientifico: string }) => row.nombre_cientifico);
if (selected.length !== 100 || new Set(selected).size !== 100) throw new Error('Selección inválida');
if (!process.argv.includes('--sql')) { console.log(JSON.stringify({ mode: 'dry-run', selected: selected.length, names: selected })); process.exit(0); }
const actor = required('EDITORIAL_SYSTEM_USER_ID');
if (!/^[a-f0-9-]{36}$/i.test(actor)) throw new Error('Actor inválido');
const payload = JSON.stringify(selected).replaceAll("'", "''");
console.log(`begin;
select set_config('request.jwt.claims',jsonb_build_object('sub','${actor}','role','authenticated')::text,true);
do $curation$
declare item public.species; change_id uuid; selected_names text[];
begin
  perform public.require_admin();
  select array_agg(value) into selected_names from jsonb_array_elements_text('${payload}'::jsonb);
  if (select count(*) from public.species where kingdom='Plantae' and status='active' and scientific_name=any(selected_names))<>100 then
    raise exception 'selected_plants_missing';
  end if;
  for item in select * from public.species where kingdom='Plantae' and status='active' and not(scientific_name=any(selected_names)) order by catalog_code for update loop
    change_id:=public.submit_species_change(item.id,'archive','{}','Selección aprobada: conservar únicamente las 100 plantas de seed-100.json como registros activos.');
    perform public.review_species_change(change_id,true,true);
  end loop;
  if (select count(*) from public.species where kingdom='Plantae' and status='active')<>100 then raise exception 'plant_curation_count_mismatch'; end if;
end $curation$;
commit;`);
