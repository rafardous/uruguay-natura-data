-- Permite publicar el contrato de ambientes requerido por Arapy 1.4.0 aunque
-- no haya cambios editoriales recientes. La operación sigue siendo admin-only.
create or replace function public.request_catalog_schema15_publish()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.require_admin();
  target uuid;
  target_schema integer;
  next_version bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('catalog-publish', 0));

  select id, schema_version into target, target_schema
  from public.catalog_releases
  where status in ('pending', 'building')
  order by requested_at desc
  limit 1;

  if target is not null then
    if target_schema = 15 then return target; end if;
    raise exception 'catalog_release_in_progress';
  end if;

  if coalesce((select schema_version from public.catalog_releases where status='published' order by version desc limit 1), 0) >= 15 then
    raise exception 'catalog_schema15_already_published';
  end if;

  select coalesce(max(version), 0) + 1 into next_version from public.catalog_releases;
  insert into public.catalog_releases(version, schema_version, min_app_version, requested_by)
  values (next_version, 15, '1.4.0', actor)
  returning id into target;
  return target;
end;
$$;

revoke all on function public.request_catalog_schema15_publish() from public, anon;
grant execute on function public.request_catalog_schema15_publish() to authenticated;
