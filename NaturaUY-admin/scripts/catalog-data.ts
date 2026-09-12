import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { adminClient, required } from './shared';

export type DatabaseRow = Record<string, any>;

export interface CatalogRecord {
  species: DatabaseRow;
  image: DatabaseRow | null;
  audio: DatabaseRow | null;
  images: DatabaseRow[];
  imageUrl: string | null;
  thumbnailUrl: string | null;
  audioUrl: string | null;
  abundance: DatabaseRow | null;
  observability: DatabaseRow | null;
  gameProfile: DatabaseRow | null;
  gameRules: DatabaseRow[];
  facts: DatabaseRow[];
  catalogSources: DatabaseRow[];
}

const CLASS_FILES = ['aves', 'mammalia', 'reptilia', 'amphibia', 'actinopterygii', 'chondrichthyes'] as const;

async function fetchAll(table: string, select = '*'): Promise<DatabaseRow[]> {
  const client = adminClient();
  const result: DatabaseRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select(select).range(from, from + 999);
    if (error) throw error;
    result.push(...(data as DatabaseRow[]));
    if (!data || data.length < 1000) return result;
  }
}

function publicMediaUrl(path: string | null | undefined) {
  return path ? `${required('SUPABASE_URL').replace(/\/$/, '')}/storage/v1/object/public/media-public/${path}` : null;
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
  const [speciesRows, mediaRows, abundanceRows, observabilityRows, gameProfiles, gameRules, facts, catalogSources] = await Promise.all([
    fetchAll('species'), fetchAll('species_media'), fetchAll('species_abundance_assessments'),
    fetchAll('species_observability_snapshots'), fetchAll('species_game_profiles'),
    fetchAll('species_game_rules'), fetchAll('species_facts'), fetchAll('catalog_sources'),
  ]);
  const approved = mediaRows.filter((row) => row.status === 'approved' && row.storage_path);

  return speciesRows
    .filter((row) => row.status === 'active')
    .map((species) => {

      const assets = approved
  .filter((asset) => asset.species_id === species.id)
  .sort((a, b) => Number(a.ordinal) - Number(b.ordinal));

const approvedImage =
  assets.find(
    (asset) =>
      asset.id === species.primary_image_id
      && asset.type === 'image',
  )
  ?? assets.find((asset) => asset.type === 'image')
  ?? null;

const image = approvedImage;

const audio =
  assets.find((asset) => asset.type === 'audio')
  ?? null;

// Las imágenes procesadas siguen entrando en species_media.
const images = assets
  .filter((asset) => asset.type === 'image')
  .slice(0, 2);
      
      const abundance = abundanceRows.find((row) => row.species_id === species.id && row.is_current) ?? null;
      const observability = observabilityRows.filter((row) => row.species_id === species.id)
        .sort((a, b) => String(b.generated_at).localeCompare(String(a.generated_at)))[0] ?? null;
      return {
        species,
        image, images,
        audio,
        imageUrl: resolveImageUrl(image),
        thumbnailUrl: resolveImageUrl(image),
        audioUrl: publicMediaUrl(audio?.storage_path),
        abundance,
        observability,
        gameProfile: gameProfiles.find((row) => row.species_id === species.id) ?? null,
        gameRules: gameRules.filter((row) => row.species_id === species.id),
        facts: facts.filter((row) => row.species_id === species.id && row.active)
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

export function serializeCatalogRecord(record: CatalogRecord) {
  const species = record.species;
  const commonNames = [species.common_name, ...(species.alternate_common_names ?? [])];
  const sourcesByCode = new Map(record.catalogSources.map((source) => [String(source.code), source]));
  const sourcesById = new Map(record.catalogSources.map((source) => [String(source.id), source]));
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
      url: source?.url ?? null,
      citation: source?.citation ?? null,
      license: source?.license ?? null,
    };
  };
  const fieldReferences = Object.entries(species.field_sources ?? {}).flatMap(([field, references]) =>
    (references as string[]).map((value) => reference(field, value)));
  const traitReferences = ((species.traits?.sources ?? []) as string[]).map((value) => reference('traits', value));
  const factReferences = record.facts.flatMap((fact) => {
    const source = sourcesById.get(String(fact.source_id));
    const code = source?.code;
    return code ? [reference('relevant_note', `${code}${fact.source_record_id ? `: ${fact.source_record_id}` : ''}`)] : [];
  });
  return {
    id: species.id,
    catalogCode: species.catalog_code,
    scientificName: species.scientific_name,
    acceptedName: species.accepted_name,
    commonName: species.common_name,
    commonNames,
    taxonomy: {
      kingdom: species.kingdom,
      phylum: species.phylum,
      class: species.class,
      order: species.order_name,
      family: species.family,
      genus: species.genus,
    },
    origin: species.origin,
    establishment: species.establishment,
    seasonality: species.seasonality,
    presenceCertainty: species.presence_certainty,
    abundanceStatus: species.abundance_status,
    abundance: record.abundance ? {
      category: record.abundance.category, label: record.abundance.label,
      geographicScope: record.abundance.geographic_scope, seasonScope: record.abundance.season_scope,
      methodology: record.abundance.methodology, assessedAt: record.abundance.assessed_at,
    } : null,
    observability: record.observability ? {
      methodVersion: record.observability.method_version,
      periodStart: record.observability.period_start, periodEnd: record.observability.period_end,
      occurrenceCount: record.observability.occurrence_count, occupiedCells: record.observability.occupied_cells,
      yearsObserved: record.observability.years_observed, score: record.observability.score,
      band: record.observability.band, comparisonClass: record.observability.comparison_class,
    } : null,
    game: {
      knowledgeLevel: record.gameProfile?.knowledge_level ?? 'hard',
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
      system: species.conservation_system,
      category: species.conservation_category,
      label: species.conservation_label,
      source: species.conservation_source,
      rank: species.conservation_rank,
      assessedAt: species.conservation_assessed_at,
    },
    description: species.description,
    habitat: species.habitat ?? [],
    diet: species.diet ?? [],
    size: species.size,
    traits: species.traits ?? { measurements: [], lifeModes: [], activity: [], aquaticEnvironments: [], waterZones: [], depthMinM: null, depthMaxM: null, sources: [] },
    relevantNote: species.relevant_note,
    sources: [...fieldReferences, ...traitReferences, ...factReferences].filter((item, index, all) =>
      all.findIndex((candidate) => `${candidate.fieldPath}|${candidate.sourceCode}|${candidate.record}` === `${item.fieldPath}|${item.sourceCode}|${item.record}`) === index),
    media: {
      image: record.image ? {
        url: record.imageUrl,
        fullUrl: resolveImageUrl(record.image, false),
        license: record.image.license,
        attribution: record.image.author,
        source: record.image.source,
        sourcePage: record.image.source_url,
        licenseUrl: record.image.license_url,
        externalId: record.image.external_id,
        sourceTaxonId: record.image.source_taxon_id,
        width: record.image.source_width,
        height: record.image.source_height,
        selectionScore: record.image.selection_score,
        selectionDetails: record.image.selection_details,
        retrievedAt: record.image.retrieved_at,
      } : null,
      images: record.images.map((image) => ({
        url: publicMediaUrl(image.thumbnail_path ?? image.storage_path), fullUrl: publicMediaUrl(image.storage_path), license: image.license,
        attribution: image.author, source: image.source, sourcePage: image.source_url,
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
    const subset = serialized.filter((item) => item.taxonomy.class?.toLocaleLowerCase() === className);
    writeFileSync(resolve(output, `${className}.json`), `${JSON.stringify(subset, null, 2)}\n`);
  }
  return serialized;
}
