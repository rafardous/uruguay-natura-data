import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { adminClient } from './shared';
import type { PhotoPalette } from './photo-palettes';
import { selectPublishedTaxonomy } from './catalog-taxonomy';

export type DatabaseRow = Record<string, any>;

export interface CatalogRecord {
  photoPalette?: PhotoPalette;
  species: DatabaseRow;
  image: DatabaseRow | null;
  audio: DatabaseRow | null;
  images: DatabaseRow[];
  imageUrl: string | null;
  thumbnailUrl: string | null;
  audioUrl: string | null;
  conservationAssessments: DatabaseRow[];
  observability: DatabaseRow | null;
  gameProfile: DatabaseRow | null;
  gameRules: DatabaseRow[];
  facts: DatabaseRow[];
  gameClues?: DatabaseRow[];
  catalogSources: DatabaseRow[];
}

const CLASS_FILES = ['aves', 'mammalia', 'reptilia', 'amphibia', 'actinopterygii', 'chondrichthyes', 'arachnida', 'insecta', 'malacostraca', 'plantae'] as const;

/** La selección publicada no archiva ni modifica el catálogo editorial. */
export function selectPublishedSpecies(rows: DatabaseRow[], plantNames: Set<string>): DatabaseRow[] {
  if (plantNames.size !== 100) throw new Error('La selección versionada debe contener 100 plantas');
  const active = rows.filter((row) => row.status === 'active');
  const selected = active.filter((row) => row.kingdom !== 'Plantae' || plantNames.has(String(row.scientific_name)));
  const plants = selected.filter((row) => row.kingdom === 'Plantae');
  if (plants.length !== 100 || new Set(plants.map((row) => row.scientific_name)).size !== 100) {
    throw new Error(`Selección vegetal incompleta o duplicada: ${plants.length}/100`);
  }
  return selected;
}

function groupBy(rows: DatabaseRow[], key: string): Map<string, DatabaseRow[]> {
  const groups = new Map<string, DatabaseRow[]>();
  for (const row of rows) {
    const id = String(row[key]);
    const group = groups.get(id);
    if (group) group.push(row);
    else groups.set(id, [row]);
  }
  return groups;
}

async function fetchAll(table: string, select = '*', filter?: [string, string | boolean]): Promise<DatabaseRow[]> {
  const client = adminClient();
  const result: DatabaseRow[] = [];
  for (let from = 0; ; from += 1000) {
    let query = client.from(table).select(select).order(['taxa','taxon_names'].includes(table) ? 'taxon_id' : ['species_taxa', 'species_game_profiles'].includes(table) ? 'species_id' : 'id');
    if(table==='taxon_names')query=query.order('name').order('language').order('name_type');
    if (table === 'species_taxa') query = query.order('taxon_id');
    if (table === 'learning_paths') query = query.order('version');
    if (filter) query = query.eq(filter[0], filter[1]);
    const { data, error } = await query.range(from, from + 999);
    if (error) throw error;
    result.push(...(data as DatabaseRow[]));
    if (!data || data.length < 1000) return result;
  }
}

export async function loadPublishedTaxonomy(items: CatalogRecord[]) {
  const [nodes, links, names] = await Promise.all([fetchAll('taxa'), fetchAll('species_taxa'), fetchAll('taxon_names')]);
  return selectPublishedTaxonomy(new Set(items.map((item) => String(item.species.id))), nodes, links, names);
}

export function publicMediaUrl(path: string | null | undefined) {
  if (path?.startsWith('guia-aves/')) {
    const projectUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim()
      || 'https://xbnbfekcxrkgteuijbzh.supabase.co';
    return `${projectUrl.replace(/\/$/, '')}/storage/v1/object/public/guia-aves/${path.slice('guia-aves/'.length).split('/').map(encodeURIComponent).join('/')}`;
  }
  const configuredOrigin = process.env.PUBLIC_MEDIA_ORIGIN?.trim();
  const origin = configuredOrigin
    ? configuredOrigin.replace(/\/$/, '')
    : 'https://uruguay-natura-data.pages.dev/m';
  return path ? `${origin}/${path.split('/').map(encodeURIComponent).join('/')}` : null;
}

export function approvedImagesForSpecies(species: DatabaseRow, mediaRows: DatabaseRow[]) {
  const images = mediaRows
    .filter((row) => row.species_id === species.id && row.type === 'image' && row.status === 'approved' && row.storage_path)
    .sort((a, b) => Number(a.ordinal) - Number(b.ordinal));
  if (images.length > 3) throw new Error(`Más de tres fotos aprobadas para ${species.catalog_code ?? species.id}`);
  const primary = images.find((row) => row.is_primary) ?? images.find((row) => row.id === species.primary_image_id) ?? images[0] ?? null;
  return { images, primary };
}

