-- Ambientes editoriales. El manifiesto móvil y los releases schema 14 no cambian.
create table public.habitats (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^[a-z][a-z0-9_]*$'),
 name text not null check(length(trim(name))>1), kind text not null check(kind in ('group','type','aggregate')),
 family_code text not null, sort_order integer not null default 0, color text not null default '#467B78',
 game_groups text[] not null default '{}', content jsonb not null default '{}', field_sources jsonb not null default '{}',
 status text not null default 'draft' check(status in ('draft','approved','archived')), version integer not null default 1,
 updated_at timestamptz not null default now()
);
create table public.habitat_relations (
 parent_id uuid not null references public.habitats(id) on delete restrict,
 child_id uuid not null references public.habitats(id) on delete restrict,
 primary key(parent_id,child_id), check(parent_id<>child_id)
);
create index habitat_relations_child on public.habitat_relations(child_id);
create table public.habitat_aliases (
 raw_value text primary key, habitat_id uuid not null references public.habitats(id) on delete restrict,
 rule text not null, mapping_version integer not null default 1
);
create index habitat_aliases_habitat on public.habitat_aliases(habitat_id);
create table public.species_habitats (
 species_id uuid not null references public.species(id) on delete restrict,
 habitat_id uuid not null references public.habitats(id) on delete restrict,
 scope text not null check(scope in ('broad','exact')), evidence jsonb not null default '[]',
 primary key(species_id,habitat_id)
);
create index species_habitats_habitat on public.species_habitats(habitat_id,species_id);
create table public.habitat_metrics (
 id uuid primary key default gen_random_uuid(), habitat_id uuid not null references public.habitats(id) on delete restrict,
 metric text not null, value numeric not null check(value>=0), unit text not null check(unit in ('km2','percent','ha')),
 reference_year integer not null, denominator text not null, method text not null, source jsonb not null,
 note text not null default ''
);
create index habitat_metrics_habitat on public.habitat_metrics(habitat_id);
create table public.habitat_media (
 id uuid primary key default gen_random_uuid(), habitat_id uuid not null references public.habitats(id) on delete restrict,
 status text not null check(status in ('ready','approved','archived','failed')), author text not null,
 license text not null check(license in ('CC0','CC-BY-4.0','permission')), source_url text not null,
 license_url text, evidence_path text, location text not null, caption text not null,
 storage_path text not null, thumbnail_path text not null, checksum_sha256 text not null,
 updated_at timestamptz not null default now(),
 check(license<>'permission' or evidence_path is not null), check(license='permission' or license_url is not null)
);
create index habitat_media_habitat on public.habitat_media(habitat_id);
create table public.habitat_revisions (
 id uuid primary key default gen_random_uuid(), habitat_id uuid not null references public.habitats(id) on delete restrict,
 actor_id uuid not null references public.profiles(user_id), before_values jsonb, after_values jsonb not null,
 reason text not null, created_at timestamptz not null default now()
);
create index habitat_revisions_habitat on public.habitat_revisions(habitat_id,created_at);
create function private.reject_habitat_revision_mutation() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'habitat_revision_immutable'; end $$;
create trigger immutable_habitat_revisions before update or delete on public.habitat_revisions
for each row execute function private.reject_habitat_revision_mutation();

create function private.check_habitat_cycle() returns trigger language plpgsql set search_path='' as $$
begin
 -- Serialize graph writes so concurrent opposite edges cannot both pass.
 perform pg_advisory_xact_lock(715015);
 if exists(with recursive descendants(id) as (
   select new.child_id union select r.child_id from public.habitat_relations r join descendants d on r.parent_id=d.id
 ) select 1 from descendants where id=new.parent_id) then raise exception 'habitat_cycle'; end if;
 return new;
end $$;
create trigger habitat_no_cycles before insert or update on public.habitat_relations
for each row execute function private.check_habitat_cycle();

