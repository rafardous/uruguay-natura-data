create or replace view public.species_editor with (security_invoker=true) as
select
  s.*,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'type', m.type,
        'ordinal', m.ordinal,
        'is_primary', m.is_primary,
        'status', m.status,
        'storage_path', m.storage_path,
        'thumbnail_path', m.thumbnail_path,
        'author', m.author,
        'license', m.license,
        'source', m.source,
        'source_url', m.source_url
      )
      order by case when m.status = 'approved' then 0 else 1 end, m.type, m.ordinal
    ) filter(where m.id is not null),
    '[]'::jsonb
  ) as media
from public.species s
left join public.species_media m
  on m.species_id = s.id
 and (
   m.status = 'approved'
   or (m.status = 'archived' and m.type = 'image' and m.license = 'legacy' and m.source_url is not null)
 )
group by s.id;

create or replace view public.dashboard_stats with (security_invoker=true) as
select
  count(*) filter(where s.status='active')::integer as active_species,
  count(*) filter(where s.status='archived')::integer as archived_species,
  (select count(*)::integer from public.species_changes where status='pending') as pending_changes,
  count(*) filter(where exists(
    select 1 from public.species_media m
    where m.species_id=s.id and m.type='image'
      and (m.status='approved' or (m.status='archived' and m.license='legacy' and m.source_url is not null))
  ))::integer as with_image,
  count(*) filter(where exists(select 1 from public.species_media m where m.species_id=s.id and m.type='audio' and m.status='approved'))::integer as with_audio,
  (select count(*)::integer from public.species_media where status in ('reserved','processing','ready')) as pending_media,
  exists(select 1 from public.species_changes c where c.status='approved' and c.reviewed_at > coalesce((select max(r.published_at) from public.catalog_releases r where r.status='published'),'epoch'::timestamptz)) as dirty_changes,
  (select max(version) from public.catalog_releases where status='published') as last_release_version,
  (select max(published_at) from public.catalog_releases where status='published') as last_published_at
from public.species s;

grant select on public.species_editor, public.dashboard_stats to authenticated;
