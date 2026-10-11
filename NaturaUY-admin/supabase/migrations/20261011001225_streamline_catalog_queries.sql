-- Optimización de lecturas: mismos permisos y datos, una evaluación por consulta.
-- No se eliminan especies, revisiones, fuentes ni RPCs utilizadas.
set lock_timeout = '5s';

alter policy releases_editor_read on public.catalog_releases
  using ((select public.has_editor_access()));

alter policy catalog_sources_editor_read on public.catalog_sources
  using ((select public.has_editor_access()));

alter policy content_changes_editor_read on public.content_changes
  using ((select public.has_editor_access()));

alter policy editor_access_read on public.editor_access
  using (((user_id = (select auth.uid())) OR (select public.has_admin_access())));

alter policy enrichment_candidates_editor_read on public.enrichment_candidates
  using ((select public.has_editor_access()));

alter policy enrichment_runs_editor_read on public.enrichment_runs
  using ((select public.has_editor_access()));

alter policy favorites_own on public.favorites
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

alter policy feedback_read on public.feedback
  using (((user_id = (select auth.uid())) OR (select public.has_editor_access())));

alter policy game_stats_own on public.game_stats
  using ((user_id = (select auth.uid())));

alter policy mobile_puzzle_records_owner on public.mobile_puzzle_records to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

alter policy plant_profiles_editor_read on public.plant_profiles
  using ((select public.has_editor_access()));

alter policy profiles_read on public.profiles
  using (((user_id = (select auth.uid())) OR (select public.has_editor_access())));

alter policy species_public_read on public.species
  using (((status = 'active'::text) OR (select public.has_editor_access())));

alter policy changes_editor_read on public.species_changes
  using ((select public.has_editor_access()));

alter policy species_conservation_editor_read on public.species_conservation_assessments
  using ((select public.has_editor_access()));

alter policy facts_editor_read on public.species_facts
  using ((select public.has_editor_access()));

alter policy game_profiles_editor_read on public.species_game_profiles
  using ((select public.has_editor_access()));

alter policy game_rules_editor_read on public.species_game_rules
  using ((select public.has_editor_access()));

alter policy media_read on public.species_media
  using (((status = 'approved'::text) OR (select public.has_editor_access())));

alter policy observability_editor_read on public.species_observability_snapshots
  using ((select public.has_editor_access()));

alter policy species_taxa_editor_read on public.species_taxa
  using ((select public.has_editor_access()));

alter policy taxa_editor_read on public.taxa
  using ((select public.has_editor_access()));

alter policy taxon_closure_editor_read on public.taxon_closure
  using ((select public.has_editor_access()));

alter policy taxon_content_editor_read on public.taxon_content
  using ((select public.has_editor_access()));

alter policy taxon_names_editor_read on public.taxon_names
  using ((select public.has_editor_access()));

alter policy trivia_options_editor_read on public.trivia_options
  using ((select public.has_editor_access()));

alter policy trivia_editor_read on public.trivia_questions
  using ((select public.has_editor_access()));

drop policy collaborator_applications_admin_read on public.collaborator_applications;
drop policy collaborator_applications_owner_read on public.collaborator_applications;
create policy collaborator_applications_read on public.collaborator_applications
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_admin_access()));

alter policy home_news_public_read on public.home_news to anon;
alter policy home_news_admin_read on public.home_news
  using (status = 'published' or (select public.has_admin_access()));

-- Consultas por especie del editor y sus revisiones.
create index if not exists species_media_species_idx on public.species_media(species_id);
create index if not exists species_changes_species_idx on public.species_changes(species_id);
create index if not exists content_changes_species_idx on public.content_changes(species_id);
create index if not exists enrichment_candidates_species_idx on public.enrichment_candidates(species_id);
reset lock_timeout;
