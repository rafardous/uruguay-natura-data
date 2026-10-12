-- El espejo histórico de schema 14 no debe reintroducir la medición sin
-- normalizar después de la revisión que ya aplicó «Sin fuente».
do $$ declare body text; previous text; begin
  previous:=pg_get_functiondef('private.apply_species_schema_14_change()'::regprocedure);
  body:=replace(previous, 'then new.proposed_values->''measurements'' else measurements end',
    'then private.optional_species_sources(new.proposed_values)->''measurements'' else measurements end');
  if body=previous then raise exception 'measurement_approval_guard_not_found';end if;
  execute body;
end $$;
