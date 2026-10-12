-- Fuentes opcionales: se conserva la ausencia y la procedencia no verificada.
create function private.optional_species_sources(p_values jsonb,p_before jsonb default '{}') returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb:=p_values; sources jsonb:=coalesce(p_values->'field_sources',p_before->'field_sources','{}'); m jsonb; measures jsonb:='[]';
begin
  if (p_values?'abundance_status' or p_values?'field_sources') and nullif(coalesce(p_values->>'abundance_status',p_before->>'abundance_status'),'') is not null
    and not exists(select 1 from jsonb_array_elements_text(coalesce(sources->'abundance_status','[]')) s where nullif(trim(s),'') is not null)
  then sources:=sources||jsonb_build_object('abundance_status',jsonb_build_array('Sin fuente'));result:=result||jsonb_build_object('field_sources',sources);end if;
  if p_values#>'{natural_history,bird}' is not null and not sources?'natural_history.bird' then
    sources:=sources||jsonb_build_object('natural_history.bird',jsonb_build_array('Sin fuente'));result:=result||jsonb_build_object('field_sources',sources);
  end if;
  if p_values?'measurements' then
    for m in select * from jsonb_array_elements(p_values->'measurements') loop
      if nullif(trim(m->>'sourceCode'),'') is null or m->>'sourceCode' ~* '^sin[ _]fuente[.[:space:]]*$' then
        m:=m||jsonb_build_object('sourceCode','Sin fuente','provenance','legacy_unverified');
        if coalesce(m->>'sourceRecordId','') ~* '^sin[ _]fuente[.[:space:]]*$' then m:=m||jsonb_build_object('sourceRecordId',null);end if;
      end if;
      measures:=measures||jsonb_build_array(m);
    end loop;
    result:=result||jsonb_build_object('measurements',measures);
  end if;
  return result;
end $$;
revoke all on function private.optional_species_sources(jsonb,jsonb) from public,anon,authenticated;
do $$ declare body text; begin
  body:=pg_get_functiondef('private.review_species_change_fields(uuid,boolean,boolean)'::regprocedure);
  body:=replace(body,'v_patch:=v_change.proposed_values;', 'v_patch:=private.optional_species_sources(v_change.proposed_values,coalesce((select to_jsonb(s) from public.species s where id=v_change.species_id),''{}''::jsonb));');
  execute body;
  body:=pg_get_functiondef('public.revise_pending_species_create(uuid,jsonb,jsonb,text)'::regprocedure);
  body:=replace(body,'  if coalesce(p_values->>''kingdom''', '  p_values:=private.optional_species_sources(p_values);'||E'\n'||'  if coalesce(p_values->>''kingdom''');
  execute body;
  body:=pg_get_functiondef('public.submit_visual_species_change(uuid,timestamptz,jsonb,jsonb,jsonb,text,boolean,boolean)'::regprocedure);
  body:=replace(body,'begin', 'begin'||E'\n'||' p_fields:=private.optional_species_sources(p_fields,coalesce((select to_jsonb(s) from public.species s where id=p_species_id),''{}''::jsonb));');
  execute body;
end $$;

-- Las columnas aprobadas y la navegación normalizada se guardan juntas.
create function private.sync_species_taxonomy_path(p_species_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s public.species; entry record; parent text; node text; path text[]:='{}';
begin
  select * into s from public.species where id=p_species_id for update;
  if not found then raise exception 'species_not_found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('editorial-taxonomy',0));
  for entry in select * from (values
    ('kingdom',s.kingdom),('phylum',s.phylum),('subphylum',s.subphylum),('class',s.class),
    ('order',s.order_name),('family',s.family),('genus',s.genus)
  ) as v(rank,name) loop
    if nullif(trim(entry.name),'') is null then continue; end if;
    node:=null;
    -- Reutilizar IDs existentes, incluso cuando haya rangos intermedios que
    -- no estén presentes en las columnas (p. ej. Hexapoda entre filo y clase).
    select t.taxon_id into node from public.taxa t
    where t.rank=entry.rank and lower(t.canonical_name)=lower(trim(entry.name))
      and ((parent is null and t.parent_id is null) or t.parent_id=parent or exists(
        select 1 from public.taxon_closure c where c.ancestor_id=parent and c.descendant_id=t.taxon_id))
    order by (t.parent_id is not distinct from parent) desc,t.taxon_id limit 1;
    if node is null then
      node:='editorial-'||md5(coalesce(parent,'root')||':'||entry.rank||':'||lower(trim(entry.name)));
      insert into public.taxa(taxon_id,parent_id,rank,canonical_name) values(node,parent,entry.rank,trim(entry.name));
      insert into public.taxon_names(taxon_id,name,language,name_type) values(node,trim(entry.name),'la','canonical');
      with recursive ancestors(id,depth) as (
        select node,0 union all
        select t.parent_id,a.depth+1 from ancestors a join public.taxa t on t.taxon_id=a.id where t.parent_id is not null
      ) insert into public.taxon_closure(ancestor_id,descendant_id,depth) select id,node,depth from ancestors;
    end if;
    path:=array_append(path,node);parent:=node;
  end loop;
  if parent is null then raise exception 'species_taxonomy_required'; end if;
  delete from public.species_taxa where species_id=s.id and is_primary;
  -- Incluir también los rangos intermedios de los nodos que se reutilizan.
  with recursive ancestors(id) as (
    select unnest(path) union
    select t.parent_id from ancestors a join public.taxa t on t.taxon_id=a.id where t.parent_id is not null
  ) insert into public.species_taxa(species_id,taxon_id,is_primary) select s.id,id,true from ancestors
    on conflict(species_id,taxon_id) do update set is_primary=true;
end $$;
revoke all on function private.sync_species_taxonomy_path(uuid) from public,anon,authenticated;

create function private.sync_species_taxonomy_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and (new.kingdom,new.phylum,new.subphylum,new.class,new.order_name,new.family,new.genus)
    is not distinct from (old.kingdom,old.phylum,old.subphylum,old.class,old.order_name,old.family,old.genus) then return new;end if;
  perform private.sync_species_taxonomy_path(new.id); return new;
end $$;
revoke all on function private.sync_species_taxonomy_trigger() from public,anon,authenticated;
create trigger species_editorial_taxonomy after insert or update of kingdom,phylum,subphylum,class,order_name,family,genus
on public.species for each row execute function private.sync_species_taxonomy_trigger();

-- Reparar únicamente fichas activas sin vínculos; no reimportar taxonomía.
do $$ declare missing record; begin
  for missing in select id from public.species s where status='active' and not exists(select 1 from public.species_taxa st where st.species_id=s.id)
  loop perform private.sync_species_taxonomy_path(missing.id); end loop;
end $$;

-- Publicaciones: mantener el contrato que Arapy 1.4 ya tiene instalado.
alter table public.catalog_releases alter column schema_version set default 15,
  alter column min_app_version set default '1.4.0';
do $$ declare body text; begin
  body:=pg_get_functiondef('public.request_catalog_publish()'::regprocedure);
  if position('insert into public.catalog_releases(version,requested_by) values(next_version,actor)' in body)=0 then raise exception 'publish_insert_not_found'; end if;
  body:=replace(body,'insert into public.catalog_releases(version,requested_by) values(next_version,actor)',
    'insert into public.catalog_releases(version,schema_version,min_app_version,requested_by) values(next_version,15,''1.4.0'',actor)');
  execute body;
end $$;
