-- Visual species editing: stable identities, three photos, audited gallery proposals.
alter table public.species_media drop constraint species_media_ordinal_check;
alter table public.species_media add constraint species_media_ordinal_check check (ordinal between 1 and 3 and (type='image' or ordinal=1));
alter table public.species_media add column removed_by_editor boolean not null default false,
 add column replaces_media_id uuid references public.species_media(id),
 add column import_url text;
create index species_media_replaces_idx on public.species_media(replaces_media_id) where replaces_media_id is not null;
alter table public.species_changes add column gallery_before jsonb, add column gallery_values jsonb;

-- Preserve the current reviewed-fields implementation, only raising its photo cap.
do $$ declare body text; begin
 body:=pg_get_functiondef('public.review_species_change(uuid,boolean,boolean)'::regprocedure);
 body:=replace(body,'>2 then raise exception ''image_limit_exceeded''','>3 then raise exception ''image_limit_exceeded''');
 execute body;
end $$;
alter function public.review_species_change(uuid,boolean,boolean) set schema private;
alter function private.review_species_change(uuid,boolean,boolean) rename to review_species_change_fields;
revoke all on function private.review_species_change_fields(uuid,boolean,boolean) from public,anon,authenticated;

create function private.gallery_snapshot(p_species_id uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'status',m.status,'ordinal',m.ordinal,'is_primary',m.is_primary,'checksum_sha256',m.checksum_sha256,'author',m.author,'source',m.source,'license',m.license,'source_url',m.source_url,'removed_by_editor',m.removed_by_editor) order by m.id),'[]') from public.species_media m
 where m.species_id=p_species_id and (m.status='approved' or (m.status='archived' and m.license='legacy' and not m.removed_by_editor))
$$;
revoke all on function private.gallery_snapshot(uuid) from public,anon,authenticated;

