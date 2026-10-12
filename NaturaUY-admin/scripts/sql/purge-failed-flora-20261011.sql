begin;
-- One-time purge explicitly requested by the project owner on 2026-10-11.
-- Backup: workflow 38183187752, verified encrypted artifact SHA-256
-- bf7bb467b0974df218a05557ae9799bd35321ef59d201de72bcbd4775765a286.
-- Run inside a transaction; use ROLLBACK for rehearsal. Never disable triggers/FKs.
set local lock_timeout='5s';
lock table public.species, public.species_changes, public.plant_profiles, public.species_taxa in share row exclusive mode;
do $purge$
declare
 ids uuid[];
 before_active text;
 before_changes text;
 before_profiles text;
 before_links text;
 r record;
 n bigint;
begin
 select array_agg(id order by id) into ids from public.species where status='archived' and kingdom='Plantae';
 if cardinality(ids) is distinct from 3057 then raise exception 'Expected exactly 3057 archived plants'; end if;
 if (select md5(string_agg(id::text||':'||catalog_code,',' order by id)) from public.species where id=any(ids)) <> 'afd7361ff68ab3c12128b98c9d0f7874' then raise exception 'Target identities changed'; end if;
 if (select count(*) from public.species where status='active')<>1048
 or (select count(*) from public.species where status='active' and kingdom='Animalia')<>948
 or (select count(*) from public.species where status='active' and kingdom='Plantae')<>100 then raise exception 'Active catalogue changed'; end if;
 select md5(string_agg(to_jsonb(s)::text,'' order by id)) into before_active from public.species s where not(id=any(ids));
 if before_active <> '6acfdb195384e97e234107a6fc069005' then raise exception 'Active species changed since preflight'; end if;
 -- All other direct dependencies must be empty, including personal data and media.
 for r in select conrelid::regclass tbl from pg_constraint where contype='f' and confrelid='public.species'::regclass
 and conrelid not in ('public.species_changes'::regclass,'public.plant_profiles'::regclass,'public.species_taxa'::regclass)
 loop
 execute format('select count(*) from %s where species_id=any($1)',r.tbl) into n using ids;
 if n<>0 then raise exception 'Unexpected dependency in %: %',r.tbl,n; end if;
 end loop;
 if exists(select 1 from public.editorial_revisions where entity_key=any(select unnest(ids)::text)) then raise exception 'Unexpected immutable editorial revisions'; end if;
 select md5(string_agg(to_jsonb(c)::text,'' order by id)) into before_changes from public.species_changes c where not(species_id=any(ids)) or species_id is null;
 select md5(string_agg(to_jsonb(p)::text,'' order by species_id)) into before_profiles from public.plant_profiles p where not(species_id=any(ids));
 select md5(string_agg(to_jsonb(t)::text,'' order by species_id,taxon_id)) into before_links from public.species_taxa t where not(species_id=any(ids));
 delete from public.species_changes where species_id=any(ids);
 get diagnostics n=row_count;
 if n<>6114 then raise exception 'Expected 6114 revisions, found %',n; end if;
 delete from public.plant_profiles where species_id=any(ids);
 get diagnostics n=row_count;
 if n<>3057 then raise exception 'Expected 3057 plant profiles, found %',n; end if;
 delete from public.species_taxa where species_id=any(ids);
 get diagnostics n=row_count;
 if n<>15285 then raise exception 'Expected 15285 taxonomy links, found %',n; end if;
 delete from public.species where id=any(ids);
 get diagnostics n=row_count;
 if n<>3057 then raise exception 'Expected 3057 species, found %',n; end if;
 if (select count(*) from public.species)<>1048 or exists(select 1 from public.species where status='archived') then raise exception 'Unexpected final catalogue'; end if;
 if before_active is distinct from (select md5(string_agg(to_jsonb(s)::text,'' order by id)) from public.species s)
 or before_changes is distinct from (select md5(string_agg(to_jsonb(c)::text,'' order by id)) from public.species_changes c)
 or before_profiles is distinct from (select md5(string_agg(to_jsonb(p)::text,'' order by species_id)) from public.plant_profiles p)
 or before_links is distinct from (select md5(string_agg(to_jsonb(t)::text,'' order by species_id,taxon_id)) from public.species_taxa t)
 then raise exception 'Non-target data changed'; end if;
end
$purge$;
select jsonb_build_object('species',(select count(*) from public.species),'archived',(select count(*) from public.species where status='archived'),'animals',(select count(*) from public.species where kingdom='Animalia'),'plants',(select count(*) from public.species where kingdom='Plantae'),'revisions',(select count(*) from public.species_changes),'active_hash',(select md5(string_agg(to_jsonb(s)::text,'' order by id)) from public.species s)) verification;
commit;

