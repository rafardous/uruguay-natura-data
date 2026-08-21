/** Shapes flowing between pipeline stages. Each stage reads the previous stage's file. */

/** A record exactly as it appears in `resources/outputSNAP.json`. */
export interface RawSpecies {
  codigo: string;
  nombres_comunes: string[];
  clase: string;
  orden: string;
  familia: string;
  genero: string;
  epiteto_especifico: string;
  estado_conservacion: string;
  nativa: boolean;
  descripcion: string;
  alimentacion: string;
  tamano: string;
  imagen_url: string;
  thumbnail_url: string;
  audio_url: string;
}

/** Stage 01 output: cleaned, with a guaranteed display name. */
export interface NormalizedSpecies {
  codigo: string;
  scientificName: string;
  commonName: string;
  commonNames: string[];
  clase: string;
  orden: string;
  familia: string;
  genero: string;
  epiteto: string;
  estadoConservacion: string;
  conservationLabel: string;
  conservationRank: number;
  nativa: boolean;
  descripcion: string;
  alimentacion: string;
  tamano: string;
  audioUrl: string | null;
}

/** Stage 02 output: GBIF's view of the name, used to improve media hit rate. */
export interface TaxonomyMatch {
  acceptedName: string | null;
  status: string | null;
  matchType: string | null;
  confidence: number | null;
}

export type MediaSource = 'inaturalist' | 'wikimedia';

/** Stage 03 output: a freely licensed photo, or an explicit miss. */
export interface MediaRecord {
  imageUrl: string;
  /** Larger variant used by the detail sheet when the network allows. */
  fullUrl: string;
  license: string;
  attribution: string;
  source: MediaSource;
  sourcePage: string | null;
}

/** Stage 05 output: contrast-safe tones derived from the photo. */
export interface PaletteRecord {
  seed: string;
  accentLight: string;
  accentDark: string;
  containerLight: string;
  onContainerLight: string;
  containerDark: string;
  onContainerDark: string;
}
