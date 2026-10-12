-- Rechazar una propuesta propia no es aprobarla. Mantener autorización admin
-- y confirmación explícita para la aprobación, en ambas capas del revisor.
do $$
declare name text; body text; previous text;
begin
  foreach name in array array['public.review_species_change', 'private.review_species_change_fields'] loop
    body := pg_get_functiondef((name || '(uuid,boolean,boolean)')::regprocedure);
    previous := body;
    body := replace(body, 'if change.proposed_by=actor and not p_confirm_self_validation', 'if p_approve and change.proposed_by=actor and not p_confirm_self_validation');
    body := replace(body, 'if v_change.proposed_by=v_actor and not p_confirm_self_validation', 'if p_approve and v_change.proposed_by=v_actor and not p_confirm_self_validation');
    if body = previous then raise exception 'review_confirmation_guard_not_found: %', name; end if;
    execute body;
  end loop;
end $$;

-- Una corrección conserva la propuesta anterior como rechazada y crea otra.
-- Transfiere sólo sus medios, sin volver a subirlos ni perder derechos.
create function public.revise_pending_species_create(p_change_id uuid, p_expected_values jsonb, p_values jsonb, p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid := public.require_editor(); previous public.species_changes; next_id uuid;
begin
  select * into previous from public.species_changes where id=p_change_id for update;
  if not found or previous.status<>'pending' or previous.change_type<>'create' then raise exception 'change_not_pending'; end if;
  if previous.proposed_by<>actor and not public.has_admin_access() then raise exception 'pending_create_owner_required'; end if;
  if previous.proposed_values is distinct from p_expected_values then raise exception 'pending_create_conflict'; end if;
  if jsonb_typeof(p_values) is distinct from 'object' or nullif(trim(p_values->>'catalog_code'),'') is null
    or nullif(trim(p_values->>'scientific_name'),'') is null or nullif(trim(p_values->>'common_name'),'') is null
    or nullif(trim(p_reason),'') is null then raise exception 'invalid_change'; end if;
  if coalesce(p_values->>'kingdom','Animalia')<>'Plantae' and nullif(p_values->>'abundance_status','') is not null
    and not exists(select 1 from jsonb_array_elements_text(coalesce(p_values->'field_sources'->'abundance_status','[]'::jsonb)) s where nullif(trim(s),'') is not null)
    then raise exception 'abundance_source_required'; end if;
  next_id := public.submit_species_change(null,'create',p_values,p_reason);
  update public.species_changes set status='rejected', reviewed_by=actor, reviewed_at=now(), self_validation_confirmed=false,
    comment=concat_ws(E'\n',comment,'Corrección de alta: reemplazada por '||next_id::text) where id=p_change_id;
  update public.species_media set change_id=next_id where change_id=p_change_id;
  return next_id;
end $$;
revoke all on function public.revise_pending_species_create(uuid,jsonb,jsonb,text) from public,anon;
grant execute on function public.revise_pending_species_create(uuid,jsonb,jsonb,text) to authenticated;