function resolveImageUrl(
  image: DatabaseRow | null | undefined,
  preferThumbnail = true,
): string | null {
  if (!image) return null;

  const storagePath = preferThumbnail
    ? image.thumbnail_path ?? image.storage_path
    : image.storage_path;

  return publicMediaUrl(storagePath)
    ?? (
      typeof image.source_url === 'string' && image.source_url.length > 0
        ? image.source_url
        : null
    );
}

export async function loadApprovedCatalog(): Promise<CatalogRecord[]> {
  const [speciesRows, mediaRows, conservationRows, observabilityRows, gameProfiles, gameRules, facts, catalogSources, gameClues] = await Promise.all([
    fetchAll('species', '*', ['status', 'active']), fetchAll('species_media', '*', ['status', 'approved']), fetchAll('species_conservation_assessments', '*', ['is_current', true]),
    fetchAll('species_observability_snapshots'), fetchAll('species_game_profiles'),
    fetchAll('species_game_rules'), fetchAll('species_facts', '*', ['active', true]), fetchAll('catalog_sources'), fetchAll('species_game_clues', '*', ['active', true]),
  ]);
  const approved = mediaRows.filter((row) => row.status === 'approved' && row.storage_path);
  const mediaBySpecies = groupBy(approved, 'species_id');
  const conservationBySpecies = groupBy(conservationRows, 'species_id');
  const observabilityBySpecies = groupBy(observabilityRows, 'species_id');
  const profilesBySpecies = groupBy(gameProfiles, 'species_id');
  const rulesBySpecies = groupBy(gameRules, 'species_id');
  const cluesBySpecies = groupBy(gameClues.filter(clue=>catalogSources.some(source=>source.id===clue.source_id&&source.active&&source.use_policy==='redistributable')), 'species_id');
  const factsBySpecies = groupBy(facts, 'species_id');

  const seed = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../NaturaUY-source/data/raw/curated-plants/seed-100.json'), 'utf8'));
  const plantNames = new Set<string>([...seed.arboles, ...seed.otras_plantas_nativas].map((row) => row.nombre_cientifico));
  return selectPublishedSpecies(speciesRows, plantNames)
    .map((species) => {

      const assets = (mediaBySpecies.get(species.id) ?? [])
        .sort((a, b) => Number(a.ordinal) - Number(b.ordinal));
      const { images, primary: image } = approvedImagesForSpecies(species, assets);

      const audio = assets.find((asset) => asset.type === 'audio') ?? null;
      const observability = (observabilityBySpecies.get(species.id) ?? [])
        .sort((a, b) => String(b.generated_at).localeCompare(String(a.generated_at)))[0] ?? null;
      return {
        species,
        image, images,
        audio,
        imageUrl: resolveImageUrl(image),
        thumbnailUrl: resolveImageUrl(image),
        audioUrl: publicMediaUrl(audio?.storage_path),
        conservationAssessments: (conservationBySpecies.get(species.id) ?? []).filter((row) => row.is_current),
        observability,
        gameProfile: profilesBySpecies.get(species.id)?.[0] ?? null,
        gameRules: rulesBySpecies.get(species.id) ?? [],
        gameClues: (cluesBySpecies.get(species.id) ?? []).sort((a,b)=>a.sort_order-b.sort_order),
        facts: (factsBySpecies.get(species.id) ?? []).filter((row) => row.active)
          .sort((a, b) => Number(a.sort_order) - Number(b.sort_order)),
        catalogSources,
      };
    })
    .sort((a, b) => String(a.species.catalog_code).localeCompare(String(b.species.catalog_code), 'es'));
}

export async function loadApprovedTrivia(): Promise<Array<DatabaseRow & { options: DatabaseRow[] }>> {
  const [questions, options, media] = await Promise.all([fetchAll('trivia_questions'), fetchAll('trivia_options'), fetchAll('species_media')]);
  return questions.filter((question) => question.active).map((question) => ({
    ...question,
    image: media.find((asset)=>asset.id===question.image_media_id&&asset.type==='image'&&asset.status==='approved')??null,
    options: options.filter((option) => option.question_id === question.id)
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order)),
  }));
}

export async function loadApprovedTaxonContent():Promise<DatabaseRow[]> {
  return (await fetchAll('taxon_content')).filter((item)=>item.active);
}

export async function loadApprovedLearningPaths(): Promise<DatabaseRow[]> {
  const approved = (await fetchAll('learning_paths')).filter((item) => item.status === 'approved' || (item.status === 'archived' && item.content?.archived === true));
  const latest = new Map<string, DatabaseRow>();
  for (const item of approved) {
    const current = latest.get(String(item.id));
    if (!current || Number(item.version) > Number(current.version)) latest.set(String(item.id), item);
  }
  return [...latest.values()];
}

