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

export async function loadApprovedCatalog(): Promise<CatalogRecord[]> {
  const [speciesRows, mediaRows, abundanceRows, observabilityRows, gameProfiles, gameRules, facts] = await Promise.all([
    fetchAll('species'), fetchAll('species_media'), fetchAll('species_abundance_assessments'),
    fetchAll('species_observability_snapshots'), fetchAll('species_game_profiles'),
    fetchAll('species_game_rules'), fetchAll('species_facts'),
  ]);
  const approved = mediaRows.filter((row) => row.status === 'approved' && row.storage_path);

  return speciesRows
    .filter((row) => row.status === 'active')
    .map((species) => {
      const assets = approved.filter((asset) => asset.species_id === species.id).sort((a, b) => Number(a.ordinal) - Number(b.ordinal));
      const image = assets.find((asset) => asset.id === species.primary_image_id && asset.type === 'image')
        ?? assets.find((asset) => asset.type === 'image')
        ?? null;
      const audio = assets.find((asset) => asset.type === 'audio') ?? null;
      const images = assets.filter((asset) => asset.type === 'image').slice(0, 2);
      const abundance = abundanceRows.find((row) => row.species_id === species.id && row.is_current) ?? null;
      const observability = observabilityRows.filter((row) => row.species_id === species.id)
        .sort((a, b) => String(b.generated_at).localeCompare(String(a.generated_at)))[0] ?? null;
      return {
        species,
        image, images,
        audio,
        imageUrl: publicMediaUrl(image?.thumbnail_path ?? image?.storage_path),
        thumbnailUrl: publicMediaUrl(image?.thumbnail_path),
        audioUrl: publicMediaUrl(audio?.storage_path),
        abundance,
        observability,
        gameProfile: gameProfiles.find((row) => row.species_id === species.id) ?? null,
        gameRules: gameRules.filter((row) => row.species_id === species.id),
        facts: facts.filter((row) => row.species_id === species.id && row.active)
          .sort((a, b) => Number(a.sort_order) - Number(b.sort_order)),
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
    facts: record.facts.map((fact) => ({ id: fact.id, body: fact.body, sortOrder: fact.sort_order })),
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
    relevantNote: species.relevant_note,
    sources: Object.entries(species.field_sources ?? {}).flatMap(([field, references]) => (references as string[]).map((reference) => ({ source: reference, record: field }))),
    media: {
      image: record.image ? {
        url: record.imageUrl,
        fullUrl: publicMediaUrl(record.image.storage_path),
        license: record.image.license,
        attribution: record.image.author,
        source: record.image.source,
        sourcePage: record.image.source_url,
      } : null,
      images: record.images.map((image) => ({
        url: publicMediaUrl(image.thumbnail_path ?? image.storage_path), fullUrl: publicMediaUrl(image.storage_path), license: image.license,
        attribution: image.author, source: image.source, sourcePage: image.source_url,
      })),
      audio: record.audioUrl,
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
