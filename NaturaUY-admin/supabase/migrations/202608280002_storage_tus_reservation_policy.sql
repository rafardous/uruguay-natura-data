-- TUS evaluates INSERT policies before Storage persists the normalized
-- mimetype/size metadata. The incoming bucket already enforces both limits;
-- this policy is intentionally limited to the durable reservation and owner.
drop policy if exists incoming_insert_reserved on storage.objects;
create policy incoming_insert_reserved on storage.objects for insert to authenticated
with check (
  bucket_id='incoming' and public.has_editor_access()
  and exists(
    select 1
    from public.media_jobs job
    join public.species_media media on media.id=job.species_media_id
    where job.incoming_path=name
      and job.requested_by=auth.uid()
      and job.status='pending'
  )
);
