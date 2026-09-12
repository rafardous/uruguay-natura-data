-- Curated links shown on the mobile home screen. The app stores metadata only;
-- article bodies and automatic scraping are deliberately out of scope.
create table public.home_news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 4 and 180),
  source text not null check (length(trim(source)) between 2 and 80),
  article_url text not null check (article_url ~ '^https://'),
  image_url text check (image_url is null or image_url ~ '^https://'),
  published_at timestamptz,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order integer not null default 0 check (sort_order between -100000 and 100000),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  updated_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index home_news_public_idx on public.home_news (sort_order, published_at desc)
  where status = 'published';

alter table public.home_news enable row level security;
create policy home_news_public_read on public.home_news
  for select to anon, authenticated using (status = 'published');
create policy home_news_admin_read on public.home_news
  for select to authenticated using (public.has_admin_access());
revoke all on public.home_news from anon, authenticated;
grant select on public.home_news to anon, authenticated;

create or replace function private.save_home_news(
  p_id uuid, p_title text, p_source text, p_article_url text, p_image_url text,
  p_published_at timestamptz, p_status text, p_sort_order integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := public.require_admin();
  v_id uuid;
begin
  if length(trim(coalesce(p_title, ''))) not between 4 and 180
     or length(trim(coalesce(p_source, ''))) not between 2 and 80
     or coalesce(p_article_url, '') !~ '^https://'
     or (nullif(trim(coalesce(p_image_url, '')), '') is not null and p_image_url !~ '^https://')
     or p_status not in ('draft','published','archived')
     or p_sort_order not between -100000 and 100000
  then raise exception 'invalid_home_news'; end if;
  if p_status = 'published' and p_published_at is null then
    raise exception 'published_news_requires_date';
  end if;
  insert into public.home_news(id,title,source,article_url,image_url,published_at,status,sort_order,created_by,updated_by)
  values (coalesce(p_id, gen_random_uuid()), trim(p_title), trim(p_source), trim(p_article_url),
          nullif(trim(coalesce(p_image_url, '')), ''), p_published_at, p_status, p_sort_order, v_actor, v_actor)
  on conflict (id) do update set
    title = excluded.title, source = excluded.source, article_url = excluded.article_url,
    image_url = excluded.image_url, published_at = excluded.published_at,
    status = excluded.status, sort_order = excluded.sort_order,
    updated_by = v_actor, updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.save_home_news(
  p_id uuid default null, p_title text default null, p_source text default null,
  p_article_url text default null, p_image_url text default null,
  p_published_at timestamptz default null, p_status text default 'draft',
  p_sort_order integer default 0
) returns uuid language sql security invoker set search_path = '' as $$
  select private.save_home_news($1,$2,$3,$4,$5,$6,$7,$8)
$$;

create or replace function private.archive_home_news(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  update public.home_news set status = 'archived', updated_by = auth.uid(), updated_at = now() where id = p_id;
  if not found then raise exception 'home_news_not_found'; end if;
end $$;

create or replace function public.archive_home_news(p_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.archive_home_news($1)
$$;

revoke execute on function private.save_home_news(uuid,text,text,text,text,timestamptz,text,integer), private.archive_home_news(uuid) from public, anon, authenticated;
grant execute on function private.save_home_news(uuid,text,text,text,text,timestamptz,text,integer), private.archive_home_news(uuid) to authenticated;
revoke execute on function public.save_home_news(uuid,text,text,text,text,timestamptz,text,integer), public.archive_home_news(uuid) from public, anon;
grant execute on function public.save_home_news(uuid,text,text,text,text,timestamptz,text,integer), public.archive_home_news(uuid) to authenticated;

-- Short application form for people who want to help. It is intentionally
-- separate from editor_access: acceptance never grants panel permissions.
create table public.collaborator_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  contact_name text not null check (length(trim(contact_name)) between 2 and 100),
  contact_email text not null check (position('@' in contact_email) > 1),
  interests text[] not null check (cardinality(interests) between 1 and 6),
  experience text not null check (length(trim(experience)) between 20 and 1000),
  motivation text not null check (length(trim(motivation)) between 40 and 1500),
  availability text not null check (availability in ('occasional','monthly','weekly','more')),
  reference_url text check (reference_url is null or reference_url ~ '^https://'),
  consent boolean not null check (consent),
  status text not null default 'pending' check (status in ('pending','reviewing','accepted','rejected','withdrawn')),
  reviewer_id uuid references public.profiles(user_id) on delete set null,
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index collaborator_applications_queue_idx on public.collaborator_applications(status, created_at desc);
create index collaborator_applications_user_idx on public.collaborator_applications(user_id, created_at desc);
create unique index collaborator_applications_one_open_idx on public.collaborator_applications(user_id)
  where status in ('pending','reviewing');

alter table public.collaborator_applications enable row level security;
create policy collaborator_applications_owner_read on public.collaborator_applications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy collaborator_applications_admin_read on public.collaborator_applications
  for select to authenticated using (public.has_admin_access());
revoke all on public.collaborator_applications from anon, authenticated;
grant select on public.collaborator_applications to authenticated;

create or replace function private.submit_collaborator_application(
  p_interests text[], p_experience text, p_motivation text, p_availability text,
  p_reference_url text, p_consent boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_name text;
  v_email text;
  v_id uuid;
begin
  if v_actor is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select coalesce(nullif(trim(p.display_name), ''), 'Usuario Natura UY'), lower(trim(u.email))
    into v_name, v_email
    from public.profiles p join auth.users u on u.id = p.user_id where p.user_id = v_actor;
  if v_email is null then raise exception 'contact_email_missing'; end if;
  if p_interests is null or cardinality(p_interests) not between 1 and 6
     or length(trim(coalesce(p_experience, ''))) not between 20 and 1000
     or length(trim(coalesce(p_motivation, ''))) not between 40 and 1500
     or p_availability not in ('occasional','monthly','weekly','more')
     or (nullif(trim(coalesce(p_reference_url, '')), '') is not null and p_reference_url !~ '^https://')
     or p_consent is not true
  then raise exception 'invalid_collaborator_application'; end if;
  if exists (select 1 from public.collaborator_applications where user_id = v_actor and status in ('pending','reviewing')) then
    raise exception 'collaborator_application_already_open';
  end if;
  insert into public.collaborator_applications(user_id,contact_name,contact_email,interests,experience,motivation,availability,reference_url,consent)
  values(v_actor,v_name,v_email,(select array_agg(trim(item)) from unnest(p_interests) item),trim(p_experience),trim(p_motivation),p_availability,nullif(trim(coalesce(p_reference_url,'')),''),true)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.submit_collaborator_application(
  p_interests text[], p_experience text, p_motivation text, p_availability text,
  p_reference_url text default null, p_consent boolean default false
) returns uuid language sql security invoker set search_path = '' as $$
  select private.submit_collaborator_application($1,$2,$3,$4,$5,$6)
$$;

create or replace function private.review_collaborator_application(p_id uuid,p_status text,p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  if p_status not in ('reviewing','accepted','rejected','withdrawn') then raise exception 'invalid_collaborator_status'; end if;
  update public.collaborator_applications set status=p_status, reviewer_id=auth.uid(), reviewer_note=nullif(trim(coalesce(p_note,'')),''), reviewed_at=case when p_status in ('accepted','rejected','withdrawn') then now() else reviewed_at end, updated_at=now() where id=p_id;
  if not found then raise exception 'collaborator_application_not_found'; end if;
end $$;

create or replace function public.review_collaborator_application(p_id uuid,p_status text,p_note text default null)
returns void language sql security invoker set search_path = '' as $$
  select private.review_collaborator_application($1,$2,$3)
$$;

revoke execute on function private.submit_collaborator_application(text[],text,text,text,text,boolean), private.review_collaborator_application(uuid,text,text) from public, anon, authenticated;
grant execute on function private.submit_collaborator_application(text[],text,text,text,text,boolean), private.review_collaborator_application(uuid,text,text) to authenticated;
revoke execute on function public.submit_collaborator_application(text[],text,text,text,text,boolean), public.review_collaborator_application(uuid,text,text) from public, anon;
grant execute on function public.submit_collaborator_application(text[],text,text,text,text,boolean), public.review_collaborator_application(uuid,text,text) to authenticated;
-- Xeno-canto IDs are globally unique within the approved audio inventory.
-- The image inventory has the analogous constraint in schema 9.
create unique index if not exists species_media_external_audio_unique on public.species_media(external_id)
  where type = 'audio' and external_id is not null;

-- Audio keeps the licence used for Natura UY separate from the original
-- licence shown in the attribution. The evidence reference is editorial
-- metadata and is never serialized into the public mobile catalogue.
alter table public.species_media
  add column if not exists original_license text,
  add column if not exists authorization_evidence_ref text;

create or replace function private.update_species_audio_metadata(
  p_media_id uuid, p_external_id text, p_original_license text, p_authorization_evidence_ref text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_author text;
  v_source text;
begin
  perform public.require_editor();
  if nullif(trim(coalesce(p_external_id, '')), '') is null
     or nullif(trim(coalesce(p_original_license, '')), '') is null
     or nullif(trim(coalesce(p_authorization_evidence_ref, '')), '') is null
  then raise exception 'audio_metadata_required'; end if;
  select author, source into v_author, v_source from public.species_media
    where id = p_media_id and type = 'audio' and status in ('reserved','processing','ready');
  if v_author is null then raise exception 'audio_media_not_found_or_locked'; end if;
  if lower(trim(v_author)) <> 'pedro rinaldi' or lower(trim(v_source)) <> 'xeno-canto' then
    raise exception 'audio_contributor_not_allowed';
  end if;
  update public.species_media set
    external_id = trim(p_external_id),
    original_license = trim(p_original_license),
    authorization_evidence_ref = trim(p_authorization_evidence_ref)
  where id = p_media_id and type = 'audio' and status in ('reserved','processing','ready');
  if not found then raise exception 'audio_media_not_found_or_locked'; end if;
end $$;

create or replace function public.update_species_audio_metadata(
  p_media_id uuid, p_external_id text, p_original_license text, p_authorization_evidence_ref text
) returns void language sql security invoker set search_path = '' as $$
  select private.update_species_audio_metadata($1,$2,$3,$4)
$$;

revoke execute on function private.update_species_audio_metadata(uuid,text,text,text) from public, anon, authenticated;
grant execute on function private.update_species_audio_metadata(uuid,text,text,text) to authenticated;
revoke execute on function public.update_species_audio_metadata(uuid,text,text,text) from public, anon;
grant execute on function public.update_species_audio_metadata(uuid,text,text,text) to authenticated;
