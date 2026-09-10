-- CREATE OR REPLACE conserva normalmente ACLs, pero un proyecto que todavía
-- tuviera el privilegio por defecto de PostgreSQL volvería a exponer la RPC.
revoke execute on function public.request_catalog_publish() from public,anon;
grant execute on function public.request_catalog_publish() to authenticated;

create index if not exists taxon_content_source_idx on public.taxon_content(source_id);
create index if not exists taxon_content_created_by_idx on public.taxon_content(created_by) where created_by is not null;
create index if not exists taxon_content_reviewed_by_idx on public.taxon_content(reviewed_by) where reviewed_by is not null;
create index if not exists trivia_questions_image_media_idx on public.trivia_questions(image_media_id) where image_media_id is not null;
