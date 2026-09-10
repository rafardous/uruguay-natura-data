import { namingChoices, rankNameMatches } from '../naming';
import type { Species } from '../../entities/species';

const species = (codigo: string, displayName: string, scientificName: string): Species => ({ codigo, displayName, scientificName, acceptedName: null, commonNames: [displayName], taxonomy: { kingdom: 'Animalia', phylum: '', clase: 'Aves', orden: '', familia: '', genero: '', epiteto: '' }, nativa: true, origin: 'native', seasonality: null, abundanceStatus: null, abundance: { category: null, label: null }, observability: null, knowledgeLevel: 'hard', gameRules: [], facts: [], conservation: { raw: 'LC', label: 'LC', rank: 0 }, habitat: [], diet: [], descripcion: '', alimentacion: '', tamano: '', relevantNote: null, sources: [], photo: null, audioUrl: null, media: [], palette: { accentLight: '', accentDark: '', containerLight: '', onContainerLight: '', containerDark: '', onContainerDark: '' } });

describe('rankNameMatches', () => {
  test('normalizes accents and prioritizes common-name prefixes', () => {
    const result = rankNameMatches([species('1', 'Ñandú', 'Rhea americana'), species('2', 'Gaviota', 'Larus dominicanus')], 'nandu');
    expect(result.map((item) => item.codigo)).toEqual(['1']);
  });
  test('requires two characters', () => expect(rankNameMatches([species('1', 'Ñandú', 'Rhea americana')], 'n')).toEqual([]));
  test('keeps the correct species among the four visible naming choices', () => {
    const target = species('answer', 'Tero', 'Vanellus chilensis');
    const pool = [
      target,
      species('1', 'Tijereta', 'Tyrannus savana'),
      species('2', 'Tucán', 'Ramphastos toco'),
      species('3', 'Tordo', 'Molothrus bonariensis'),
      species('4', 'Torcaza', 'Zenaida auriculata'),
    ];
    expect(namingChoices(pool, target, 'to', 4).map((item) => item.codigo)).toContain('answer');
  });
});
