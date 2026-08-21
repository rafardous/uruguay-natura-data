/**
 * Stage 01 — turn the raw SNAP export into canonical records.
 *
 * The source has quirks the rest of the pipeline should never have to think
 * about: blank common names, stray whitespace, and `imagen_url`/`audio_url`
 * columns that are empty for all 2021 rows.
 */
import { resolve } from 'node:path';

import { classifyConservation, KNOWN_CONSERVATION_STATUSES } from './lib/conservation';
import { readJson, writeJson } from './lib/cache';
import { ensureDirs, PATHS } from './lib/paths';
import type { NormalizedSpecies, RawSpecies } from './lib/types';

const clean = (value: string): string => value.replace(/\s+/g, ' ').trim();

/** Capitalises the first letter only — SNAP mixes "Tero" and "tero real". */
const sentenceCase = (value: string): string =>
  value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);

function normalize(raw: RawSpecies): NormalizedSpecies {
  const genero = clean(raw.genero);
  const epiteto = clean(raw.epiteto_especifico);
  const scientificName = clean(`${genero} ${epiteto}`);

  const commonNames = raw.nombres_comunes.map(clean).filter((n) => n.length > 0).map(sentenceCase);

  const conservation = classifyConservation(raw.estado_conservacion);

  return {
    codigo: clean(raw.codigo),
    scientificName,
    // ~40 records carry no vernacular name at all (e.g. Butia lallemantii);
    // falling back to the scientific name keeps every card labelled.
    commonName: commonNames[0] ?? scientificName,
    commonNames,
    clase: clean(raw.clase),
    orden: clean(raw.orden),
    familia: clean(raw.familia),
    genero,
    epiteto,
    estadoConservacion: clean(raw.estado_conservacion),
    conservationLabel: conservation.label,
    conservationRank: conservation.rank,
    nativa: raw.nativa,
    descripcion: clean(raw.descripcion),
    alimentacion: clean(raw.alimentacion),
    tamano: clean(raw.tamano),
    audioUrl: clean(raw.audio_url) || null,
  };
}

function main(): void {
  ensureDirs();

  const raws = readJson<RawSpecies[]>(PATHS.source);
  const seen = new Set<string>();
  const species: NormalizedSpecies[] = [];

  for (const raw of raws) {
    const record = normalize(raw);

    if (record.scientificName.length === 0) {
      console.warn(`  skipped ${record.codigo}: no genus/epithet`);
      continue;
    }
    if (seen.has(record.codigo)) {
      console.warn(`  skipped duplicate código ${record.codigo}`);
      continue;
    }

    seen.add(record.codigo);
    species.push(record);
  }

  // Surface any status string the mapping does not know about, rather than
  // silently bucketing it as "No evaluada".
  const unknown = new Set(
    raws
      .map((r) => r.estado_conservacion.trim())
      .filter((s) => !KNOWN_CONSERVATION_STATUSES.includes(s)),
  );
  if (unknown.size > 0) {
    console.warn(`  unknown conservation statuses: ${[...unknown].join(', ')}`);
  }

  writeJson(resolve(PATHS.out, 'species.json'), species);

  const withoutCommonName = species.filter((s) => s.commonNames.length === 0).length;
  console.log(`01-normalize: ${species.length} species from ${raws.length} rows`);
  console.log(`  ${withoutCommonName} fall back to the scientific name`);
  console.log(`  ${new Set(species.map((s) => s.clase)).size} classes, ${new Set(species.map((s) => s.familia)).size} families`);
}

main();
