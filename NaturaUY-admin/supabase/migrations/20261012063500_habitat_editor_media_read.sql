-- Private authorization evidence and archived media are only visible to administrators.
create function public.get_editor_habitat_media(p_habitat_id uuid default null,p_media_id uuid default null)
returns setof public.habitat_media language plpgsql stable security definer set search_path='' as $$
begin
 perform public.require_admin();
 if p_habitat_id is null and p_media_id is null then raise exception 'habitat_media_scope_required'; end if;
 return query select m.* from public.habitat_media m
 where (p_habitat_id is null or m.habitat_id=p_habitat_id) and (p_media_id is null or m.id=p_media_id)
 order by m.id;
end $$;
revoke all on function public.get_editor_habitat_media(uuid,uuid) from public,anon;
grant execute on function public.get_editor_habitat_media(uuid,uuid) to authenticated;
