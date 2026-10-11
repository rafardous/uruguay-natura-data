-- Adiviá: only editorial overrides. Published species/facts remain authoritative.
create table public.species_game_clues (
  id uuid primary key default gen_random_uuid(),
  species_id uuid not null references public.species(id) on delete restrict,
  kind text not null check(kind in ('habitat','diet','behavior','appearance','decisive')),
  body text not null check(length(trim(body)) between 15 and 600),
  sort_order smallint not null check(sort_order between 1 and 5),
  source_id uuid not null references public.catalog_sources(id) on delete restrict,
  source_record_id text,
  active boolean not null default true,
  created_by uuid not null references public.profiles(user_id),
  reviewed_by uuid not null references public.profiles(user_id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index species_game_clues_kind_idx on public.species_game_clues(species_id,kind) where active;
create unique index species_game_clues_order_idx on public.species_game_clues(species_id,sort_order) where active;
alter table public.species_game_clues enable row level security;
revoke all on public.species_game_clues from anon,authenticated;
grant select on public.species_game_clues to authenticated;
create policy clues_editor_read on public.species_game_clues for select to authenticated using((select public.has_editor_access()));

alter table public.species_game_rules drop constraint species_game_rules_game_key_check;
alter table public.species_game_rules add constraint species_game_rules_game_key_check check(game_key in ('quiz','naming','puzzle','trivia','classify','habitat','guess','jigsaw'));
alter table public.content_changes drop constraint content_changes_content_type_check;
alter table public.content_changes add constraint content_changes_content_type_check check(content_type in ('game_profile','game_rule','fact','trivia','taxon_content','game_clue','abundance'));

create function private.validate_game_clue(p_species_id uuid,p_values jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_species public.species; v_name text; v_text text;
begin
  select * into v_species from public.species where id=p_species_id and status='active';
  if not found then raise exception 'active_species_required'; end if;
  if jsonb_typeof(p_values) is distinct from 'object'
    or coalesce(p_values->>'kind','') not in ('habitat','diet','behavior','appearance','decisive')
    or length(trim(coalesce(p_values->>'body',''))) not between 15 and 600
    or coalesce((p_values->>'sort_order')::integer,0) not between 1 and 5
  then raise exception 'invalid_game_clue'; end if;
  if not exists(select 1 from public.catalog_sources where id=(p_values->>'source_id')::uuid and active and use_policy='redistributable') then raise exception 'redistributable_source_required'; end if;
  v_text:=' '||regexp_replace(translate(lower(trim(p_values->>'body')),'áéíóúüñ','aeiouun'),'[^[:alnum:]]+',' ','g')||' ';
  for v_name in select unnest(array[v_species.common_name,v_species.scientific_name,v_species.accepted_name]||v_species.alternate_common_names) loop
    if length(trim(coalesce(v_name,'')))>2 and position(' '||regexp_replace(translate(lower(trim(v_name)),'áéíóúüñ','aeiouun'),'[^[:alnum:]]+',' ','g')||' ' in v_text)>0 then raise exception 'clue_reveals_answer'; end if;
  end loop;
end $$;

create function private.submit_game_clue_change(p_entity_id uuid,p_species_id uuid,p_operation text,p_values jsonb,p_comment text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.require_editor(); v_id uuid; v_before jsonb:='{}';
begin
  if p_operation is null or p_operation not in ('upsert','archive') then raise exception 'invalid_operation'; end if;
  if p_entity_id is not null then
    select to_jsonb(c) into v_before from public.species_game_clues c where id=p_entity_id and species_id=p_species_id;
    if not found then raise exception 'clue_not_found'; end if;
  elsif p_operation='archive' then raise exception 'clue_not_found'; end if;
  if p_operation='upsert' then perform private.validate_game_clue(p_species_id,p_values); end if;
  insert into public.content_changes(content_type,entity_id,species_id,operation,proposed_values,before_values,proposed_by,comment)
    values('game_clue',p_entity_id,p_species_id,p_operation,p_values,coalesce(v_before,'{}'),v_actor,p_comment) returning id into v_id;
  return v_id;
end $$;

create function private.review_game_clue_change(p_change_id uuid,p_approve boolean,p_confirm boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.require_editor(); v_change public.content_changes; v_before jsonb:='{}'; v_after jsonb; v_id uuid;
begin
  select * into v_change from public.content_changes where id=p_change_id and content_type='game_clue' for update;
  if not found or v_change.status<>'pending' then raise exception 'change_not_pending'; end if;
  if v_change.proposed_by=v_actor and not coalesce(p_confirm,false) then raise exception 'self_validation_confirmation_required'; end if;
  if not coalesce(p_approve,false) then
    update public.content_changes set status='rejected',reviewed_by=v_actor,reviewed_at=now(),self_validation_confirmed=coalesce(p_confirm,false) where id=p_change_id; return p_change_id;
  end if;
  if v_change.entity_id is not null then
    select to_jsonb(c) into v_before from public.species_game_clues c where id=v_change.entity_id and species_id=v_change.species_id for update;
    if not found or v_before is distinct from v_change.before_values then raise exception 'clue_change_conflict'; end if;
  end if;
  v_id:=coalesce(v_change.entity_id,gen_random_uuid());
  if v_change.operation='archive' then update public.species_game_clues set active=false,updated_at=now(),reviewed_by=v_actor where id=v_id;
  else
    perform private.validate_game_clue(v_change.species_id,v_change.proposed_values);
    insert into public.species_game_clues(id,species_id,kind,body,sort_order,source_id,source_record_id,created_by,reviewed_by)
    values(v_id,v_change.species_id,v_change.proposed_values->>'kind',trim(v_change.proposed_values->>'body'),(v_change.proposed_values->>'sort_order')::smallint,(v_change.proposed_values->>'source_id')::uuid,v_change.proposed_values->>'source_record_id',v_change.proposed_by,v_actor)
    on conflict(id) do update set kind=excluded.kind,body=excluded.body,sort_order=excluded.sort_order,source_id=excluded.source_id,source_record_id=excluded.source_record_id,active=true,reviewed_by=v_actor,updated_at=now();
  end if;
  select to_jsonb(c) into v_after from public.species_game_clues c where id=v_id;
  update public.content_changes set entity_id=v_id,status='approved',before_values=coalesce(v_before,'{}'),after_values=v_after,reviewed_by=v_actor,reviewed_at=now(),self_validation_confirmed=coalesce(p_confirm,false) where id=p_change_id;
  return v_id;
end $$;

-- Preserve the existing taxon/trivia dispatcher and its media validation.
create function private.review_non_clue_content_change(p_change_id uuid,p_approve boolean,p_confirm_self_validation boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_type text; v_id uuid; v_media uuid;
begin
  select content_type into v_type from public.content_changes where id=p_change_id;
  if v_type='taxon_content' then return private.review_taxon_content_change(p_change_id,p_approve,p_confirm_self_validation); end if;
  v_id:=private.review_content_change(p_change_id,p_approve,p_confirm_self_validation);
  if p_approve and v_type='trivia' then
    select nullif(proposed_values->>'image_media_id','')::uuid into v_media from public.content_changes where id=p_change_id;
    if v_media is not null and not exists(select 1 from public.species_media m join public.trivia_questions q on q.id=v_id where m.id=v_media and m.type='image' and m.status='approved' and (q.species_id is null or m.species_id=q.species_id)) then raise exception 'invalid_trivia_image'; end if;
    update public.trivia_questions set image_media_id=v_media where id=v_id;
  end if;
  return v_id;
end $$;
create or replace function public.submit_content_change(p_content_type text,p_entity_id uuid,p_species_id uuid,p_operation text,p_proposed_values jsonb,p_comment text default null) returns uuid
language plpgsql security invoker set search_path='' as $$
begin
  if p_content_type='game_clue' then return private.submit_game_clue_change(p_entity_id,p_species_id,p_operation,p_proposed_values,p_comment); end if;
  if p_content_type='taxon_content' then
    if p_operation<>'upsert' or p_species_id is not null then raise exception 'invalid_taxon_content_change'; end if;
    return private.submit_taxon_content_change(p_entity_id,p_proposed_values,p_comment);
  end if;
  return private.submit_content_change(p_content_type,p_entity_id,p_species_id,p_operation,p_proposed_values,p_comment);
end $$;
create or replace function public.review_content_change(p_change_id uuid,p_approve boolean,p_confirm_self_validation boolean default false) returns uuid
language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.content_changes where id=p_change_id and content_type='game_clue') then return private.review_game_clue_change(p_change_id,p_approve,p_confirm_self_validation); end if;
  return private.review_non_clue_content_change(p_change_id,p_approve,p_confirm_self_validation);
end $$;
revoke all on function private.validate_game_clue(uuid,jsonb),private.submit_game_clue_change(uuid,uuid,text,jsonb,text),private.review_game_clue_change(uuid,boolean,boolean),private.review_non_clue_content_change(uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function private.submit_game_clue_change(uuid,uuid,text,jsonb,text),private.review_game_clue_change(uuid,boolean,boolean),private.review_non_clue_content_change(uuid,boolean,boolean) to authenticated;

create table public.mobile_enriched_game_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check(mode in ('guess_search','guess_choices','jigsaw')),
  scope text not null check(scope ~ '^(animals_all|birds|mammals|reptiles|amphibians|fish|arthropods|arachnids|insects|crustaceans|plants):(easy|medium|hard)(:[34])?$'),
  best_score integer not null default 0 check(best_score between 0 and 500),
  best_time_ms integer not null default 0 check(best_time_ms between 0 and 2147483647),
  fewest_moves integer not null default 0 check(fewest_moves between 0 and 1000000),
  played_at bigint not null check(played_at>0), updated_at bigint not null check(updated_at>0),
  primary key(user_id,mode,scope),
  check((mode='jigsaw' and scope ~ ':[34]$' and best_time_ms>0 and fewest_moves>0 and best_score=0) or (mode in ('guess_search','guess_choices') and scope !~ ':[34]$' and best_time_ms=0 and fewest_moves=0 and (mode='guess_search' or best_score<=250)))
);
alter table public.mobile_enriched_game_records enable row level security;
revoke all on public.mobile_enriched_game_records from anon,authenticated;
grant select on public.mobile_enriched_game_records to authenticated;
create policy enriched_records_owner on public.mobile_enriched_game_records for select to authenticated using((select auth.uid())=user_id);
create function private.sync_enriched_game_records(p_records jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); r jsonb; n integer:=0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records)>24 then raise exception 'invalid_records'; end if;
  for r in select * from jsonb_array_elements(p_records) loop
    insert into public.mobile_enriched_game_records(user_id,mode,scope,best_score,best_time_ms,fewest_moves,played_at,updated_at)
    values(v_uid,r->>'mode',r->>'scope',(r->>'best_score')::integer,(r->>'best_time_ms')::integer,(r->>'fewest_moves')::integer,(r->>'played_at')::bigint,(r->>'updated_at')::bigint)
    on conflict(user_id,mode,scope) do update set best_score=greatest(mobile_enriched_game_records.best_score,excluded.best_score),
      best_time_ms=case when excluded.mode='jigsaw' then least(mobile_enriched_game_records.best_time_ms,excluded.best_time_ms) else 0 end,
      fewest_moves=case when excluded.mode='jigsaw' then least(mobile_enriched_game_records.fewest_moves,excluded.fewest_moves) else 0 end,
      played_at=greatest(mobile_enriched_game_records.played_at,excluded.played_at),updated_at=greatest(mobile_enriched_game_records.updated_at,excluded.updated_at);
    n:=n+1;
  end loop;
  return jsonb_build_object('accepted',n);
end $$;
create function public.sync_enriched_game_records(p_records jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.sync_enriched_game_records(p_records) $$;
create function public.get_enriched_game_records() returns jsonb language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(r)-'user_id'),'[]') from public.mobile_enriched_game_records r where user_id=(select auth.uid())
$$;
revoke all on function private.sync_enriched_game_records(jsonb),public.sync_enriched_game_records(jsonb),public.get_enriched_game_records() from public,anon;
grant execute on function private.sync_enriched_game_records(jsonb),public.sync_enriched_game_records(jsonb),public.get_enriched_game_records() to authenticated;
