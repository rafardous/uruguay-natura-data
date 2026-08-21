import type { SpeciesRow } from '../../db/schema';
import { rowToSpecies } from '../speciesMapper';

const baseRow: SpeciesRow = {
  codigo: 'V_chilensi',
  scientific_name: 'Vanellus chilensis',
  accepted_name: 'Vanellus chilensis',
  common_name: 'Tero',
  common_names: '["Tero","Tero común"]',
  clase: 'Aves',
  orden: 'Charadriiformes',
  familia: 'Charadriidae',
  genero: 'Vanellus',
  epiteto: 'chilensis',
  estado_conservacion: 'No Prioritaria',
  conservation_label: 'No prioritaria',
  conservation_rank: 1,
  nativa: 1,
  descripcion: 'Ave común de pastizales.',
  alimentacion: 'Insectos y lombrices.',
  tamano: '32-38 cm',
  image_url: 'https://example.test/tero.jpg',
  full_url: 'https://example.test/tero-large.jpg',
  thumb_asset: 'V_chilensi.webp',
  audio_url: null,
  image_license: 'CC-BY',
  image_attribution: 'Fotógrafo (CC BY)',
  image_source: 'inaturalist',
  image_page: 'https://www.inaturalist.org/observations/1',
  accent_light: '#3D6847',
  accent_dark: '#9CCBAC',
  container_light: '#CFE3D2',
  on_container_light: '#12281F',
  container_dark: '#2B4A3A',
  on_container_dark: '#CFE9D6',
};

describe('rowToSpecies', () => {
  it('maps a complete row into a domain entity', () => {
    const species = rowToSpecies(baseRow);

    expect(species.displayName).toBe('Tero');
    expect(species.commonNames).toEqual(['Tero', 'Tero común']);
    expect(species.nativa).toBe(true);
    expect(species.taxonomy.familia).toBe('Charadriidae');
    expect(species.photo?.fullUrl).toBe('https://example.test/tero-large.jpg');
  });

  it('reports no photo when the row has no image', () => {
    const species = rowToSpecies({ ...baseRow, image_url: null, thumb_asset: null });
    expect(species.photo).toBeNull();
  });

  it('falls back to the medium image when no large variant was stored', () => {
    const species = rowToSpecies({ ...baseRow, full_url: null });
    expect(species.photo?.fullUrl).toBe('https://example.test/tero.jpg');
  });

  it('survives malformed common_names instead of throwing', () => {
    const species = rowToSpecies({ ...baseRow, common_names: 'not json' });
    expect(species.commonNames).toEqual([]);
    expect(species.displayName).toBe('Tero');
  });

  it('treats nativa as a boolean, not a truthy number', () => {
    expect(rowToSpecies({ ...baseRow, nativa: 0 }).nativa).toBe(false);
  });
});
