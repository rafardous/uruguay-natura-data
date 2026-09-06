-- MFA enforcement is deferred during the initial editorial rollout.
create or replace function public.has_admin_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.editor_access
    where user_id = auth.uid()
      and active
      and role = 'admin'
  )
$$;

comment on function public.has_admin_access() is
  'Returns true for active administrators. MFA enforcement is deferred during the initial editorial rollout.';

grant execute on function public.has_admin_access() to anon, authenticated;
