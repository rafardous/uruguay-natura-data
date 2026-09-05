alter table public.media_assets
  add column clip_start_seconds numeric,
  add column clip_duration_seconds numeric;

alter table public.media_assets
  add constraint media_audio_clip_valid check (
    (kind = 'image' and clip_start_seconds is null and clip_duration_seconds is null)
    or
    (kind = 'audio' and clip_start_seconds >= 0 and clip_duration_seconds > 0 and clip_duration_seconds <= 15)
  );

drop function public.create_media_asset(uuid,public.media_kind,text,public.media_license,text,text,text,text);

create function public.create_media_asset(
  p_species_id uuid,
  p_kind public.media_kind,
  p_author text,
  p_license public.media_license,
  p_source_url text,
  p_evidence_key text,
  p_incoming_key text,
  p_terms_version text,
  p_clip_start_seconds numeric default null,
  p_clip_duration_seconds numeric default null
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_actor uuid := public.require_editor(); v_asset uuid; v_job uuid;
begin
  if p_incoming_key not like (v_actor::text || '/%') then raise exception 'invalid_incoming_key'; end if;
  if p_license = 'permission' and p_evidence_key is null then raise exception 'permission_evidence_required'; end if;
  if p_kind = 'audio' and (p_clip_start_seconds is null or p_clip_duration_seconds is null or p_clip_start_seconds < 0 or p_clip_duration_seconds <= 0 or p_clip_duration_seconds > 15) then raise exception 'invalid_audio_clip'; end if;
  if p_kind = 'image' and (p_clip_start_seconds is not null or p_clip_duration_seconds is not null) then raise exception 'image_cannot_have_audio_clip'; end if;
  insert into public.media_assets(
    species_id, kind, incoming_key, evidence_key, author, license, source_url,
    terms_version, uploaded_by, clip_start_seconds, clip_duration_seconds
  ) values (
    p_species_id, p_kind, p_incoming_key, p_evidence_key, trim(p_author),
    p_license, p_source_url, p_terms_version, v_actor,
    p_clip_start_seconds, p_clip_duration_seconds
  ) returning id into v_asset;
  insert into public.media_jobs(media_asset_id, requested_by) values (v_asset, v_actor) returning id into v_job;
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, payload)
  values (v_actor, 'media.uploaded', 'media', v_asset::text, jsonb_build_object(
    'kind', p_kind, 'license', p_license, 'clipStartSeconds', p_clip_start_seconds,
    'clipDurationSeconds', p_clip_duration_seconds
  ));
  return v_job;
end;
$$;

revoke execute on function public.create_media_asset(uuid,public.media_kind,text,public.media_license,text,text,text,text,numeric,numeric) from public, anon, authenticated;
grant execute on function public.create_media_asset(uuid,public.media_kind,text,public.media_license,text,text,text,text,numeric,numeric) to authenticated;
