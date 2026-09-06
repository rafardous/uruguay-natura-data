-- Aggregate public popularity without exposing users, favorite counts or rows.
-- The mobile client only needs stable catalog codes to hydrate from offline SQLite.

create index if not exists favorites_active_species_idx
  on public.favorites (species_id, updated_at desc)
  where is_favorite;

drop function if exists public.get_most_favorited_species(integer);
create or replace function public.get_most_favorited_species(p_limit integer default 1)
returns table(catalog_code text)
language sql
stable
security definer
set search_path = public
as $$
  select s.catalog_code
  from public.favorites f
  join public.species s on s.id = f.species_id
  where f.is_favorite and s.status = 'active'
  group by s.id, s.catalog_code
  order by count(*) desc, max(f.updated_at) desc, s.catalog_code asc
  limit least(greatest(coalesce(p_limit, 1), 1), 3)
$$;

revoke all on function public.get_most_favorited_species(integer) from public;
grant execute on function public.get_most_favorited_species(integer) to anon, authenticated;
