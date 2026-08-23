/** The catalogue's core entity, as the presentation layer sees it. */

export interface SpeciesPalette {
  /** Readable as text on the light theme's card surface. */
  accentLight: string;
  /** Readable as text on the dark theme's card surface. */
  accentDark: string;
  containerLight: string;
  onContainerLight: string;
  containerDark: string;
  onContainerDark: string;
}

export interface SpeciesPhoto {
  /** Medium resolution, used by cards. */
  url: string;
  /** Large resolution, used by the detail sheet. */
  fullUrl: string;
  /** Filename inside `assets/thumbs`, or null when none was bundled. */
  thumbAsset: string | null;
  license: string;
  attribution: string;
  source: string;
  page: string | null;
}

export interface Taxonomy {
  clase: string;
  orden: string;
  familia: string;
  genero: string;
  epiteto: string;
}

export interface Species {
  codigo: string;
  /** What the card shows: vernacular name, or the scientific name when absent. */
  displayName: string;
  scientificName: string;
  acceptedName: string | null;
  commonNames: string[];
  taxonomy: Taxonomy;
  conservation: {
    raw: string;
    label: string;
    /** 0 unassessed · 1 not a priority · 2 priority · 3 threatened. */
    rank: number;
  };
  nativa: boolean;
  /** Explicit origin; null means the sources do not establish it. */
  origin: 'native' | 'introduced' | null;
  descripcion: string;
  alimentacion: string;
  tamano: string;
  photo: SpeciesPhoto | null;
  audioUrl: string | null;
  palette: SpeciesPalette;
}

/** True when the species has enough imagery to appear in the quiz. */
export const isQuizEligible = (species: Species): boolean => species.photo !== null;
