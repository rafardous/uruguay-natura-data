import { buildClassificationQuestions } from '../classificationGame';
import { makeSpecies } from '../../../testing/speciesFactory';

describe('classification game', () => {
  const pool = ['Aves', 'Mammalia', 'Reptilia', 'Amphibia', 'Actinopterygii'].map((clase, index) => makeSpecies({
    codigo: `s-${index}`,
    taxonomy: { kingdom: 'Animalia', phylum: 'Chordata', clase, orden: `Orden ${index}`, familia: `Familia ${index}`, genero: 'Genus', epiteto: 'species' },
    photo: { url: `photo-${index}`, fullUrl: `photo-${index}`, thumbAsset: null, license: 'CC0', attribution: '', source: '', page: null },
  }));

  it('creates unique options and always includes the right class', () => {
    const questions = buildClassificationQuestions(pool, 'easy', 3, () => 0.42);
    expect(questions).toHaveLength(3);
    for (const question of questions) {
      expect(new Set(question.options).size).toBe(4);
      expect(question.options).toContain(question.correctAnswer);
      expect(question.rank).toBe('clase');
    }
  });

  it('returns no questions when four distinct answers are not available', () => {
    expect(buildClassificationQuestions(pool.slice(0, 3), 'easy')).toEqual([]);
  });
});
