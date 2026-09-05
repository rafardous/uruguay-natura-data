create table public.editor_email_invitations (
  email text primary key,
  invited_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  last_invited_at timestamptz not null default now(),
  check (email = lower(trim(email)) and length(email) between 3 and 320)
);

comment on table public.editor_email_invitations is
  'Server-managed allowlist for invitation-only email accounts. OAuth signups remain separate.';

alter table public.editor_email_invitations enable row level security;

create policy editor_email_invitations_auth_hook_read
  on public.editor_email_invitations
  for select
  to supabase_auth_admin
  using (true);

create or replace function public.hook_restrict_new_auth_user(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  requested_provider text := event->'user'->'app_metadata'->>'provider';
  requested_email text := lower(trim(coalesce(event->'user'->>'email', '')));
begin
  if requested_provider = 'google' then
    return '{}'::jsonb;
  end if;

  if requested_provider = 'email'
    and exists (
      select 1
      from public.editor_email_invitations invitation
      where invitation.email = requested_email
    )
  then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', case
        when requested_provider = 'email'
          then 'El registro por correo es unicamente por invitacion.'
        else 'Este proveedor de acceso no esta habilitado.'
      end
    )
  );
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant select on public.editor_email_invitations to supabase_auth_admin;
grant execute on function public.hook_restrict_new_auth_user(jsonb) to supabase_auth_admin;

revoke all on public.editor_email_invitations from public, anon, authenticated;
revoke execute on function public.hook_restrict_new_auth_user(jsonb)
  from public, anon, authenticated;

