import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { adminClient, required } from './shared';

export type DatabaseRow = Record<string, any>;

export interface CatalogRecord {
  species: DatabaseRow;
  image: DatabaseRow | null;
  audio: DatabaseRow | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  audioUrl: string | null;
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
  const [speciesRows, mediaRows] = await Promise.all([fetchAll('species'), fetchAll('species_media')]);
  const approved = mediaRows.filter((row) => row.status === 'approved' && row.storage_path);

  return speciesRows
    .filter((row) => row.status === 'active')
    .map((species) => {
      const assets = approved.filter((asset) => asset.species_id === species.id).sort((a, b) => Number(a.ordinal) - Number(b.ordinal));
      const image = assets.find((asset) => asset.id === species.primary_image_id && asset.type === 'image')
        ?? assets.find((asset) => asset.type === 'image')
        ?? null;
      const audio = assets.find((asset) => asset.type === 'audio') ?? null;
      return {
        species,
        image,
        audio,
        imageUrl: publicMediaUrl(image?.thumbnail_path ?? image?.storage_path),
        thumbnailUrl: publicMediaUrl(image?.thumbnail_path),
        audioUrl: publicMediaUrl(audio?.storage_path),
      };
    })
    .sort((a, b) => String(a.species.catalog_code).localeCompare(String(b.species.catalog_code), 'es'));
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
    sources: (species.source_references ?? []).map((reference: string) => ({ source: reference, record: null })),
    media: {
      image: record.image ? {
        url: record.imageUrl,
        fullUrl: publicMediaUrl(record.image.storage_path),
        license: record.image.license,
        attribution: record.image.author,
        source: record.image.source,
        sourcePage: record.image.source_url,
      } : null,
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
