import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Produce reviewable SQL; PostgreSQL remains the only editorial source.
const seed=JSON.parse(readFileSync(resolve(import.meta.dirname,'guess-clue-seed.json'),'utf8')) as {sourceCode:string;method:string;species:{code:string;evidence:string;clues:string[]}[]};
const quote=(value:string)=>`'${value.replaceAll("'","''")}'`;
const kinds=['habitat','diet','behavior','appearance','decisive'];
const blocks=seed.species.flatMap(species=>{
  if(species.clues.length!==5)throw new Error(`Incomplete clues: ${species.code}`);
  return species.clues.map((body,index)=>`do $seed$
declare v_species uuid; v_source uuid; v_existing public.species_game_clues; v_change uuid;
begin
 select id into strict v_species from public.species where catalog_code=${quote(species.code)} and status='active';
 select id into strict v_source from public.catalog_sources where code=${quote(seed.sourceCode)} and active and use_policy='redistributable';
 select * into v_existing from public.species_game_clues where species_id=v_species and kind=${quote(kinds[index]!)} and active;
 if found then
   if v_existing.body=${quote(body)} and v_existing.sort_order=${index+1} then return; end if;
   raise exception 'existing_editorial_clue_conflict';
 end if;
 v_change:=public.submit_content_change('game_clue',null,v_species,'upsert',jsonb_build_object('kind',${quote(kinds[index]!)},'sort_order',${index+1},'body',${quote(body)},'source_id',v_source,'source_record_id',${quote(`${species.evidence} # ${kinds[index]}`)}),${quote(seed.method)});
 perform public.review_content_change(v_change,true,true);
end $seed$;`);
});
console.log(`-- Set request.jwt.claims to the authorized editor before running.\n${blocks.join('\n')}`);
