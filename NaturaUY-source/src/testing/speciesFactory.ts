import type { Species } from '../domain/entities/species';

/** Deterministic pseudo-RNG so quiz tests never flake. */
export function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

let counter = 0;

export function makeSpecies(overrides: Partial<Species> = {}): Species {
  counter += 1;
  const codigo = overrides.codigo ?? `SP_${counter}`;

  return {
    codigo,
    displayName: `Especie ${counter}`,
    scientificName: `Genus species${counter}`,
    acceptedName: null,
    commonNames: [`Especie ${counter}`],
    taxonomy: {
      clase: 'Aves',
      orden: 'Passeriformes',
      familia: 'Tyrannidae',
      genero: 'Genus',
      epiteto: `species${counter}`,
    },
    conservation: { raw: 'No Prioritaria', label: 'No prioritaria', rank: 1 },
    nativa: true,
    descripcion: '',
    alimentacion: '',
    tamano: '',
    photo: {
      url: `https://example.test/${codigo}.jpg`,
      fullUrl: `https://example.test/${codigo}-large.jpg`,
      thumbAsset: `${codigo}.webp`,
      license: 'CC-BY',
      attribution: 'Alguien (CC BY)',
      source: 'inaturalist',
      page: null,
    },
    audioUrl: null,
    palette: {
      accentLight: '#3D6847',
      accentDark: '#9CCBAC',
      containerLight: '#CFE3D2',
      onContainerLight: '#12281F',
      containerDark: '#2B4A3A',
      onContainerDark: '#CFE9D6',
    },
    ...overrides,
  };
}
