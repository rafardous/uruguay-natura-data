import type { Species } from '../../domain/entities/species';
import type { SpeciesMediaRow, SpeciesRow } from '../db/schema';

/** JSON-encoded arrays in SQLite are worth decoding defensively. */
function parseStringArray(raw: string | undefined): string[] {
  if (!raw) return [];
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
      if (typeof source.version === 'string') reference.version = source.version;
      if (typeof source.url === 'string') reference.url = source.url;
      if (typeof source.citation === 'string') reference.citation = source.citation;
      if (typeof source.license === 'string') reference.license = source.license;
      return [reference];
    });
  } catch {
    return [];
  }
}

function parseObject<T extends object>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as T : fallback;
  } catch { return fallback; }
}

const EMPTY_ECOLOGY: Species['ecology'] = {
  habitats: [], diet: [], lifeModes: [], activity: [], aquaticEnvironments: [], waterZones: [],
  depthMinM: null, depthMaxM: null, microhabitats: [], trophicRoles: [], hosts: [],
  plantAssociations: [], vegetationFormations: [],
};

function parseMeasurements(raw: string | undefined, legacyTraits?: string): Species['measurements'] {
  const candidateRaw = raw ?? legacyTraits;
  if (!candidateRaw) return [];
  try {
    const decoded = JSON.parse(candidateRaw) as unknown;
    const legacySource = !Array.isArray(decoded) && Array.isArray((decoded as { sources?: unknown[] }).sources) && typeof (decoded as { sources: unknown[] }).sources[0] === 'string' ? String((decoded as { sources: unknown[] }).sources[0]) : 'legacy_catalog';
    const parsed = Array.isArray(decoded) ? decoded : (decoded as { measurements?: unknown[] }).measurements;
    const measurementKinds = new Set(['body_length', 'body_mass', 'wing_length', 'tail_length', 'tarsus_length', 'max_length']);
    const measurementBases = new Set(['TL', 'SL', 'FL', 'SVL', 'body_length']);
    return Array.isArray(parsed) ? parsed.flatMap((item): Species['measurements'] => {
      const valid =
      typeof item === 'object' && item !== null &&
      measurementKinds.has(String((item as { kind?: unknown }).kind)) &&
      typeof (item as { value?: unknown }).value === 'number' && Number.isFinite((item as { value: number }).value) && (item as { value: number }).value > 0 &&
      ['mm', 'g'].includes(String((item as { unit?: unknown }).unit)) &&
      ((item as { basis?: unknown }).basis === null || measurementBases.has(String((item as { basis?: unknown }).basis))) &&
      typeof (item as { estimated?: unknown }).estimated === 'boolean';
      if (!valid) return [];
      const old = item as Record<string, unknown>;
      const sourceCode = typeof old.sourceCode === 'string' ? old.sourceCode : legacySource;
      return [{ ...(old as unknown as Species['measurements'][number]), sourceCode, sourceRecordId: typeof old.sourceRecordId === 'string' ? old.sourceRecordId : null, provenance: old.provenance === 'verified' || sourceCode !== 'legacy_catalog' ? 'verified' : 'legacy_unverified' }];
    }) : [];
  } catch {
    return [];
  }
}

function parseLegacySize(raw: string | undefined, taxonomicClass: string): Species['measurements'] {
  if (!raw) return [];
  const result: Species['measurements'] = [];
  const body = raw.match(/(?:largo corporal:\s*)?([0-9]+(?:[.,][0-9]+)?)\s*(mm|cm|m)\b/i);
  if (body) {
    const value = Number(body[1]!.replace(',','.')) * (body[2]!.toLowerCase()==='m' ? 1000 : body[2]!.toLowerCase()==='cm' ? 10 : 1);
    result.push({ kind:taxonomicClass==='Aves'||/largo corporal/i.test(raw)?'body_length':'max_length',value,unit:'mm',basis:taxonomicClass==='Aves'||/largo corporal/i.test(raw)?'body_length':null,estimated:true,sourceCode:'legacy_catalog',sourceRecordId:null,provenance:'legacy_unverified' });
  }
  const mass = raw.match(/masa:\s*([0-9]+(?:[.,][0-9]+)?)\s*g\b/i);
  if (mass) result.push({kind:'body_mass',value:Number(mass[1]!.replace(',','.')),unit:'g',basis:null,estimated:true,sourceCode:'legacy_catalog',sourceRecordId:null,provenance:'legacy_unverified'});
  return result;
}

