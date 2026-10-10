-- Schema 14: altura botánica en centímetros y sincronización de fenología.
alter table public.plant_profiles
  add column if not exists height_min_cm numeric(9,2),
  add column if not exists height_max_cm numeric(9,2);
alter table public.plant_profiles
  add constraint plant_height_positive check (
    (height_min_cm is null or height_min_cm > 0) and
    (height_max_cm is null or height_max_cm > 0) and
    (height_min_cm is null or height_max_cm is null or height_min_cm <= height_max_cm)
  );

create or replace function private.sync_plant_profile_from_species()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_flowering jsonb := new.natural_history #> '{plant,phenology,floweringMonths}';
  v_fruiting jsonb := new.natural_history #> '{plant,phenology,fruitingMonths}';
begin
  if new.kingdom is distinct from 'Plantae' then
    delete from public.plant_profiles where species_id=new.id;
    return new;
  end if;
  if v_flowering is not null and jsonb_typeof(v_flowering) <> 'array' then raise exception 'invalid_flowering_months'; end if;
  if v_fruiting is not null and jsonb_typeof(v_fruiting) <> 'array' then raise exception 'invalid_fruiting_months'; end if;
  insert into public.plant_profiles(
    species_id,habit,life_form,height_min_cm,height_max_cm,flowering_months,fruiting_months,
    nomenclatural_authorship,original_publication
  ) values (
    new.id,
    nullif(new.natural_history #>> '{plant,habit}',''),
    nullif(new.natural_history #>> '{plant,lifeForm}',''),
    nullif(new.natural_history #>> '{plant,heightCm,min}','')::numeric,
    nullif(new.natural_history #>> '{plant,heightCm,max}','')::numeric,
    coalesce(array(select distinct value::smallint from jsonb_array_elements_text(coalesce(v_flowering,'[]'::jsonb)) as value order by value::smallint),'{}'::smallint[]),
    coalesce(array(select distinct value::smallint from jsonb_array_elements_text(coalesce(v_fruiting,'[]'::jsonb)) as value order by value::smallint),'{}'::smallint[]),
    nullif(new.natural_history #>> '{plant,nomenclature,authorship}',''),
    nullif(new.natural_history #>> '{plant,nomenclature,publication}','')
  )
  on conflict(species_id) do update set
    habit=excluded.habit,life_form=excluded.life_form,
    height_min_cm=excluded.height_min_cm,height_max_cm=excluded.height_max_cm,
    flowering_months=excluded.flowering_months,fruiting_months=excluded.fruiting_months,
    nomenclatural_authorship=excluded.nomenclatural_authorship,original_publication=excluded.original_publication;
  return new;
end $$;
revoke all on function private.sync_plant_profile_from_species() from public,anon,authenticated;

create or replace view public.plant_species_editor with (security_invoker=true) as
select s.*,p.habit,p.life_form,p.flowering_months,p.fruiting_months,
  p.nomenclatural_authorship,p.original_publication,p.height_min_cm,p.height_max_cm
from public.species s join public.plant_profiles p on p.species_id=s.id where s.kingdom='Plantae';
grant select on public.plant_species_editor to authenticated;
