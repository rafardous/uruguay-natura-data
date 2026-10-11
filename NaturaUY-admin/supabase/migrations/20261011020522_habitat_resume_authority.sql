-- Una reanudación respeta las selecciones canónicas ya aprobadas.
-- Las formaciones históricas sólo participan en la primera conversión.
create or replace function public.normalize_species_habitats(p_species_id uuid,p_expected_updated_at timestamptz,p_expected_ecology jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.require_admin(); s public.species; item record; raw text; h public.habitats; canonical jsonb:='[]';
 mapping_evidence jsonb:='{}'; unresolved jsonb:='[]'; eco jsonb; cid uuid; refs jsonb;
begin
 select * into strict s from public.species where id=p_species_id and status='active' for update;
 if s.updated_at<>p_expected_updated_at or s.ecology<>p_expected_ecology then raise exception 'species_change_conflict'; end if;
 eco:=s.ecology;
 for item in select 'ecology.habitats' as field,value as raw from jsonb_array_elements_text(coalesce(s.ecology->'habitats','[]'))
   union all select 'ecology.vegetationFormations',value from jsonb_array_elements_text(coalesce(s.ecology->'vegetationFormations','[]'))
     where not coalesce(s.field_sources->'ecology.habitats','[]') @> '["natura_uy_editorial: habitats-v1"]' loop
   raw:=item.raw;
   if raw='Dulce y salobre' then
     eco:=jsonb_set(eco,'{aquaticEnvironments}',(select coalesce(jsonb_agg(distinct v),'[]') from jsonb_array_elements(coalesce(eco->'aquaticEnvironments','[]')||'["freshwater","brackish"]')x(v)));
     continue;
   end if;
   select hh.* into h from public.habitat_aliases a join public.habitats hh on hh.id=a.habitat_id where a.raw_value=raw and hh.status='approved';
   if not found then unresolved:=unresolved||jsonb_build_array(jsonb_build_object('field',item.field,'rawValue',raw)); continue; end if;
   if not canonical @> jsonb_build_array(h.code) then canonical:=canonical||jsonb_build_array(h.code); end if;
   mapping_evidence:=jsonb_set(mapping_evidence,array[h.code],coalesce(mapping_evidence->h.code,'[]')||jsonb_build_array(jsonb_build_object('rawValue',raw,'field',item.field,'rule',(select rule from public.habitat_aliases where raw_value=raw),'mappingVersion',1,'sources',coalesce(s.field_sources->item.field,s.field_sources->'habitat','[]'))));
 end loop;
 if jsonb_array_length(unresolved)>0 then return jsonb_build_object('status','ambiguous','unresolved',unresolved); end if;
 canonical:=(select coalesce(jsonb_agg(v order by v),'[]') from jsonb_array_elements(canonical)x(v));
 eco:=jsonb_set(eco,'{habitats}',canonical);
 eco:=jsonb_set(eco,'{vegetationFormations}',(select coalesce(jsonb_agg(distinct v order by v),'[]') from jsonb_array_elements_text(coalesce(s.ecology->'vegetationFormations','[]'))x(v) where v<>'Dulce y salobre'));
 -- Existing canonical values with complete links are an idempotent no-op.
 if eco=s.ecology and (select count(*) from public.species_habitats where species_id=s.id)=jsonb_array_length(canonical) then return jsonb_build_object('status','unchanged'); end if;
 refs:=s.field_sources||jsonb_build_object('ecology.habitats',coalesce(s.field_sources->'ecology.habitats',s.field_sources->'habitat','[]')||jsonb_build_array('natura_uy_editorial: habitats-v1'));
 if eco->'aquaticEnvironments' is distinct from s.ecology->'aquaticEnvironments' then refs:=refs||jsonb_build_object('ecology.aquaticEnvironments',coalesce(s.field_sources->'habitat','[]')||jsonb_build_array('natura_uy_editorial: Dulce y salobre → freshwater/brackish')); end if;
 cid:=public.submit_species_change(s.id,'update',jsonb_build_object('ecology',eco,'field_sources',refs),'Normalización aprobada de ambientes v1');
 perform public.review_species_change(cid,true,true);
 update public.species_habitats sh set evidence=mapping_evidence->hh.code from public.habitats hh where sh.species_id=s.id and sh.habitat_id=hh.id;
 return jsonb_build_object('status','normalized','changeId',cid,'habitats',canonical);
end $$;
