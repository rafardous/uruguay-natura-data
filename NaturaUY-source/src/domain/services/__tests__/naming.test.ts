import { rankNameMatches } from '../naming';
import type { Species } from '../../entities/species';

const species = (codigo: string, displayName: string, scientificName: string): Species => ({ codigo, displayName, scientificName, acceptedName: null, commonNames: [displayName], taxonomy: { kingdom: 'Animalia', phylum: '', clase: 'Aves', orden: '', familia: '', genero: '', epiteto: '' }, nativa: true, origin: 'native', seasonality: null, abundanceStatus: null, conservation: { raw: 'LC', label: 'LC', rank: 0 }, habitat: [], diet: [], descripcion: '', alimentacion: '', tamano: '', relevantNote: null, sources: [], photo: null, audioUrl: null, media: [], palette: { accentLight: '', accentDark: '', containerLight: '', onContainerLight: '', containerDark: '', onContainerDark: '' } });

describe('rankNameMatches', () => {
  test('normalizes accents and prioritizes common-name prefixes', () => {
    const result = rankNameMatches([species('1', 'Ñandú', 'Rhea americana'), species('2', 'Gaviota', 'Larus dominicanus')], 'nandu');
    expect(result.map((item) => item.codigo)).toEqual(['1']);
  });
  test('requires two characters', () => expect(rankNameMatches([species('1', 'Ñandú', 'Rhea americana')], 'n')).toEqual([]));
});
