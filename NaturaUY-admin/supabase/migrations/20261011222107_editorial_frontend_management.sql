-- Gestión editorial desde la web. Sin importaciones ni publicación automática.
create table public.editorial_revisions (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('learning','home','media','habitat_graph')),
 entity_key text not null, actor_id uuid not null references auth.users(id), reason text not null check(length(trim(reason))>0),
 before_values jsonb not null, after_values jsonb not null, created_at timestamptz not null default now()
);
alter table public.editorial_revisions enable row level security;
revoke all on public.editorial_revisions from public,anon,authenticated;
grant select on public.editorial_revisions to authenticated;
create policy editorial_revision_read on public.editorial_revisions for select to authenticated using((select public.has_editor_access()));
create index editorial_revisions_actor on public.editorial_revisions(actor_id);
create index editorial_revisions_created on public.editorial_revisions(created_at desc);
create function private.reject_editorial_revision_mutation() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'editorial_revision_immutable'; end $$;
create trigger editorial_revision_immutable before update or delete on public.editorial_revisions for each row execute function private.reject_editorial_revision_mutation();

grant select on public.learning_paths to authenticated;
create policy learning_editor_read on public.learning_paths for select to authenticated using((select public.has_editor_access()));

create function public.save_learning_path(p_content jsonb,p_expected_version integer,p_status text,p_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.require_admin(); path_id text:=p_content->>'id'; previous public.learning_paths; next_version integer; m jsonb; b jsonb; q jsonb; src jsonb; ids text[]:='{}'; objectives text[]:='{}'; module_ids text[]:='{}'; source_codes text[]; codes text[];
begin
 if nullif(trim(p_reason),'') is null or p_status not in ('draft','approved','archived') or jsonb_typeof(p_content) is distinct from 'object' then raise exception 'invalid_learning_revision'; end if;
 perform pg_advisory_xact_lock(hashtextextended('learning:'||coalesce(path_id,''),0));
 select * into previous from public.learning_paths where id=path_id order by version desc limit 1;
 if previous.version is distinct from p_expected_version then raise exception 'learning_change_conflict'; end if;
 if path_id is null or path_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or nullif(trim(p_content->>'title'),'') is null or nullif(trim(p_content->>'shortTitle'),'') is null or nullif(trim(p_content->>'description'),'') is null or coalesce(p_content->>'color','') !~ '^#[0-9a-fA-F]{6}$' or jsonb_typeof(p_content->'modules') is distinct from 'array' or jsonb_typeof(p_content->'sources') is distinct from 'array' then raise exception 'invalid_learning_content'; end if;
 if p_status='approved' and jsonb_array_length(p_content->'modules')=0 then raise exception 'learning_modules_required'; end if;
 for src in select value from jsonb_array_elements(p_content->'sources') loop
   if nullif(trim(src->>'code'),'') is null or nullif(trim(src->>'name'),'') is null or coalesce(src->>'url','') !~ '^https?://' then raise exception 'learning_source_required'; end if;
 end loop;
 select array_agg(value->>'code') into codes from jsonb_array_elements(p_content->'sources');
 if cardinality(codes)<>(select count(distinct v) from unnest(codes)v) then raise exception 'duplicate_learning_source'; end if;
 for m in select value from jsonb_array_elements(p_content->'modules') loop
   if nullif(m->>'id','') is null or m->>'id'=any(module_ids) or nullif(trim(m->>'title'),'') is null or nullif(trim(m->>'hook'),'') is null or jsonb_typeof(m->'blocks') is distinct from 'array' or jsonb_array_length(m->'blocks')=0 or jsonb_typeof(m->'questions') is distinct from 'array' or jsonb_typeof(m->'sourceCodes') is distinct from 'array' then raise exception 'invalid_learning_module'; end if;
   module_ids:=array_append(module_ids,m->>'id');
   source_codes:=array(select jsonb_array_elements_text(m->'sourceCodes'));
   if p_status='approved' and (cardinality(source_codes)=0 or not source_codes <@ coalesce(codes,'{}')) then raise exception 'learning_source_required'; end if;
   for b in select value from jsonb_array_elements(m->'blocks') loop
     if nullif(trim(b->>'title'),'') is null or nullif(trim(b->>'body'),'') is null then raise exception 'invalid_learning_block'; end if;
   end loop;
   for q in select value from jsonb_array_elements(m->'questions') loop
     if nullif(q->>'id','') is null or q->>'id'=any(ids) or nullif(q->>'objectiveId','') is null or q->>'objectiveId'=any(objectives) or coalesce((q->>'version')::integer,0)<1 or nullif(trim(q->>'prompt'),'') is null or nullif(trim(q->>'explanation'),'') is null or jsonb_typeof(q->'options') is distinct from 'array' or jsonb_array_length(q->'options')<2 or q->>'type' not in ('single','multi','order','classify') or jsonb_typeof(q->'correct') is distinct from 'array' then raise exception 'invalid_learning_question'; end if;
     ids:=array_append(ids,q->>'id'); objectives:=array_append(objectives,q->>'objectiveId');
     if exists(select 1 from jsonb_array_elements_text(q->'options')o where length(trim(o))=0) or (select count(distinct o) from jsonb_array_elements_text(q->'options')o)<>jsonb_array_length(q->'options') then raise exception 'invalid_learning_options'; end if;
     if q->>'type'='classify' then
       if jsonb_typeof(q->'categories') is distinct from 'array' or jsonb_array_length(q->'categories')<2 or jsonb_typeof(q->'classification') is distinct from 'object' or exists(select 1 from jsonb_array_elements_text(q->'options')o where not coalesce(q->'categories' ? (q->'classification'->>o),false)) then raise exception 'invalid_learning_classification'; end if;
     elsif jsonb_array_length(q->'correct')=0 or (q->>'type'='single' and jsonb_array_length(q->'correct')<>1) or (q->>'type'='order' and jsonb_array_length(q->'correct')<>jsonb_array_length(q->'options')) or exists(select 1 from jsonb_array_elements_text(q->'correct')c where not (q->'options' ? c)) or (select count(distinct c) from jsonb_array_elements_text(q->'correct')c)<>jsonb_array_length(q->'correct') then raise exception 'invalid_learning_answer'; end if;
   end loop;
 end loop;
 next_version:=coalesce(previous.version,0)+1;
 if p_status in ('approved','archived') then update public.learning_paths set status='archived' where id=path_id and status='approved'; end if;
 insert into public.learning_paths(id,version,title,short_title,description,accent_color,content,source_codes,status,reviewed_by,reviewed_at)
 values(path_id,next_version,p_content->>'title',p_content->>'shortTitle',p_content->>'description',p_content->>'color',p_content||jsonb_build_object('archived',p_status='archived'),array(select distinct source_value from jsonb_array_elements(p_content->'modules')module_entry(value) cross join lateral jsonb_array_elements_text(module_entry.value->'sourceCodes')source_entry(source_value)),p_status,case when p_status<>'draft' then actor end,case when p_status<>'draft' then now() end);
 insert into public.editorial_revisions(kind,entity_key,actor_id,reason,before_values,after_values) values('learning',path_id,actor,p_reason,coalesce(to_jsonb(previous),'{}'),jsonb_build_object('version',next_version,'status',p_status,'content',p_content));
 return next_version;
end $$;

create table public.home_species_schedule (
 id uuid primary key default gen_random_uuid(), day date not null, slot text not null check(slot in ('daily','threatened','curiosity','native')),
 species_id uuid not null references public.species(id), enabled boolean not null default true, note text not null default '',
 version integer not null default 1, updated_at timestamptz not null default now(), unique(day,slot)
);
create index home_species_schedule_species on public.home_species_schedule(species_id);
alter table public.home_species_schedule enable row level security;
revoke all on public.home_species_schedule from public,anon,authenticated;
grant select on public.home_species_schedule to authenticated;
create policy home_schedule_editor_read on public.home_species_schedule for select to authenticated using((select public.has_editor_access()));
create function public.save_home_species(p_day date,p_slot text,p_species_id uuid,p_enabled boolean,p_note text,p_expected_version integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.require_admin(); previous public.home_species_schedule; result public.home_species_schedule;
begin
 if p_day is null or p_slot not in ('daily','threatened','curiosity','native') or nullif(trim(p_note),'') is null then raise exception 'invalid_home_selection'; end if;
 perform pg_advisory_xact_lock(hashtextextended('home:'||p_day||':'||p_slot,0));
 select * into previous from public.home_species_schedule where day=p_day and slot=p_slot for update;
 if previous.version is distinct from p_expected_version then raise exception 'home_selection_conflict'; end if;
 if not exists(select 1 from public.species where id=p_species_id and status='active') then raise exception 'active_species_required'; end if;
 if p_enabled and not exists(select 1 from public.species_media where species_id=p_species_id and type='image' and status='approved' and storage_path is not null) then raise exception 'approved_photo_required'; end if;
 insert into public.home_species_schedule(day,slot,species_id,enabled,note) values(p_day,p_slot,p_species_id,p_enabled,p_note)
 on conflict(day,slot) do update set species_id=excluded.species_id,enabled=excluded.enabled,note=excluded.note,version=home_species_schedule.version+1,updated_at=now() returning * into result;
 insert into public.editorial_revisions(kind,entity_key,actor_id,reason,before_values,after_values) values('home',result.id::text,actor,p_note,coalesce(to_jsonb(previous),'{}'),to_jsonb(result));
 return result.id;
end $$;
create function public.get_home_species_schedule(p_from date,p_to date)
returns table(day date,slot text,catalog_code text) language sql stable security definer set search_path='' as $$
 select h.day,h.slot,s.catalog_code from public.home_species_schedule h join public.species s on s.id=h.species_id
 where h.enabled and s.status='active' and h.day between p_from and least(p_to,p_from+90) order by h.day,h.slot
$$;

create function public.get_editorial_popularity() returns table(catalog_code text,common_name text,favorites bigint)
language plpgsql stable security definer set search_path='' as $$ begin
 perform public.require_admin();
 return query select s.catalog_code,s.common_name,count(*) from public.favorites f join public.species s on s.id=f.species_id
 where f.is_favorite and s.status='active' group by s.id order by count(*) desc,max(f.updated_at) desc,s.catalog_code limit 20;
end $$;

create function public.save_habitat_editor(p_values jsonb,p_expected_version integer,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.require_admin(); target uuid; previous jsonb; parent uuid; current_version integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('habitat:'||coalesce(p_values->>'code',''),0));
 select version into current_version from public.habitats where code=p_values->>'code' for update;
 if current_version is distinct from p_expected_version then raise exception 'habitat_change_conflict'; end if;
 select coalesce(jsonb_agg(parent_id),'[]') into previous from public.habitat_relations where child_id=(select id from public.habitats where code=p_values->>'code');
 if p_values->>'kind'<>'group' and not exists(select 1 from public.habitats where code=p_values->>'family_code' and kind='group' and status='approved') then raise exception 'habitat_family_required'; end if;
 if p_values->>'status'='approved' and (jsonb_typeof(p_values->'field_sources'->'description') is distinct from 'array' or jsonb_array_length(p_values->'field_sources'->'description')=0) then raise exception 'habitat_source_required'; end if;
 target:=public.save_habitat(p_values,p_expected_version,p_reason);
 if jsonb_typeof(p_values->'parent_ids') is distinct from 'array' then raise exception 'habitat_parents_required'; end if;
 delete from public.habitat_relations where child_id=target;
 for parent in select value::uuid from jsonb_array_elements_text(p_values->'parent_ids') loop
   insert into public.habitat_relations(parent_id,child_id) values(parent,target);
 end loop;
 insert into public.editorial_revisions(kind,entity_key,actor_id,reason,before_values,after_values) values('habitat_graph',target::text,actor,p_reason,jsonb_build_object('parent_ids',previous),jsonb_build_object('parent_ids',p_values->'parent_ids'));
 return target;
end $$;

create function public.save_media_editor(p_id uuid,p_expected jsonb,p_values jsonb,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.require_admin(); previous public.species_media; target_status text; primary_image boolean;
begin
 if nullif(trim(p_reason),'') is null then raise exception 'media_reason_required'; end if;
 select * into previous from public.species_media where id=p_id;
 if not found or previous.species_id is null then raise exception 'media_not_found'; end if;
 perform 1 from public.species where id=previous.species_id for update;
 select * into previous from public.species_media where id=p_id for update;
 if to_jsonb(previous) is distinct from p_expected then raise exception 'media_change_conflict'; end if;
 target_status:=coalesce(p_values->>'status',previous.status); primary_image:=coalesce((p_values->>'is_primary')::boolean,previous.is_primary);
 if previous.status not in ('ready','approved','archived') or target_status not in ('ready','approved','archived') then raise exception 'media_not_ready'; end if;
 if nullif(trim(p_values->>'author'),'') is null or nullif(trim(p_values->>'source'),'') is null or p_values->>'license' not in ('CC0','CC-BY-4.0','permission','legacy') then raise exception 'media_rights_required'; end if;
 if p_values->>'license'='legacy' and previous.license<>'legacy' then raise exception 'legacy_license_read_only'; end if;
 if p_values->>'license'='permission' and nullif(trim(p_values->>'evidence_path'),'') is null and previous.evidence_path is null then raise exception 'permission_evidence_required'; end if;
 if p_values->>'license' in ('CC0','CC-BY-4.0') and nullif(trim(p_values->>'source_url'),'') is null then raise exception 'media_source_required'; end if;
 if target_status='approved' and (previous.storage_path is null or previous.checksum_sha256 is null or (previous.type='image' and previous.thumbnail_path is null)) then raise exception 'media_derivatives_required'; end if;
 if target_status='approved' and (not exists(select 1 from storage.objects where bucket_id=case when previous.storage_path like 'guia-aves/%' then 'guia-aves' else 'media-public' end and name=case when previous.storage_path like 'guia-aves/%' then substring(previous.storage_path from 11) else previous.storage_path end) or (previous.type='image' and not exists(select 1 from storage.objects where bucket_id=case when previous.thumbnail_path like 'guia-aves/%' then 'guia-aves' else 'media-public' end and name=case when previous.thumbnail_path like 'guia-aves/%' then substring(previous.thumbnail_path from 11) else previous.thumbnail_path end))) then raise exception 'media_objects_missing'; end if;
 if target_status='approved' and previous.type='audio' and exists(select 1 from public.species_media where species_id=previous.species_id and type='audio' and status='approved' and id<>p_id) then raise exception 'audio_limit_exceeded'; end if;
 if primary_image and previous.type='image' and target_status='approved' then
   insert into public.editorial_revisions(kind,entity_key,actor_id,reason,before_values,after_values)
   select 'media',id::text,actor,p_reason,to_jsonb(m),to_jsonb(m)||jsonb_build_object('is_primary',false) from public.species_media m where species_id=previous.species_id and type='image' and is_primary and id<>p_id;
   update public.species_media set is_primary=false where species_id=previous.species_id and type='image' and id<>p_id;
 end if;
 update public.species_media set author=trim(p_values->>'author'),source=trim(p_values->>'source'),source_url=nullif(trim(p_values->>'source_url'),''),license=p_values->>'license',license_url=case p_values->>'license' when 'CC0' then 'https://creativecommons.org/publicdomain/zero/1.0/' when 'CC-BY-4.0' then 'https://creativecommons.org/licenses/by/4.0/' else license_url end,evidence_path=coalesce(nullif(trim(p_values->>'evidence_path'),''),evidence_path),status=target_status,is_primary=primary_image and type='image' and target_status='approved' where id=p_id;
 insert into public.editorial_revisions(kind,entity_key,actor_id,reason,before_values,after_values) select 'media',p_id::text,actor,p_reason,to_jsonb(previous),to_jsonb(m) from public.species_media m where id=p_id;
end $$;

create function public.catalog_management_dirty() returns boolean language plpgsql stable security definer set search_path='' as $$ begin
 perform public.require_editor();
 return exists(select 1 from public.editorial_revisions r where r.kind in ('learning','home','media') and (r.kind<>'learning' or r.after_values->>'status' in ('approved','archived')) and r.created_at>coalesce((select max(published_at) from public.catalog_releases where status='published'),'epoch'));
end $$;

create or replace function public.request_catalog_publish() returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.require_admin(); target uuid; next_version bigint; last_release timestamptz;
begin
 select coalesce(max(published_at),'epoch') into last_release from public.catalog_releases where status='published';
 if not public.catalog_management_dirty()
 and not exists(select 1 from public.species_changes where status='approved' and reviewed_at>last_release)
 and not exists(select 1 from public.content_changes where status='approved' and reviewed_at>last_release)
 and not exists(select 1 from public.species_observability_snapshots where generated_at>last_release)
 and not exists(select 1 from public.taxon_content where updated_at>last_release)
 and not exists(select 1 from public.species_media where status='approved' and processed_at>last_release)
 and not exists(select 1 from public.habitat_revisions where created_at>last_release) then raise exception 'catalog_not_dirty'; end if;
 perform pg_advisory_xact_lock(hashtextextended('catalog-publish',0));
 select id into target from public.catalog_releases where status in ('pending','building') order by requested_at desc limit 1;
 if target is not null then return target; end if;
 select coalesce(max(version),0)+1 into next_version from public.catalog_releases;
 insert into public.catalog_releases(version,requested_by) values(next_version,actor) returning id into target;
 return target;
end $$;

revoke all on function public.save_learning_path(jsonb,integer,text,text),public.save_home_species(date,text,uuid,boolean,text,integer),public.save_habitat_editor(jsonb,integer,text),public.save_media_editor(uuid,jsonb,jsonb,text),public.get_editorial_popularity(),public.catalog_management_dirty(),public.request_catalog_publish(),public.get_home_species_schedule(date,date) from public,anon;
grant execute on function public.save_learning_path(jsonb,integer,text,text),public.save_home_species(date,text,uuid,boolean,text,integer),public.save_habitat_editor(jsonb,integer,text),public.save_media_editor(uuid,jsonb,jsonb,text),public.get_editorial_popularity(),public.catalog_management_dirty(),public.request_catalog_publish() to authenticated;
grant execute on function public.get_home_species_schedule(date,date) to anon,authenticated;
revoke all on function private.reject_editorial_revision_mutation() from public,anon,authenticated;

-- Una imagen archivada libera su lugar; max(ordinal)+1 no permite reemplazarla.
create or replace function public.reserve_species_media_upload(p_species_id uuid,p_change_id uuid,p_type text,p_author text,p_license text,p_source text,p_source_url text,p_original_filename text,p_is_primary boolean default false,p_evidence_path text default null)
returns table(media_id uuid,incoming_path text) language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.require_editor(); slot smallint; target uuid; path text;
begin
 if p_type not in ('image','audio') or p_license not in ('CC0','CC-BY-4.0','permission') or nullif(trim(p_author),'') is null or nullif(trim(p_source),'') is null then raise exception 'invalid_media'; end if;
 if p_species_id is null and p_change_id is null then raise exception 'media_target_required'; end if;
 if p_species_id is not null then perform 1 from public.species where id=p_species_id and status='active' for update; if not found then raise exception 'active_species_required'; end if; end if;
 if p_change_id is not null then perform 1 from public.species_changes where id=p_change_id and status='pending' and proposed_by=actor for update; if not found then raise exception 'pending_create_required'; end if; end if;
 if p_license='permission' and nullif(trim(p_evidence_path),'') is null then raise exception 'permission_evidence_required'; end if;
 select n::smallint into slot from generate_series(1,case when p_type='image' then 2 else 1 end)n
 where not exists(select 1 from public.species_media where ((p_species_id is not null and species_id=p_species_id) or (p_species_id is null and species_id is null and change_id=p_change_id)) and type=p_type and ordinal=n and status not in ('rejected','archived')) order by n limit 1;
 if slot is null then raise exception 'media_limit_exceeded'; end if;
 insert into public.species_media(species_id,change_id,type,ordinal,is_primary,author,license,source,source_url,original_filename,evidence_path,uploaded_by,incoming_path)
 values(p_species_id,p_change_id,p_type,slot,p_is_primary,trim(p_author),p_license,trim(p_source),nullif(trim(p_source_url),''),p_original_filename,p_evidence_path,actor,format('%s/%s',actor,gen_random_uuid())) returning id,species_media.incoming_path into target,path;
 media_id:=target;incoming_path:=path;return next;
end $$;
revoke all on function public.reserve_species_media_upload(uuid,uuid,text,text,text,text,text,text,boolean,text) from public,anon;
grant execute on function public.reserve_species_media_upload(uuid,uuid,text,text,text,text,text,text,boolean,text) to authenticated;

-- Nuevos aportes de audio con los mismos derechos y recorte; los IDs históricos XC se preservan.
create or replace function private.update_species_audio_metadata(p_media_id uuid,p_external_id text,p_original_license text,p_authorization_evidence_ref text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.require_editor(); media public.species_media; external_code text:=nullif(trim(p_external_id),''); evidence text:=nullif(trim(p_authorization_evidence_ref),''); original text:=nullif(trim(p_original_license),'');
begin
 select * into media from public.species_media where id=p_media_id and type='audio' and status in ('reserved','processing','ready') for update;
 if not found or (media.uploaded_by<>actor and not exists(select 1 from public.editor_access where user_id=actor and role='admin' and active)) then raise exception 'audio_media_not_found_or_locked'; end if;
 if lower(trim(media.source))='xeno-canto' and (external_code is null or external_code !~ '^[0-9]+$') then raise exception 'audio_external_id_required'; end if;
 if media.license='permission' and evidence is null then raise exception 'permission_evidence_required'; end if;
 original:=coalesce(original,case when media.license in ('CC0','CC-BY-4.0') then media.license end);
 if original is null then raise exception 'audio_original_license_required'; end if;
 update public.species_media set external_id=external_code,original_license=original,authorization_evidence_ref=evidence,evidence_path=case when media.license='permission' then evidence else media.evidence_path end where id=p_media_id;
end $$;
revoke all on function private.update_species_audio_metadata(uuid,text,text,text) from public,anon;
grant execute on function private.update_species_audio_metadata(uuid,text,text,text) to authenticated;
