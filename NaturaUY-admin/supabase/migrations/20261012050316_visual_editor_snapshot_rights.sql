-- Freeze permissions metadata as well as file identity when reviewing a gallery.
create or replace function private.gallery_snapshot(p_species_id uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'status',m.status,'ordinal',m.ordinal,'is_primary',m.is_primary,'checksum_sha256',m.checksum_sha256,'author',m.author,'source',m.source,'license',m.license,'source_url',m.source_url,'removed_by_editor',m.removed_by_editor,'evidence_path',m.evidence_path,'license_url',m.license_url,'original_license',m.original_license,'external_id',m.external_id) order by m.id),'[]') from public.species_media m
 where m.species_id=p_species_id and (m.status='approved' or (m.status='archived' and m.license='legacy' and not m.removed_by_editor))
$$;
revoke all on function private.gallery_snapshot(uuid) from public,anon,authenticated;
