import type { Species } from '../../domain/entities/species';
import type { SpeciesRow } from '../db/schema';

/** JSON-encoded arrays in SQLite are worth decoding defensively. */
function parseNames(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * The single place SQL rows become domain entities. Screens never see a row,
 * so a schema change stops here instead of rippling through the UI.
 */
export function rowToSpecies(row: SpeciesRow): Species {
  return {
    codigo: row.codigo,
    displayName: row.common_name,
    scientificName: row.scientific_name,
    acceptedName: row.accepted_name,
    commonNames: parseNames(row.common_names),
    taxonomy: {
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
    descripcion: row.descripcion,
    alimentacion: row.alimentacion,
    tamano: row.tamano,
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