function parseEcology(row: SpeciesRow): Species['ecology'] {
  const direct = parseObject<Partial<Species['ecology']>>(row.ecology, {});
  if (row.ecology) return { ...EMPTY_ECOLOGY, ...direct };
  const traits = parseObject<Record<string, unknown>>(row.traits, {});
  const naturalHistory = parseObject<Record<string, any>>(row.natural_history, {});
  return {
    ...EMPTY_ECOLOGY,
    habitats: parseStringArray(row.habitat), diet: parseStringArray(row.diet),
    lifeModes: Array.isArray(traits.lifeModes) ? traits.lifeModes as string[] : [],
    activity: [...(Array.isArray(traits.activity) ? traits.activity as string[] : []), ...(naturalHistory.arthropod?.ecology?.activity ?? [])],
    aquaticEnvironments: Array.isArray(traits.aquaticEnvironments) ? traits.aquaticEnvironments as string[] : [],
    waterZones: Array.isArray(traits.waterZones) ? traits.waterZones as string[] : [],
    depthMinM: typeof traits.depthMinM === 'number' ? traits.depthMinM : null,
    depthMaxM: typeof traits.depthMaxM === 'number' ? traits.depthMaxM : null,
    microhabitats: naturalHistory.arthropod?.ecology?.microhabitat ?? [], trophicRoles: naturalHistory.arthropod?.ecology?.trophicRole ?? [],
    hosts: naturalHistory.arthropod?.ecology?.hosts ?? [], plantAssociations: naturalHistory.arthropod?.ecology?.plantAssociations ?? [],
    vegetationFormations: naturalHistory.plant?.vegetationFormations ?? [],
  };
}

function parseConservation(row: SpeciesRow): Species['conservation'] {
  const direct = parseObject<Species['conservation']>(row.conservation, { nationalRedList: null, iucnGlobal: null, nationalDesignations: [] });
  if (row.conservation) return direct;
  const raw = `${row.estado_conservacion ?? ''} ${row.conservation_label ?? ''}`.toLocaleUpperCase('es');
  return { nationalRedList: null, iucnGlobal: null, nationalDesignations: [raw.includes('PRIORITARIA') ? 'priority' : null, raw.includes('AMENAZADA') ? 'threatened' : null, raw.includes('SNAP') ? 'snap' : null].filter((item): item is 'priority'|'threatened'|'snap' => item !== null) };
}

/**
 * The single place SQL rows become domain entities. Screens never see a row,
 * so a schema change stops here instead of rippling through the UI.
 */
export function rowToSpecies(row: SpeciesRow, mediaRows: SpeciesMediaRow[] = []): Species {
  const taxonIdentifiers = parseObject<NonNullable<Species['taxonIdentifiers']>>(row.taxon_identifiers, {});
  const naturalHistoryRaw = parseObject<Record<string, unknown>>(row.natural_history, {});
  const primaryImage = mediaRows.find((media) => media.media_type === 'image' && media.is_primary === 1) ?? mediaRows.find((media) => media.media_type === 'image');
  const parsedMeasurements = parseMeasurements(row.measurements, row.traits);
  return {
    codigo: row.codigo,
    displayName: row.common_name,
    scientificName: row.scientific_name,
    acceptedName: row.accepted_name,
    commonNames: parseStringArray(row.common_names),
    taxonomy: {
      kingdom: row.kingdom,
      phylum: row.phylum,
      subfilo: row.subfilo,
      clase: row.clase,
      orden: row.orden,
      familia: row.familia,
      genero: row.genero,
      epiteto: row.epiteto,
    },
    taxonIdentifiers,
    conservation: parseConservation(row),
    nativa: row.nativa === 1,
    origin: row.origin,
    seasonality: row.seasonality,
    abundanceStatus: row.abundance_status,
    abundance: { category: row.abundance_category ?? null, label: row.abundance_label ?? row.abundance_status },
    observability: null,
    knowledgeLevel: row.knowledge_level ?? 'hard',
    gameRules: [],
    facts: [],
    measurements: parsedMeasurements.length ? parsedMeasurements : parseLegacySize(row.tamano, row.clase),
    ecology: parseEcology(row),
    relevantNote: row.relevant_note,
    sources: parseSources(row.sources),
    descripcion: row.descripcion,
    naturalHistory: Object.keys(naturalHistoryRaw).length > 0 ? naturalHistoryRaw as unknown as Species['naturalHistory'] : null,
    photo: row.image_url
      ? {
          url: row.image_url,
          fullUrl: row.full_url ?? row.image_url,
          thumbAsset: row.thumb_asset,
          license: row.image_license ?? '',
          originalLicense: primaryImage?.original_license ?? null,
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
