-- Mixed guessing games retain their own records; historical category records
-- remain valid and are never rewritten or merged into the new selection.
alter table public.mobile_enriched_game_records
  drop constraint mobile_enriched_game_records_scope_check;
alter table public.mobile_enriched_game_records
  add constraint mobile_enriched_game_records_scope_check check (
    scope ~ '^(animals_all|birds|mammals|reptiles|amphibians|fish|arthropods|arachnids|insects|crustaceans|plants):(easy|medium|hard)(:[34])?$'
    or (mode in ('guess_search', 'guess_choices') and scope ~ '^all:(easy|medium|hard)$')
  );
