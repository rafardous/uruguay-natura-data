import type { Species } from '../../entities/species';
import { buildHabitatQuestions, macroHabitatsFor, scheduleHabitatRetry } from '../habitatGame';

function species(codigo: string, clase: string, habitat: string[]): Species {
  return {
    codigo, displayName: codigo, scientificName: codigo, acceptedName: null, commonNames: [codigo],
    taxonomy: { kingdom: 'Animalia', phylum: 'Chordata', clase, orden: '', familia: '', genero: '', epiteto: '' },
    conservation: { raw: '', label: '', rank: 0 }, nativa: true, origin: 'native', seasonality: null,
    abundanceStatus: null, abundance: { category: null, label: null }, observability: null, knowledgeLevel: 'easy',
    gameRules: [], facts: [], habitat, diet: [], relevantNote: null, sources: [], descripcion: '', alimentacion: '', tamano: '',
    traits: { measurements: [], lifeModes: [], activity: [], aquaticEnvironments: [], waterZones: [], depthMinM: null, depthMaxM: null, sources: [] },
    photo: { url: 'https://example.com/photo.jpg', fullUrl: 'https://example.com/photo.jpg', thumbAsset: null, license: '', attribution: '', source: '', page: null },
    audioUrl: null, media: [], palette: { accentLight: '', accentDark: '', containerLight: '', onContainerLight: '', containerDark: '', onContainerDark: '' },
  };
}

describe('habitatGame', () => {
  it('groups raw catalogue habitats into simple options', () => {
    expect(macroHabitatsFor(species('x', 'Aves', ['humedal', 'monte_nativo']))).toEqual(['Monte y matorral', 'Humedales y aguas continentales']);
  });

  it('never uses a known habitat as a distractor', () => {
    const pool = [species('bird', 'Aves', ['humedal', 'rio_arroyo']), species('mammal', 'Mammalia', ['monte_nativo']), species('plant', 'Plantae', ['pastizal_campo_natural'])];
    for (const question of buildHabitatQuestions(pool, 3, () => 0.4)) {
      expect(question.options).toEqual(expect.arrayContaining(question.correctAnswers));
      expect(question.options.filter((option) => !question.correctAnswers.includes(option))).not.toContain('Humedales y aguas continentales');
    }
  });

  it('keeps all known habitats when selecting three choices', () => {
    const fourHabitats = species('too-many', 'Mammalia', ['pastizal_campo_natural', 'monte_nativo', 'humedal', 'costa_playa_dunas']);
    const question = buildHabitatQuestions([fourHabitats, species('valid', 'Mammalia', ['humedal'])], 1, () => 0.2)[0];
    expect(question?.id).toBe('valid');
    expect(question?.options).toHaveLength(3);
    expect(question?.options).toEqual(expect.arrayContaining(question?.correctAnswers ?? []));
  });

  it('schedules a wrong answer once two to four places later', () => {
    const questions = buildHabitatQuestions([species('a', 'Aves', ['humedal']), species('b', 'Mammalia', ['monte_nativo']), species('c', 'Aves', ['pastizal_campo_natural']), species('d', 'Mammalia', ['roquedal_sierras'])], 4, () => 0.5);
    const first = questions[0];
    if (!first) throw new Error('test fixture did not create questions');
    const next = scheduleHabitatRetry(questions, first, 0, () => 0);
    expect(next.filter((question) => question.id === first.id)).toHaveLength(2);
    expect(next.findIndex((question) => question.isRetry)).toBeGreaterThanOrEqual(2);
  });
});