export function serializeCatalogRecord(record: CatalogRecord) {
  const species = record.species;
  const commonNames = [species.common_name, ...(species.alternate_common_names ?? [])];
  const sourcesByCode = new Map(record.catalogSources.map((source) => [String(source.code), source]));
  const sourcesById = new Map(record.catalogSources.map((source) => [String(source.id), source]));
  const assessmentFor = (system: 'uy_red_list' | 'iucn_global') => {
    const assessment = record.conservationAssessments.find((item) => item.system === system);
    if (!assessment) return null;
    return {
      category: assessment.category,
      sourceCode: sourcesById.get(String(assessment.source_id))?.code ?? null,
      sourceRecordId: assessment.source_record_id ?? null,
      version: assessment.version_label ?? null,
      assessedAt: assessment.assessed_at ?? null,
    };
  };
  const reference = (fieldPath: string, value: string) => {
    const separator = value.indexOf(': ');
    const sourceCode = separator > 0 ? value.slice(0, separator) : value;
    const sourceRecordId = separator > 0 ? value.slice(separator + 2) : null;
    const source = sourcesByCode.get(sourceCode);
    return {
      source: sourceCode,
      record: sourceRecordId,
      fieldPath,
      sourceCode,
      name: source?.name ?? sourceCode,
      version: source?.version_label ?? null,
      url: source?.url ?? null,
      citation: source?.citation ?? null,
      license: source?.license ?? null,
    };
  };
  const naturalHistoryReference = (fieldPath: string, value: unknown) => {
    if (typeof value === 'string') return reference(fieldPath, value);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const raw = value as Record<string, any>;
    const code = typeof raw.sourceCode === 'string' ? raw.sourceCode : typeof raw.source === 'string' ? raw.source : null;
    if (!code) return null;
    const base = reference(fieldPath, raw.record ? `${code}: ${raw.record}` : code);
    return { ...base, ...raw, source: raw.source ?? code, sourceCode: raw.sourceCode ?? code, fieldPath: raw.fieldPath ?? fieldPath, record: raw.record ?? null };
  };
  const normalizeNaturalHistory = (value: unknown): Record<string, any> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const history = JSON.parse(JSON.stringify(value)) as Record<string, any>;
    const arthropod = history.arthropod;
    if (!arthropod || typeof arthropod !== 'object' || Array.isArray(arthropod)) return history;
    const sections: Array<[string, string]> = [
      ['morphology', 'naturalHistory.morphology'], ['identification', 'naturalHistory.identification'],
      ['lifeCycle', 'naturalHistory.lifeCycle'],
      ['humanRelevance', 'naturalHistory.humanRelevance'],
    ];
    for (const [section, fieldPath] of sections) {
      const target = arthropod[section];
      if (!target || typeof target !== 'object' || Array.isArray(target) || !Array.isArray(target.sources)) continue;
      target.sources = target.sources.flatMap((item: unknown) => {
        const normalized = naturalHistoryReference(fieldPath, item);
        return normalized ? [normalized] : [];
      });
    }
    if (Array.isArray(arthropod.sources)) {
      arthropod.sources = arthropod.sources.flatMap((item: unknown) => {
        const normalized = naturalHistoryReference('naturalHistory', item);
        return normalized ? [normalized] : [];
      });
    }
    return history;
  };
  const fieldReferences = Object.entries(species.field_sources ?? {}).flatMap(([field, references]) =>
    (references as string[]).map((value) => reference(field, value)));
  const measurementReferences = ((species.measurements ?? []) as Array<Record<string, any>>).flatMap((measurement) => measurement.sourceCode ? [reference(`measurements.${measurement.kind}`, measurement.sourceRecordId ? `${measurement.sourceCode}: ${measurement.sourceRecordId}` : measurement.sourceCode)] : []);
  const factReferences = record.facts.flatMap((fact) => {
    const source = sourcesById.get(String(fact.source_id));
    const code = source?.code;
    return code ? [reference('relevant_note', `${code}${fact.source_record_id ? `: ${fact.source_record_id}` : ''}`)] : [];
  });
  return {
    id: species.id,
    ...(record.photoPalette ? { palette: record.photoPalette.colors, photoPalette: { ...record.photoPalette, colors: undefined } } : {}),
    catalogCode: species.catalog_code,
    scientificName: species.scientific_name,
    acceptedName: species.accepted_name,
    commonName: species.common_name,
    commonNames,
    taxonomy: {
      kingdom: species.kingdom,
      phylum: species.phylum,
      ...(species.subphylum ? { subphylum: species.subphylum } : {}),
      class: species.class,
      order: species.order_name,
      family: species.family,
      genus: species.genus,
    },
    taxonIdentifiers: species.taxon_identifiers ?? {},
    origin: species.origin,
    seasonality: species.seasonality,
    abundanceStatus: species.abundance_status,
    observability: record.observability ? {
      methodVersion: record.observability.method_version,
      periodStart: record.observability.period_start, periodEnd: record.observability.period_end,
      occurrenceCount: record.observability.occurrence_count, occupiedCells: record.observability.occupied_cells,
      yearsObserved: record.observability.years_observed, score: record.observability.score,
      band: record.observability.band, comparisonClass: record.observability.comparison_class,
    } : null,
    game: {
      knowledgeLevel: record.gameProfile?.knowledge_level ?? 'hard',
      clues: (record.gameClues??[]).map(clue=>({id:clue.id,kind:clue.kind,body:clue.body,sortOrder:clue.sort_order,sourceCode:sourcesById.get(String(clue.source_id))?.code??null})),
      rules: record.gameRules.map((rule) => ({ gameKey: rule.game_key, enabled: rule.enabled, minKnowledgeLevel: rule.min_knowledge_level })),
    },
    facts: record.facts.map((fact) => ({
      id: fact.id,
      body: fact.body,
      sortOrder: fact.sort_order,
      sourceCode: sourcesById.get(String(fact.source_id))?.code ?? null,
      sourceRecordId: fact.source_record_id ?? null,
    })),
    conservation: {
      nationalRedList: assessmentFor('uy_red_list'),
      iucnGlobal: assessmentFor('iucn_global'),
      nationalDesignations: record.conservationAssessments.find((item) => item.system === 'uy_designations')?.designations ?? [],
    },
    description: species.description,
    measurements: species.measurements ?? [],
    ecology: species.ecology ?? {},
    naturalHistory: normalizeNaturalHistory(species.natural_history ?? null),
    relevantNote: species.relevant_note,
    sources: [...fieldReferences, ...measurementReferences, ...factReferences].filter((item, index, all) =>
      all.findIndex((candidate) => `${candidate.fieldPath}|${candidate.sourceCode}|${candidate.record}` === `${item.fieldPath}|${item.sourceCode}|${item.record}`) === index),
    media: {
      image: record.image ? {
        url: record.imageUrl,
        fullUrl: resolveImageUrl(record.image, false),
        license: record.image.license,
        attribution: record.image.author,
        source: record.image.source,
        sourcePage: record.image.source_url,
        originalLicense: record.image.original_license ?? null,
        licenseUrl: record.image.license_url,
        externalId: record.image.external_id ?? record.image.selection_details?.sourceExternalId ?? null,
        sourceTaxonId: record.image.source_taxon_id,
        sourceChecksum: (record.image.selection_details as Record<string, unknown> | null | undefined)?.sourceChecksum as string | null | undefined,
        width: record.image.source_width,
        height: record.image.source_height,
        selectionScore: record.image.selection_score,
        selectionDetails: record.image.selection_details,
        retrievedAt: record.image.retrieved_at,
      } : null,
      images: record.images.map((image) => ({
        id: image.id, ordinal: image.ordinal, isPrimary: Boolean(image.is_primary), licenseUrl: image.license_url,
        url: publicMediaUrl(image.thumbnail_path ?? image.storage_path), fullUrl: publicMediaUrl(image.storage_path), license: image.license,
        originalLicense: image.original_license ?? null, attribution: image.author, source: image.source, sourcePage: image.source_url,
        sourceChecksum: (image.selection_details as Record<string, unknown> | null | undefined)?.sourceChecksum as string | null | undefined,
      })),
      audio: record.audio ? {
        url: record.audioUrl,
        license: record.audio.license,
        attribution: record.audio.author,
        source: record.audio.source,
        sourcePage: record.audio.source_url,
        externalId: record.audio.external_id ?? null,
        originalLicense: record.audio.original_license ?? null,
        durationSeconds: Number(record.audio.clip_duration_seconds ?? record.audio.duration_seconds ?? 15),
      } : null,
    },
  };
}

export function writeCatalogJson(output: string, records: CatalogRecord[]) {
  mkdirSync(output, { recursive: true });
  const serialized = records.map(serializeCatalogRecord);
  writeFileSync(resolve(output, 'catalog-full.json'), `${JSON.stringify(serialized, null, 2)}\n`);
  for (const className of CLASS_FILES) {
    const subset = serialized.filter((item) => className === 'plantae'
      ? item.taxonomy.kingdom === 'Plantae'
      : item.taxonomy.class?.toLocaleLowerCase() === className);
    writeFileSync(resolve(output, `${className}.json`), `${JSON.stringify(subset, null, 2)}\n`);
  }
  return serialized;
}