create function public.submit_visual_species_change(p_species_id uuid,p_expected_updated_at timestamptz,p_fields jsonb,p_gallery_before jsonb,p_gallery jsonb,p_reason text,p_apply boolean default false,p_confirm boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.require_editor(); target public.species; request_id uuid;
begin
 select * into target from public.species where id=p_species_id for update;
 if not found or target.updated_at is distinct from p_expected_updated_at then raise exception 'species_change_conflict'; end if;
 if nullif(trim(p_reason),'') is null then raise exception 'reason_required'; end if;
 if p_fields?'id' or p_fields?'catalog_code' then raise exception 'species_identity_immutable'; end if;
 if p_fields?'natural_history' and p_fields->'natural_history'?'bird' then
   if exists(select 1 from jsonb_array_elements(coalesce(p_fields#>'{natural_history,bird,measurements}','[]'))v where (v->>'valueCm')::numeric<=0 or v->>'kind' not in('body_length','wingspan')) then raise exception 'invalid_bird_measurement'; end if;
   if exists(select 1 from jsonb_array_elements_text(coalesce(p_fields#>'{natural_history,bird,presence,months}','[]'))v where v::integer not between 1 and 12) then raise exception 'invalid_bird_month'; end if;
   if not coalesce(p_fields->'field_sources',target.field_sources)?'natural_history.bird' then raise exception 'bird_source_required'; end if;
 end if;
 if p_gallery is not null and (jsonb_typeof(p_gallery)<>'array' or private.gallery_snapshot(p_species_id) is distinct from p_gallery_before) then raise exception 'gallery_change_conflict'; end if;
 request_id:=public.submit_species_change(p_species_id,'update',p_fields,p_reason);
 update public.species_changes set gallery_before=p_gallery_before,gallery_values=p_gallery where id=request_id;
 if p_apply then
 perform public.require_admin();
 if not p_confirm then raise exception 'self_validation_confirmation_required'; end if;
 perform public.review_species_change(request_id,true,true);
 end if;
 return request_id;
end $$;

create function public.review_species_change(p_change_id uuid,p_approve boolean,p_confirm_self_validation boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.require_admin(); change public.species_changes; item jsonb; media public.species_media; old public.species_media; ids uuid[]; n integer; result uuid;
begin
 select * into change from public.species_changes where id=p_change_id for update;
 if not found or change.status<>'pending' then raise exception 'change_not_pending'; end if;
 if change.proposed_by=actor and not p_confirm_self_validation then raise exception 'self_validation_confirmation_required'; end if;
 if p_approve and change.gallery_values is not null then
 perform 1 from public.species where id=change.species_id for update;
 if private.gallery_snapshot(change.species_id) is distinct from change.gallery_before then raise exception 'gallery_change_conflict'; end if;
 select array_agg((v->>'id')::uuid) into ids from jsonb_array_elements(change.gallery_values)v;
 if coalesce(cardinality(ids),0)<>(select count(distinct v) from unnest(ids)v) then raise exception 'duplicate_media'; end if;
 if (select count(*) from jsonb_array_elements(change.gallery_values)v where v->>'type'='image')>3 then raise exception 'image_limit_exceeded'; end if;
 if (select count(*) from jsonb_array_elements(change.gallery_values)v where v->>'type'='audio')>1 then raise exception 'audio_limit_exceeded'; end if;
 if (select count(*) from jsonb_array_elements(change.gallery_values)v where (v->>'is_primary')::boolean)>1 then raise exception 'primary_limit_exceeded'; end if;
 for old in select * from public.species_media where species_id=change.species_id and (status='approved' or (status='archived' and license='legacy' and not removed_by_editor)) and not(id=any(coalesce(ids,'{}')))
 loop
 update public.species_media set status='archived',is_primary=false,removed_by_editor=true where id=old.id;
 insert into public.editorial_revisions(kind,entity_key,actor_id,reason,before_values,after_values) select 'media',old.id::text,actor,change.comment,to_jsonb(old),to_jsonb(m) from public.species_media m where id=old.id;
 end loop;
 for item in select * from jsonb_array_elements(change.gallery_values)
 loop
 select * into media from public.species_media where id=(item->>'id')::uuid for update;
 if not found or media.species_id<>change.species_id or media.type<>item->>'type' or media.status not in ('approved','ready','archived') then raise exception 'media_not_ready'; end if;
 if media.status='ready' and media.uploaded_by<>change.proposed_by and media.uploaded_by<>actor then raise exception 'media_not_owned'; end if;
 if media.storage_path is null or media.checksum_sha256 is null or (media.type='image' and media.thumbnail_path is null) then raise exception 'media_derivatives_required'; end if;
 if not exists(select 1 from storage.objects where bucket_id=case when media.storage_path like 'guia-aves/%' then 'guia-aves' else 'media-public' end and name=case when media.storage_path like 'guia-aves/%' then substring(media.storage_path from 11) else media.storage_path end)
 or (media.type='image' and not exists(select 1 from storage.objects where bucket_id=case when media.thumbnail_path like 'guia-aves/%' then 'guia-aves' else 'media-public' end and name=case when media.thumbnail_path like 'guia-aves/%' then substring(media.thumbnail_path from 11) else media.thumbnail_path end)) then raise exception 'media_objects_missing'; end if;
 if (item->>'ordinal')::integer not between 1 and (case when media.type='image' then 3 else 1 end) then raise exception 'invalid_media_order'; end if;
 if item?'metadata' then
   perform public.save_media_editor(media.id,to_jsonb(media),(item->'metadata')||jsonb_build_object('status','approved','is_primary',false),change.comment);
 end if;
 update public.species_media set status='approved',removed_by_editor=false,ordinal=(item->>'ordinal')::smallint,is_primary=media.type='image' and coalesce((item->>'is_primary')::boolean,false) where id=media.id;
 insert into public.editorial_revisions(kind,entity_key,actor_id,reason,before_values,after_values) select 'media',media.id::text,actor,change.comment,to_jsonb(media),to_jsonb(m) from public.species_media m where id=media.id;
 end loop;
 if exists(select 1 from public.species_media where species_id=change.species_id and type='image' and status='approved') and (select count(*) from public.species_media where species_id=change.species_id and type='image' and status='approved' and is_primary)<>1 then raise exception 'primary_image_required'; end if;
 if exists(select ordinal from public.species_media where species_id=change.species_id and type='image' and status='approved' group by ordinal having count(*)>1) then raise exception 'duplicate_media_order'; end if;
 end if;
 result:=private.review_species_change_fields(p_change_id,p_approve,p_confirm_self_validation);
 return result;
end $$;

-- Extend reservations without retiring replacements before processing succeeds.
do $$ declare body text; begin
 body:=pg_get_functiondef('public.reserve_species_media_upload(uuid,uuid,text,text,text,text,text,text,boolean,text)'::regprocedure);
 body:=replace(body,'then 2 else 1','then 3 else 1');
 execute body;
end $$;
create function public.reserve_editor_media(p_species_id uuid,p_values jsonb,p_replace_id uuid default null)
returns table(media_id uuid,incoming_path text) language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.require_editor(); old public.species_media; target uuid; path text;
begin
 perform 1 from public.species where id=p_species_id and status='active' for update;
 if not found then raise exception 'active_species_required'; end if;
 if p_values->>'type' not in ('image','audio') or p_values->>'license' not in ('CC0','CC-BY-4.0','permission') or length(trim(p_values->>'author'))<2 or length(trim(p_values->>'source'))<2 then raise exception 'invalid_media'; end if;
 if p_values->>'license'='permission' and nullif(trim(p_values->>'evidence_path'),'') is null then raise exception 'permission_evidence_required'; end if;
 if nullif(p_values->>'import_url','') is not null and p_values->>'import_url' !~ '^https://' then raise exception 'https_required'; end if;
 if p_replace_id is null then
 select r.media_id,r.incoming_path into target,path from public.reserve_species_media_upload(p_species_id,null,p_values->>'type',p_values->>'author',p_values->>'license',p_values->>'source',p_values->>'source_url',p_values->>'filename',false,p_values->>'evidence_path')r;
 else
 select * into old from public.species_media where id=p_replace_id and species_id=p_species_id and status='approved' for update;
 if not found or old.type<>p_values->>'type' then raise exception 'replacement_target_invalid'; end if;
 if exists(select 1 from public.species_media where replaces_media_id=old.id and status in('reserved','processing','ready')) then raise exception 'replacement_already_pending'; end if;
 path:=format('%s/%s',actor,gen_random_uuid());
 insert into public.species_media(species_id,type,ordinal,is_primary,author,license,source,source_url,original_filename,evidence_path,uploaded_by,incoming_path,replaces_media_id)
 values(p_species_id,old.type,old.ordinal,false,trim(p_values->>'author'),p_values->>'license',trim(p_values->>'source'),nullif(p_values->>'source_url',''),p_values->>'filename',nullif(p_values->>'evidence_path',''),actor,path,old.id) returning id into target;
 end if;
 update public.species_media set import_url=nullif(p_values->>'import_url',''),clip_start_seconds=case when type='audio' then coalesce((p_values->>'clip_start_seconds')::numeric,0) else null end,clip_duration_seconds=case when type='audio' then coalesce((p_values->>'clip_duration_seconds')::numeric,15) else null end where id=target;
 media_id:=target;incoming_path:=path;return next;
end $$;
revoke all on function public.submit_visual_species_change(uuid,timestamptz,jsonb,jsonb,jsonb,text,boolean,boolean),public.review_species_change(uuid,boolean,boolean),public.reserve_editor_media(uuid,jsonb,uuid) from public,anon;
grant execute on function public.submit_visual_species_change(uuid,timestamptz,jsonb,jsonb,jsonb,text,boolean,boolean),public.review_species_change(uuid,boolean,boolean),public.reserve_editor_media(uuid,jsonb,uuid) to authenticated;
notify pgrst,'reload schema';

-- A deliberately retired legacy URL must never reappear in the list fallback.
do $$ declare body text; begin
 body:=pg_get_viewdef('public.species_editor'::regclass,true);
 body:=replace(body,'m.status = ''archived''::text','m.status = ''archived''::text AND NOT m.removed_by_editor');
 execute 'create or replace view public.species_editor with (security_invoker=true) as '||body;
end $$;
create function public.get_editorial_trait_options(p_field text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.require_editor();
 if p_field not in('diet','microhabitats','vegetationFormations','trophicRoles','hosts','plantAssociations') then raise exception 'invalid_trait'; end if;
 return (select coalesce(jsonb_agg(value order by value),'[]') from (select distinct trim(v) value from public.species s cross join lateral jsonb_array_elements_text(coalesce(s.ecology->p_field,'[]'))v where s.status='active' and length(trim(v))>0)t);
end $$;
revoke all on function public.get_editorial_trait_options(text) from public,anon;
grant execute on function public.get_editorial_trait_options(text) to authenticated;

