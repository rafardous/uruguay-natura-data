import type { SpeciesRow } from '../../db/schema';
import { rowToSpecies } from '../speciesMapper';

const baseRow: SpeciesRow = {
  codigo: 'V_chilensi',
  scientific_name: 'Vanellus chilensis',
  accepted_name: 'Vanellus chilensis',
  common_name: 'Tero',
  common_names: '["Tero","Tero común"]',
  kingdom: 'Animalia',
  phylum: 'Chordata',
  clase: 'Aves',
  orden: 'Charadriiformes',
  familia: 'Charadriidae',
  genero: 'Vanellus',
  epiteto: 'chilensis',
  estado_conservacion: 'No Prioritaria',
  conservation_label: 'No prioritaria',
  conservation_rank: 1,
  nativa: 1,
  origin: 'native',
  seasonality: 'resident',
  abundance_status: null,
  habitat: '["pastizal_campo_natural"]',
  diet: '["invertebrates"]',
  relevant_note: null,
  sources: '[{"source":"snap","record":"V_chilensi"}]',
  descripcion: 'Ave común de pastizales.',
  alimentacion: 'Insectos y lombrices.',
  tamano: '32-38 cm',
  traits: '{"measurements":[{"kind":"body_mass","value":280,"unit":"g","basis":null,"estimated":false}],"lifeModes":["terrestrial"],"activity":[],"aquaticEnvironments":[],"waterZones":[],"depthMinM":null,"depthMaxM":null,"sources":["avonet"]}',
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
  it('keeps guide wingspan, source number and abundance separate from traits and conservation', () => {
    const bird = {
      guide: { sourceCode: 'azpiroz_2003', year: 2003, number: 13, page: 51, commonName: 'Albatros Pico Fino', englishName: 'Yellow-nosed Albatross', scientificName: 'Diomedea chlororhynchus' },
      measurements: [{ kind: 'body_length', valueCm: 80 }, { kind: 'wingspan', valueCm: 220 }],
      presence: { code: 'VI', label: 'Visitante de invierno', months: [4,5,6,7,8,9], note: 'Abril a setiembre.', outsidePeriod: false },
      habitat: ['I'], diet: ['Ps'], abundanceCode: 'BC',
    };
    const species = rowToSpecies({ ...baseRow, tamano: '80 cm', abundance_status: 'fairly_common', natural_history: JSON.stringify({ version: 1, bird }) });
    expect(species.naturalHistory?.bird).toEqual(bird);
    expect(species.traits.measurements[0]?.kind).toBe('body_mass');
    expect(species.conservation.label).toBe('No prioritaria');
    expect(species.abundanceStatus).toBe('fairly_common');
    expect(species.codigo).toBe(baseRow.codigo);
  });
  it('maps a complete row into a domain entity', () => {
    const species = rowToSpecies(baseRow);

    expect(species.displayName).toBe('Tero');
    expect(species.commonNames).toEqual(['Tero', 'Tero común']);
    expect(species.nativa).toBe(true);
    expect(species.taxonomy.phylum).toBe('Chordata');
    expect(species.taxonomy.familia).toBe('Charadriidae');
    expect(species.habitat).toEqual(['pastizal_campo_natural']);
    expect(species.diet).toEqual(['invertebrates']);
    expect(species.seasonality).toBe('resident');
    expect(species.sources).toEqual([{ source: 'snap', record: 'V_chilensi' }]);
    expect(species.traits.measurements[0]?.value).toBe(280);
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
    const species = rowToSpecies({ ...baseRow, common_names: 'not json', habitat: 'bad', diet: 'bad', sources: 'bad' });
    expect(species.commonNames).toEqual([]);
    expect(species.habitat).toEqual([]);
    expect(species.diet).toEqual([]);
    expect(species.sources).toEqual([]);
    expect(species.displayName).toBe('Tero');
  });

  it('drops malformed structured measurements instead of exposing them to the UI', () => {
    const species = rowToSpecies({ ...baseRow, traits: '{"measurements":[{"kind":"body_mass","value":"mucho","unit":"g","basis":null,"estimated":false}],"lifeModes":[],"activity":[],"aquaticEnvironments":[],"waterZones":[],"depthMinM":null,"depthMaxM":null,"sources":[]}' });
    expect(species.traits.measurements).toEqual([]);
  });

  it('maps schema 11 identifiers, natural history, distribution and exact media license', () => {
    const species = rowToSpecies({
      ...baseRow,
      taxon_identifiers: JSON.stringify({ gbif: { usageKey: 12345 }, iNaturalist: { taxonId: 67890 } }),
      natural_history: JSON.stringify({ version: 1, arthropod: { lifeCycle: { metamorphosis: 'complete' } } }),
      distribution_summary: JSON.stringify({ departments: ['Rocha'], occurrenceCount: 12, confidence: 'medium' }),
    }, [{
      id: 'tero-image', stable_id: 'V_chilensi', media_type: 'image', ordinal: 1, is_primary: 1,
      url: 'https://example.test/tero.jpg', thumbnail_url: null, author: 'Fotógrafo', license: 'CC-BY',
      original_license: 'cc-by', source: 'inaturalist', source_url: 'https://example.test/observation',
      duration_seconds: null, external_id: 'inat-photo:1',
    }]);

    expect(species.taxonIdentifiers?.gbif?.usageKey).toBe(12345);
    expect(species.naturalHistory?.arthropod?.lifeCycle?.metamorphosis).toBe('complete');
    expect(species.distributionSummary?.departments).toEqual(['Rocha']);
    expect(species.photo?.originalLicense).toBe('cc-by');
    expect(species.media[0]?.originalLicense).toBe('cc-by');
  });

  it('treats nativa as a boolean, not a truthy number', () => {
    expect(rowToSpecies({ ...baseRow, nativa: 0 }).nativa).toBe(false);
  });

  it('keeps schema 11 source metadata while reading the legacy shape', () => {
    const species = rowToSpecies({
      ...baseRow,
      sources: JSON.stringify([{
        source: 'avonet', record: 'AVO-42', fieldPath: 'traits', sourceCode: 'avonet', version: 'AVONET 1.0',
        name: 'AVONET', url: 'https://example.test/avonet', citation: 'Tobias et al. 2022', license: 'CC BY 4.0',
      }]),
    });
    expect(species.sources[0]).toMatchObject({ sourceCode: 'avonet', fieldPath: 'traits', name: 'AVONET', record: 'AVO-42' });
    expect(species.sources[0]?.url).toBe('https://example.test/avonet');
    expect(species.sources[0]?.version).toBe('AVONET 1.0');
  });
});
