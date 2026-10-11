import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { habitatSeed, habitatAliases, habitatRelations, habitatCoverage, habitatMetricSeed } from './habitat-seed';
import { adminClient, required } from './shared';

const catalog = { habitats: habitatSeed, relations: habitatRelations, aliases: habitatAliases, coverage: habitatCoverage };
const reason = 'Catálogo de ambientes v1, normalización autorizada por el responsable';
const sql = (value: unknown) => JSON.stringify(value).replaceAll("'", "''");
if(process.argv.includes('--coverage')) {
  writeFileSync(resolve(import.meta.dirname,'../src/data/habitatCoverage.json'),JSON.stringify(habitatCoverage,null,2)+'\n');
  console.log(`${habitatCoverage.length} equivalencias nacionales documentadas`);
} else if (process.argv.includes('--seed-sql')) {
  const actor = required('EDITORIAL_SYSTEM_USER_ID');
  if (!/^[0-9a-f-]{36}$/i.test(actor)) throw new Error('Actor inválido');
  console.log(`begin; select set_config('request.jwt.claims',jsonb_build_object('sub','${actor}','role','authenticated')::text,true);
select public.load_habitat_catalog('${sql(catalog)}'::jsonb,'${reason}');
${habitatMetricSeed.map(m=>`select public.save_habitat_metric('${sql(m)}'::jsonb,'Métrica histórica documentada');`).join('\n')}
commit;`);
} else if (process.argv.includes('--normalize-sql')) {
  const actor = required('EDITORIAL_SYSTEM_USER_ID');
  if (!/^[0-9a-f-]{36}$/i.test(actor)) throw new Error('Actor inválido');
  console.log(`begin; select set_config('request.jwt.claims',jsonb_build_object('sub','${actor}','role','authenticated')::text,true);
with results as materialized (select public.normalize_species_habitats(id,updated_at,ecology) as result from public.species where status='active' order by catalog_code)
select result->>'status' as status,count(*) from results group by result->>'status'; commit;`);
} else {
  const client = adminClient();
  const rows: any[] = [];
  for (let from=0;;from+=1000) {
    const {data,error}=await client.from('species').select('id,catalog_code,scientific_name,ecology,updated_at,field_sources').eq('status','active').order('id').range(from,from+999);
    if(error)throw error;rows.push(...data);if(data.length<1000)break;
  }
  const aliases=new Map(habitatAliases.map(a=>[a.raw_value,a.habitat_code]));
  const planned=rows.map(s=>{
    const values=[...(s.ecology.habitats??[]),...(s.ecology.vegetationFormations??[])];
    return {speciesId:s.id,catalogCode:s.catalog_code,name:s.scientific_name,before:s.ecology.habitats,after:[...new Set(values.flatMap(v=>aliases.has(v)?[aliases.get(v)]:[]))].sort(),conditions:values.includes('Dulce y salobre')?['freshwater','brackish']:[],unresolved:values.filter(v=>v!=='Dulce y salobre'&&!aliases.has(v))};
  });
  const report={mappingVersion:1,habitats:habitatSeed.length,families:habitatSeed.filter(h=>h.kind==='group').length,species:rows.length,missing:planned.filter(p=>!p.before.length).length,coverage:habitatCoverage,planned};
  writeFileSync(resolve(import.meta.dirname,'../../NaturaUY-source/data/reports/habitat-normalization-plan.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({mode:'dry-run',habitats:report.habitats,species:report.species,missing:report.missing,unresolved:planned.filter(p=>p.unresolved.length).length}));
}
