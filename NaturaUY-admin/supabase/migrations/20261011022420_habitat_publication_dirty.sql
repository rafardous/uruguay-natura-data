create index habitat_revisions_created_at on public.habitat_revisions(created_at desc);
create or replace function public.request_catalog_publish()
returns uuid language plpgsql security definer set search_path = '' as $function$
declare v_actor uuid:=public.require_admin(); v_id uuid; v_version bigint; v_last timestamptz;
begin
  select coalesce(max(published_at),'epoch'::timestamptz) into v_last from public.catalog_releases where status='published';
  if not exists(select 1 from public.species_changes c where c.status='approved' and c.reviewed_at>v_last)
     and not exists(select 1 from public.content_changes c where c.status='approved' and c.reviewed_at>v_last)
     and not exists(select 1 from public.species_observability_snapshots o where o.generated_at>v_last)
     and not exists(select 1 from public.taxon_content t where t.updated_at>v_last)
     and not exists(select 1 from public.species_media m where m.status='approved' and m.processed_at>v_last)
     and not exists(select 1 from public.habitat_revisions h where h.created_at>v_last)
  then raise exception 'catalog_not_dirty'; end if;
  select id into v_id from public.catalog_releases where status in ('pending','building') order by requested_at desc limit 1;
  if v_id is not null then return v_id; end if;
  select coalesce(max(version),0)+1 into v_version from public.catalog_releases;
  insert into public.catalog_releases(version,requested_by) values(v_version,v_actor) returning id into v_id;
  return v_id;
end $function$;

revoke all on function public.request_catalog_publish() from public, anon;
grant execute on function public.request_catalog_publish() to authenticated;
create or replace view public.dashboard_stats with (security_invoker=true) as
 SELECT count(*) FILTER (WHERE status = 'active'::text)::integer AS active_species,
    count(*) FILTER (WHERE status = 'archived'::text)::integer AS archived_species,
    ((( SELECT count(*) AS count
           FROM species_changes
          WHERE species_changes.status = 'pending'::text)) + (( SELECT count(*) AS count
           FROM content_changes
          WHERE content_changes.status = 'pending'::text)))::integer AS pending_changes,
    count(*) FILTER (WHERE (EXISTS ( SELECT 1
           FROM species_media m
          WHERE m.species_id = s.id AND m.type = 'image'::text AND m.status = 'approved'::text)))::integer AS with_image,
    count(*) FILTER (WHERE (EXISTS ( SELECT 1
           FROM species_media m
          WHERE m.species_id = s.id AND m.type = 'audio'::text AND m.status = 'approved'::text)))::integer AS with_audio,
    ( SELECT count(*)::integer AS count
           FROM species_media
          WHERE species_media.status = ANY (ARRAY['reserved'::text, 'processing'::text, 'ready'::text])) AS pending_media,
    (EXISTS ( SELECT 1
           FROM species_changes c
          WHERE c.status = 'approved'::text AND c.reviewed_at > COALESCE(( SELECT max(r.published_at) AS max
                   FROM catalog_releases r
                  WHERE r.status = 'published'::text), '1970-01-01 00:00:00+00'::timestamp with time zone))) OR (EXISTS ( SELECT 1
           FROM content_changes c
          WHERE c.status = 'approved'::text AND c.reviewed_at > COALESCE(( SELECT max(r.published_at) AS max
                   FROM catalog_releases r
                  WHERE r.status = 'published'::text), '1970-01-01 00:00:00+00'::timestamp with time zone))) OR (EXISTS ( SELECT 1
           FROM species_observability_snapshots o
          WHERE o.generated_at > COALESCE(( SELECT max(r.published_at) AS max
                   FROM catalog_releases r
                  WHERE r.status = 'published'::text), '1970-01-01 00:00:00+00'::timestamp with time zone))) OR EXISTS (SELECT 1 FROM habitat_revisions h WHERE h.created_at > COALESCE((SELECT max(published_at) FROM catalog_releases WHERE status='published'),'epoch'::timestamptz)) AS dirty_changes,
    ( SELECT max(catalog_releases.version) AS max
           FROM catalog_releases
          WHERE catalog_releases.status = 'published'::text) AS last_release_version,
    ( SELECT max(catalog_releases.published_at) AS max
           FROM catalog_releases
          WHERE catalog_releases.status = 'published'::text) AS last_published_at
   FROM species s;

