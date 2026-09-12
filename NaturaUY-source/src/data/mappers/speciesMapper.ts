import type { Species } from '../../domain/entities/species';
import type { SpeciesMediaRow, SpeciesRow } from '../db/schema';

/** JSON-encoded arrays in SQLite are worth decoding defensively. */
function parseStringArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === 'string') : [];
  } catch {
    return [];
  }
}

function parseSources(raw: string): Species['sources'] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((candidate) => {
      if (typeof candidate !== 'object' || candidate === null) return [];
      const source = candidate as Record<string, unknown>;
      if (typeof source.source !== 'string') return [];
      const reference: Species['sources'][number] = {
        source: source.source,
        record: typeof source.record === 'string' ? source.record : null,
      };
      if (typeof source.fieldPath === 'string') reference.fieldPath = source.fieldPath;
      if (typeof source.sourceCode === 'string') reference.sourceCode = source.sourceCode;
      if (typeof source.name === 'string') reference.name = source.name;
      if (typeof source.url === 'string') reference.url = source.url;
      if (typeof source.citation === 'string') reference.citation = source.citation;
      if (typeof source.license === 'string') reference.license = source.license;
      return [reference];
    });
  } catch {
    return [];
  }
}

const EMPTY_TRAITS: Species['traits'] = {
  measurements: [], lifeModes: [], activity: [], aquaticEnvironments: [], waterZones: [],
  depthMinM: null, depthMaxM: null, sources: [],
};

function parseTraits(raw: string | undefined): Species['traits'] {
  if (!raw) return EMPTY_TRAITS;
  try {
    const parsed = JSON.parse(raw) as Partial<Species['traits']>;
    const stringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
    const measurementKinds = new Set(['body_length', 'body_mass', 'wing_length', 'tail_length', 'tarsus_length', 'max_length']);
    const measurementBases = new Set(['TL', 'SL', 'FL', 'SVL', 'body_length']);
    const measurements = Array.isArray(parsed.measurements) ? parsed.measurements.filter((item): item is Species['traits']['measurements'][number] =>
      typeof item === 'object' && item !== null &&
      measurementKinds.has(String((item as { kind?: unknown }).kind)) &&
      typeof (item as { value?: unknown }).value === 'number' && Number.isFinite((item as { value: number }).value) && (item as { value: number }).value > 0 &&
      ['mm', 'g'].includes(String((item as { unit?: unknown }).unit)) &&
      ((item as { basis?: unknown }).basis === null || measurementBases.has(String((item as { basis?: unknown }).basis))) &&
      typeof (item as { estimated?: unknown }).estimated === 'boolean') : [];
    return {
      measurements,
      lifeModes: stringArray(parsed.lifeModes) as Species['traits']['lifeModes'],
      activity: stringArray(parsed.activity) as Species['traits']['activity'],
      aquaticEnvironments: stringArray(parsed.aquaticEnvironments) as Species['traits']['aquaticEnvironments'],
      waterZones: stringArray(parsed.waterZones) as Species['traits']['waterZones'],
      depthMinM: typeof parsed.depthMinM === 'number' ? parsed.depthMinM : null,
      depthMaxM: typeof parsed.depthMaxM === 'number' ? parsed.depthMaxM : null,
      sources: stringArray(parsed.sources),
    };
  } catch {
    return EMPTY_TRAITS;
  }
}

/**
 * The single place SQL rows become domain entities. Screens never see a row,
 * so a schema change stops here instead of rippling through the UI.
 */
export function rowToSpecies(row: SpeciesRow, mediaRows: SpeciesMediaRow[] = []): Species {
  return {
    codigo: row.codigo,
    displayName: row.common_name,
    scientificName: row.scientific_name,
    acceptedName: row.accepted_name,
    commonNames: parseStringArray(row.common_names),
    taxonomy: {
      kingdom: row.kingdom,
      phylum: row.phylum,
      clase: row.clase,
      orden: row.orden,
      familia: row.familia,
      genero: row.genero,
      epiteto: row.epiteto,
    },
    conservation: {
      raw: row.estado_conservacion,
      label: row.conservation_label,
      rank: row.conservation_rank,
    },
    nativa: row.nativa === 1,
    origin: row.origin,
    seasonality: row.seasonality,
    abundanceStatus: row.abundance_status,
    abundance: { category: row.abundance_category ?? null, label: row.abundance_label ?? row.abundance_status },
    observability: null,
    knowledgeLevel: row.knowledge_level ?? 'hard',
    gameRules: [],
    facts: [],
    habitat: parseStringArray(row.habitat),
    diet: parseStringArray(row.diet),
    relevantNote: row.relevant_note,
    sources: parseSources(row.sources),
    descripcion: row.descripcion,
    alimentacion: row.alimentacion,
    tamano: row.tamano,
    traits: parseTraits(row.traits),
    photo: row.image_url
      ? {
          url: row.image_url,
          fullUrl: row.full_url ?? row.image_url,
          thumbAsset: row.thumb_asset,
          license: row.image_license ?? '',
          attribution: row.image_attribution ?? '',
          source: row.image_source ?? '',
          page: row.image_page,
        }
      : null,
    audioUrl: row.audio_url,
    media: mediaRows.map((media) => ({ id: media.id, type: media.media_type, ordinal: media.ordinal, isPrimary: media.is_primary === 1,
      url: media.url, thumbnailUrl: media.thumbnail_url, attribution: media.author, license: media.license, originalLicense: media.original_license ?? null, source: media.source, page: media.source_url, durationSeconds: media.duration_seconds ?? null })),
    palette: {
      accentLight: row.accent_light,
      accentDark: row.accent_dark,
      containerLight: row.container_light,
      onContainerLight: row.on_container_light,
      containerDark: row.container_dark,
      onContainerDark: row.on_container_dark,
    },
  };
}
