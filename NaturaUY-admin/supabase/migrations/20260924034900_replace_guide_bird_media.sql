-- La carga verifica SHA-256 de ambos objetos en Storage antes de llamar esta RPC.
-- Cada invocación sustituye una especie en una única transacción y conserva el historial.
create or replace function public.replace_guide_bird_media(p_species_id uuid, p_photos jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_species public.species%rowtype;
  v_photo jsonb;
  v_old public.species_media%rowtype;
  v_ids uuid[] := '{}';
  v_number integer;
  v_number_seen integer;
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
    if v_ordinal <> coalesce(array_length(v_ids, 1), 0) + 1
      or (v_photo->>'species_id')::uuid is distinct from p_species_id
      or v_photo->>'type' is distinct from 'image'
      or v_photo->>'status' is distinct from 'approved'
      or v_photo->>'license' is distinct from 'permission'
      or v_photo->>'source' is distinct from 'Archivo fotográfico familiar'
      or (v_photo->>'is_primary')::boolean is distinct from (v_ordinal = 1)
      or nullif(trim(v_photo->>'author'), '') is null
      or nullif(trim(v_photo->>'evidence_path'), '') is null
      or v_photo->>'authorization_evidence_ref' is distinct from v_photo->>'evidence_path'
      or nullif(trim(v_photo->>'original_filename'), '') is null
      or coalesce((v_photo->>'checksum_sha256') ~ '^[0-9a-f]{64}$', false) = false
      or coalesce((v_photo->>'storage_path') ~ '^guia-aves/[0-9]{3}/0[12]\.webp$', false) = false
      or right(v_photo->>'storage_path', 7) is distinct from ('0' || v_ordinal || '.webp')
      or v_photo->>'thumbnail_path' is distinct from replace(v_photo->>'storage_path', '.webp', '-480.webp')
    then
      raise exception 'invalid_guide_media_photo';
    end if;
    v_number := substring(v_photo->>'storage_path' from '^guia-aves/([0-9]{3})/')::integer;
    if v_number not between 1 and 435 or (v_number_seen is not null and v_number_seen <> v_number) then
      raise exception 'invalid_guide_number';
    end if;
    v_number_seen := v_number;
    v_ids := array_append(v_ids, (v_photo->>'id')::uuid);
    select * into v_old from public.species_media where id = (v_photo->>'id')::uuid;
    if found and (
      v_old.status <> 'approved' or v_old.species_id is distinct from p_species_id
      or v_old.is_primary is distinct from (v_ordinal = 1)
      or v_old.ordinal <> v_ordinal or v_old.storage_path is distinct from v_photo->>'storage_path'
      or v_old.thumbnail_path is distinct from v_photo->>'thumbnail_path'
      or v_old.checksum_sha256 is distinct from v_photo->>'checksum_sha256'
      or v_old.author is distinct from v_photo->>'author'
      or v_old.license <> 'permission' or v_old.source <> 'Archivo fotográfico familiar'
      or v_old.evidence_path is distinct from v_photo->>'evidence_path'
      or v_old.authorization_evidence_ref is distinct from v_photo->>'authorization_evidence_ref'
      or v_old.original_filename is distinct from v_photo->>'original_filename'
    ) then
      raise exception 'guide_media_id_conflict';
    end if;
  end loop;

  update public.species_media
    set status = 'archived', is_primary = false
    where species_id = p_species_id and type = 'image'
      and status not in ('archived', 'rejected') and id <> all(v_ids);

  for v_photo in select value from jsonb_array_elements(p_photos) loop
    if exists(select 1 from public.species_media where id = (v_photo->>'id')::uuid) then
      continue;
    end if;
    insert into public.species_media (
      id, species_id, type, ordinal, is_primary, status, storage_path, thumbnail_path,
      author, license, source, original_filename, evidence_path,
      authorization_evidence_ref, uploaded_by, checksum_sha256, processed_at
    ) values (
      (v_photo->>'id')::uuid, p_species_id, 'image', (v_photo->>'ordinal')::smallint,
      (v_photo->>'is_primary')::boolean, 'approved', v_photo->>'storage_path',
      v_photo->>'thumbnail_path', v_photo->>'author', 'permission',
      'Archivo fotográfico familiar', v_photo->>'original_filename',
      v_photo->>'evidence_path', v_photo->>'authorization_evidence_ref',
      (v_photo->>'uploaded_by')::uuid, v_photo->>'checksum_sha256', now()
    );
    get diagnostics v_ordinal = row_count;
    v_inserted := v_inserted + v_ordinal;
  end loop;
  if (select count(*) from public.species_media where species_id = p_species_id
      and type = 'image' and status not in ('archived', 'rejected')) > 2 then
    raise exception 'guide_media_image_limit_exceeded';
  end if;
  -- request_catalog_publish detecta los medios nuevos por processed_at.
  return v_inserted;
end;
$$;

revoke all on function public.replace_guide_bird_media(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_guide_bird_media(uuid, jsonb) to service_role;