create function public.save_habitat(p_values jsonb,p_expected_version integer,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.require_admin(); before_row public.habitats; after_row public.habitats; target uuid;
begin
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'reason_required'; end if;
 select * into before_row from public.habitats where code=p_values->>'code' for update;
 if found then
   if before_row.version<>p_expected_version then raise exception 'habitat_change_conflict'; end if;
   if p_values?'id' and (p_values->>'id')::uuid<>before_row.id then raise exception 'habitat_identity_immutable'; end if;
   if (to_jsonb(before_row)-'version'-'updated_at') @> (p_values-'version'-'updated_at') then return before_row.id; end if;
   target:=before_row.id;
 else
   if p_expected_version is not null then raise exception 'habitat_not_found'; end if;
   target:=coalesce((p_values->>'id')::uuid,gen_random_uuid());
   if exists(select 1 from public.habitats where id=target and code<>p_values->>'code') then raise exception 'habitat_identity_immutable'; end if;
 end if;
 insert into public.habitats(id,code,name,kind,family_code,sort_order,color,game_groups,content,field_sources,status)
 values(target,p_values->>'code',p_values->>'name',p_values->>'kind',p_values->>'family_code',coalesce((p_values->>'sort_order')::integer,0),p_values->>'color',
 array(select jsonb_array_elements_text(coalesce(p_values->'game_groups','[]'))),p_values->'content',p_values->'field_sources',p_values->>'status')
 on conflict(id) do update set name=excluded.name,kind=excluded.kind,family_code=excluded.family_code,sort_order=excluded.sort_order,
 color=excluded.color,game_groups=excluded.game_groups,content=excluded.content,field_sources=excluded.field_sources,status=excluded.status,
 version=habitats.version+1,updated_at=now() returning * into after_row;
 if after_row.status='approved' and (length(coalesce(after_row.content->>'description',''))<20 or not (after_row.field_sources?'description')) then raise exception 'habitat_source_required'; end if;
 insert into public.habitat_revisions(habitat_id,actor_id,before_values,after_values,reason)
 values(target,actor,case when before_row.id is null then null else to_jsonb(before_row) end,to_jsonb(after_row),p_reason);
 return target;
end $$;

create function public.load_habitat_catalog(p_catalog jsonb,p_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.require_admin(); entry jsonb; current_version integer; n integer:=0; before_graph jsonb; after_graph jsonb; root uuid;
begin
 perform pg_advisory_xact_lock(715015);
 before_graph:=jsonb_build_object('relations',(select coalesce(jsonb_agg(to_jsonb(r) order by parent_id,child_id),'[]') from public.habitat_relations r),'aliases',(select coalesce(jsonb_agg(to_jsonb(a) order by raw_value),'[]') from public.habitat_aliases a));
 for entry in select value from jsonb_array_elements(p_catalog->'habitats') loop
   select version into current_version from public.habitats where code=entry->>'code';
   perform public.save_habitat(entry,current_version,p_reason); n:=n+1;
 end loop;
 for entry in select value from jsonb_array_elements(p_catalog->'relations') loop
   if not exists(select 1 from public.habitats where code=entry->>'parent_code') or not exists(select 1 from public.habitats where code=entry->>'child_code') then raise exception 'habitat_relation_not_found'; end if;
   insert into public.habitat_relations(parent_id,child_id)
   select p.id,c.id from public.habitats p,public.habitats c where p.code=entry->>'parent_code' and c.code=entry->>'child_code'
   on conflict do nothing;
 end loop;
 for entry in select value from jsonb_array_elements(p_catalog->'aliases') loop
   if exists(select 1 from public.habitat_aliases a join public.habitats h on h.id=a.habitat_id where a.raw_value=entry->>'raw_value' and h.code<>entry->>'habitat_code') then raise exception 'habitat_alias_conflict'; end if;
   if not exists(select 1 from public.habitats where code=entry->>'habitat_code') then raise exception 'habitat_alias_not_found'; end if;
   insert into public.habitat_aliases(raw_value,habitat_id,rule)
   select entry->>'raw_value',h.id,entry->>'rule' from public.habitats h where h.code=entry->>'habitat_code'
   on conflict(raw_value) do update set habitat_id=excluded.habitat_id,rule=excluded.rule;
 end loop;
 after_graph:=jsonb_build_object('relations',(select coalesce(jsonb_agg(to_jsonb(r) order by parent_id,child_id),'[]') from public.habitat_relations r),'aliases',(select coalesce(jsonb_agg(to_jsonb(a) order by raw_value),'[]') from public.habitat_aliases a));
 if before_graph<>after_graph then
   select id into root from public.habitats where code=p_catalog->'habitats'->0->>'code';
   insert into public.habitat_revisions(habitat_id,actor_id,before_values,after_values,reason) values(root,actor,before_graph,after_graph||jsonb_build_object('coverage',p_catalog->'coverage'),p_reason||' — relaciones y equivalencias');
 end if;
 return n;
end $$;

create function private.sync_species_habitats() returns trigger language plpgsql security definer set search_path='' as $$
declare raw text; h public.habitats;
begin
 if tg_op='UPDATE' and new.ecology is not distinct from old.ecology and
   (select count(*) from public.species_habitats where species_id=new.id)=jsonb_array_length(coalesce(new.ecology->'habitats','[]')) then return new; end if;
 if new.status<>'active' then return new; end if;
 if jsonb_array_length(coalesce(new.ecology->'habitats','[]'))<>(select count(distinct v) from jsonb_array_elements_text(coalesce(new.ecology->'habitats','[]'))x(v)) then raise exception 'duplicate_habitat'; end if;
 for raw in select jsonb_array_elements_text(coalesce(new.ecology->'habitats','[]')) loop
   if not exists(select 1 from public.habitats where code=raw and status='approved') then raise exception 'unknown_habitat:%',raw; end if;
 end loop;
 delete from public.species_habitats where species_id=new.id;
 for h in select * from public.habitats where code in(select jsonb_array_elements_text(coalesce(new.ecology->'habitats','[]'))) loop
   insert into public.species_habitats(species_id,habitat_id,scope,evidence)
   values(new.id,h.id,case when h.kind='type' then 'exact' else 'broad' end,
    jsonb_build_array(jsonb_build_object('rawValue',h.code,'field','ecology.habitats','rule','canonical-v1','sources',coalesce(new.field_sources->'ecology.habitats',new.field_sources->'habitat','[]'))));
 end loop;
 return new;
end $$;
create trigger species_canonical_habitats after insert or update of ecology on public.species
for each row execute function private.sync_species_habitats();

create function public.normalize_species_habitats(p_species_id uuid,p_expected_updated_at timestamptz,p_expected_ecology jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.require_admin(); s public.species; item record; raw text; h public.habitats; canonical jsonb:='[]';
 mapping_evidence jsonb:='{}'; unresolved jsonb:='[]'; eco jsonb; cid uuid; refs jsonb;
begin
 select * into strict s from public.species where id=p_species_id and status='active' for update;
 if s.updated_at<>p_expected_updated_at or s.ecology<>p_expected_ecology then raise exception 'species_change_conflict'; end if;
 eco:=s.ecology;
 for item in select 'ecology.habitats' as field,value as raw from jsonb_array_elements_text(coalesce(s.ecology->'habitats','[]'))
   union all select 'ecology.vegetationFormations',value from jsonb_array_elements_text(coalesce(s.ecology->'vegetationFormations','[]')) loop
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

-- Métricas y medios pasan por RPC admin; no se abre escritura de tablas al navegador.
create function public.save_habitat_metric(p_values jsonb,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.require_admin(); target uuid:=(p_values->>'id')::uuid; before_value jsonb;
begin
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'reason_required'; end if;
 if coalesce(p_values->>'method','')='' or coalesce(p_values->>'denominator','')='' or coalesce(p_values->'source'->>'url','')='' then raise exception 'metric_evidence_required'; end if;
 select to_jsonb(m) into before_value from public.habitat_metrics m where id=target for update;
 if before_value @> p_values then return target; end if;
 if before_value is not null and before_value->>'habitat_id'<>p_values->>'habitat_id' then raise exception 'metric_identity_immutable'; end if;
 insert into public.habitat_metrics(id,habitat_id,metric,value,unit,reference_year,denominator,method,source,note)
 values(target,(p_values->>'habitat_id')::uuid,p_values->>'metric',(p_values->>'value')::numeric,p_values->>'unit',(p_values->>'reference_year')::integer,p_values->>'denominator',p_values->>'method',p_values->'source',coalesce(p_values->>'note',''))
 on conflict(id) do update set metric=excluded.metric,value=excluded.value,unit=excluded.unit,reference_year=excluded.reference_year,denominator=excluded.denominator,method=excluded.method,source=excluded.source,note=excluded.note;
 insert into public.habitat_revisions(habitat_id,actor_id,before_values,after_values,reason)
 select habitat_id,actor,before_value,to_jsonb(m),p_reason from public.habitat_metrics m where id=target;
 return target;
end $$;

create function public.save_habitat_media(p_values jsonb,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.require_admin(); target uuid:=coalesce((p_values->>'id')::uuid,gen_random_uuid()); before_value jsonb;
begin
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'reason_required'; end if;
 select to_jsonb(m) into before_value from public.habitat_media m where id=target for update;
 if before_value @> p_values then return target; end if;
 if before_value is not null and (before_value-'status'-'caption'-'updated_at')<>(p_values-'status'-'caption'-'updated_at') then raise exception 'media_identity_immutable'; end if;
 if coalesce(p_values->>'author','')='' or coalesce(p_values->>'location','')='' or coalesce(p_values->>'source_url','')='' or coalesce(p_values->>'checksum_sha256','')!~'^[0-9a-f]{64}$' then raise exception 'media_evidence_required'; end if;
 insert into public.habitat_media(id,habitat_id,status,author,license,source_url,license_url,evidence_path,location,caption,storage_path,thumbnail_path,checksum_sha256)
 values(target,(p_values->>'habitat_id')::uuid,p_values->>'status',p_values->>'author',p_values->>'license',p_values->>'source_url',p_values->>'license_url',p_values->>'evidence_path',p_values->>'location',p_values->>'caption',p_values->>'storage_path',p_values->>'thumbnail_path',p_values->>'checksum_sha256')
 on conflict(id) do update set status=excluded.status,caption=excluded.caption,updated_at=now();
 insert into public.habitat_revisions(habitat_id,actor_id,before_values,after_values,reason)
 select habitat_id,actor,before_value,to_jsonb(m),p_reason from public.habitat_media m where id=target;
 return target;
end $$;

do $$ declare tab text; begin
 foreach tab in array array['habitats','habitat_relations','habitat_aliases','species_habitats','habitat_metrics','habitat_media','habitat_revisions'] loop
   execute format('alter table public.%I enable row level security',tab);
   execute format('revoke all on public.%I from anon,authenticated',tab);
   execute format('grant select on public.%I to authenticated',tab);
   execute format('create policy habitat_editor_read on public.%I for select to authenticated using ((select public.has_editor_access()))',tab);
 end loop;
end $$;
grant select on public.habitats,public.habitat_relations,public.habitat_aliases,public.species_habitats,public.habitat_metrics to anon;
create policy habitats_public_read on public.habitats for select to anon,authenticated using(status='approved');
create policy habitat_relations_public_read on public.habitat_relations for select to anon,authenticated using(exists(select 1 from public.habitats where id=parent_id and status='approved') and exists(select 1 from public.habitats where id=child_id and status='approved'));
create policy habitat_aliases_public_read on public.habitat_aliases for select to anon,authenticated using(exists(select 1 from public.habitats where id=habitat_id and status='approved'));
create policy species_habitats_public_read on public.species_habitats for select to anon,authenticated using(exists(select 1 from public.species where id=species_id and status='active') and exists(select 1 from public.habitats where id=habitat_id and status='approved'));
create policy habitat_metrics_public_read on public.habitat_metrics for select to anon,authenticated using(exists(select 1 from public.habitats where id=habitat_id and status='approved'));
-- Public metadata excludes private evidence paths, including permission evidence.
create view public.habitat_public_media with (security_invoker=true) as
 select id,habitat_id,status,author,license,source_url,license_url,location,caption,storage_path,thumbnail_path,checksum_sha256 from public.habitat_media where status='approved';
revoke select on public.habitat_media from authenticated;
grant select(id,habitat_id,status,author,license,source_url,license_url,location,caption,storage_path,thumbnail_path,checksum_sha256) on public.habitat_media to anon,authenticated;
grant select on public.habitat_public_media to anon,authenticated;
create policy habitat_media_public_read on public.habitat_media for select to anon,authenticated using(status='approved' and exists(select 1 from public.habitats where id=habitat_id and status='approved'));
revoke all on function public.save_habitat(jsonb,integer,text),public.load_habitat_catalog(jsonb,text),public.normalize_species_habitats(uuid,timestamptz,jsonb),public.save_habitat_media(jsonb,text),public.save_habitat_metric(jsonb,text) from public,anon;
grant execute on function public.save_habitat(jsonb,integer,text),public.load_habitat_catalog(jsonb,text),public.normalize_species_habitats(uuid,timestamptz,jsonb),public.save_habitat_media(jsonb,text),public.save_habitat_metric(jsonb,text) to authenticated;
revoke all on function private.sync_species_habitats(),private.check_habitat_cycle(),private.reject_habitat_revision_mutation() from public,anon,authenticated;

-- Mantener el contrato nativo actual por defecto; schema 15 requiere selección explícita.
create or replace function private.force_catalog_schema_14()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.schema_version=15 then new.min_app_version:='1.4.0';
 else new.schema_version:=14; new.min_app_version:='1.3.1'; end if;
 return new;
end $$;
