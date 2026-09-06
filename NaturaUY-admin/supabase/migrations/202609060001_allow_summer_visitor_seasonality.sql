-- The legacy catalog uses this value for species that visit Uruguay in summer.
alter table public.species drop constraint if exists species_seasonality_check;
alter table public.species add constraint species_seasonality_check
  check (seasonality in ('resident','migratory','occasional','summer_visitor','unknown'));
