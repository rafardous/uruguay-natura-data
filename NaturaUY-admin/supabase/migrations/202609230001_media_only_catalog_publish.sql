-- Approved media must be enough to request the next manual catalog release.
-- This migration follows schema 13 and 14; their trigger supplies schema_version 14.
do $$
begin
  if to_regprocedure('private.force_catalog_schema_14()') is null then
    raise exception 'media_publish_requires_catalog_schema_14';
  end if;
end $$;

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
  then raise exception 'catalog_not_dirty'; end if;
  select id into v_id from public.catalog_releases where status in ('pending','building') order by requested_at desc limit 1;
  if v_id is not null then return v_id; end if;
  select coalesce(max(version),0)+1 into v_version from public.catalog_releases;
  insert into public.catalog_releases(version,requested_by) values(v_version,v_actor) returning id into v_id;
  return v_id;
end $function$;

revoke all on function public.request_catalog_publish() from public, anon;
grant execute on function public.request_catalog_publish() to authenticated;
