-- Sustituye las imágenes de una especie de la guía con 1-2 medios familiares
-- y/o externos previamente verificados por SHA-256 en media-public.
create or replace function public.reconcile_guide_bird_media(p_species_id uuid, p_photos jsonb)
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_species public.species%rowtype;
  v_photo jsonb;
  v_old public.species_media%rowtype;
  v_ids uuid[] := '{}';
  v_number integer;
  v_seen_number integer;
  v_ordinal integer;
  v_inserted integer := 0;
begin
  if jsonb_typeof(p_photos) is distinct from 'array' or jsonb_array_length(p_photos) not between 1 and 2 then
    raise exception 'guide_media_requires_one_or_two_photos';
  end if;
  select * into v_species from public.species where id = p_species_id for update;
  if not found or v_species.class <> 'Aves' or v_species.status <> 'active' then
    raise exception 'guide_media_requires_active_bird';
  end if;

  for v_photo in select value from jsonb_array_elements(p_photos) loop
    v_ordinal := (v_photo->>'ordinal')::integer;
    v_number := substring(v_photo->>'storage_path' from '^guia-aves/([0-9]{3})/')::integer;
    if v_ordinal <> coalesce(array_length(v_ids, 1), 0) + 1
      or (v_photo->>'species_id')::uuid is distinct from p_species_id
      or v_photo->>'type' is distinct from 'image'
      or v_photo->>'status' is distinct from 'approved'
      or (v_photo->>'is_primary')::boolean is distinct from (v_ordinal = 1)
      or v_number is null or v_number not between 1 and 435
      or (v_seen_number is not null and v_seen_number <> v_number)
      or (v_photo->>'id')::uuid = any(v_ids)
      or nullif(trim(v_photo->>'author'), '') is null
      or coalesce((v_photo->>'checksum_sha256') ~ '^[0-9a-f]{64}$', false) = false
      or v_photo->>'thumbnail_path' is distinct from replace(v_photo->>'storage_path', '.webp', '-480.webp')
    then raise exception 'invalid_guide_media_photo'; end if;
    v_seen_number := v_number;
    if v_photo->>'license' = 'permission' then
      if v_photo->>'source' is distinct from 'Archivo fotográfico familiar'
        or coalesce((v_photo->>'storage_path') ~ '^guia-aves/[0-9]{3}/0[12]\.webp$', false) = false
        or nullif(trim(v_photo->>'evidence_path'), '') is null
        or v_photo->>'authorization_evidence_ref' is distinct from v_photo->>'evidence_path'
        or nullif(trim(v_photo->>'original_filename'), '') is null
      then raise exception 'invalid_family_guide_photo'; end if;
    elsif v_photo->>'license' in ('CC0', 'CC-BY-4.0') then
      if v_photo->>'source' not in ('inaturalist', 'wikimedia')
        or coalesce((v_photo->>'storage_path') ~ '^guia-aves/[0-9]{3}/external/0[12]-[0-9a-f]{12}\.webp$', false) = false
        or coalesce((v_photo->>'source_url') ~ '^https://', false) = false
        or v_photo->>'license_url' is distinct from case v_photo->>'license'
          when 'CC0' then 'https://creativecommons.org/publicdomain/zero/1.0/'
          else 'https://creativecommons.org/licenses/by/4.0/' end
      then raise exception 'invalid_external_guide_photo'; end if;
    else raise exception 'invalid_guide_license'; end if;
    v_ids := array_append(v_ids, (v_photo->>'id')::uuid);
    select * into v_old from public.species_media where id = (v_photo->>'id')::uuid;
    if found and (v_old.status not in ('approved', 'archived')
      or v_old.type is distinct from 'image'
      or v_old.species_id is distinct from p_species_id
      or v_old.storage_path is distinct from v_photo->>'storage_path'
      or v_old.thumbnail_path is distinct from v_photo->>'thumbnail_path'
      or v_old.checksum_sha256 is distinct from v_photo->>'checksum_sha256'
      or v_old.license is distinct from v_photo->>'license'
      or v_old.author is distinct from v_photo->>'author'
      or v_old.source is distinct from v_photo->>'source'
      or v_old.source_url is distinct from v_photo->>'source_url'
      or v_old.license_url is distinct from v_photo->>'license_url'
      or v_old.original_filename is distinct from v_photo->>'original_filename'
      or v_old.evidence_path is distinct from v_photo->>'evidence_path'
      or v_old.authorization_evidence_ref is distinct from v_photo->>'authorization_evidence_ref')
    then raise exception 'guide_media_id_conflict'; end if;
  end loop;

  update public.species_media set status = 'archived', is_primary = false
    where species_id = p_species_id and type = 'image'
      and status not in ('archived', 'rejected') and id <> all(v_ids);

  for v_photo in select value from jsonb_array_elements(p_photos) loop
    if exists(select 1 from public.species_media where id = (v_photo->>'id')::uuid) then
      update public.species_media set status = 'approved', ordinal = (v_photo->>'ordinal')::smallint,
        is_primary = (v_photo->>'is_primary')::boolean, processed_at = now()
        where id = (v_photo->>'id')::uuid;
    else
      insert into public.species_media (
        id, species_id, type, ordinal, is_primary, status, storage_path, thumbnail_path,
        author, license, source, source_url, license_url, original_license, original_filename,
        evidence_path, authorization_evidence_ref, selection_details, uploaded_by, checksum_sha256, processed_at
      ) values (
        (v_photo->>'id')::uuid, p_species_id, 'image', (v_photo->>'ordinal')::smallint,
        (v_photo->>'is_primary')::boolean, 'approved', v_photo->>'storage_path', v_photo->>'thumbnail_path',
        v_photo->>'author', v_photo->>'license', v_photo->>'source', v_photo->>'source_url',
        v_photo->>'license_url', v_photo->>'original_license', v_photo->>'original_filename',
        v_photo->>'evidence_path', v_photo->>'authorization_evidence_ref', v_photo->'selection_details',
        (v_photo->>'uploaded_by')::uuid, v_photo->>'checksum_sha256', now()
      );
      v_inserted := v_inserted + 1;
    end if;
  end loop;
  update public.species set primary_image_id = v_ids[1] where id = p_species_id
    and primary_image_id is distinct from v_ids[1];
  if (select count(*) from public.species_media where species_id = p_species_id
      and type = 'image' and status not in ('archived', 'rejected')) > 2 then
    raise exception 'guide_media_image_limit_exceeded';
  end if;
  return v_inserted;
end;
$$;

revoke all on function public.reconcile_guide_bird_media(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reconcile_guide_bird_media(uuid, jsonb) to service_role;
