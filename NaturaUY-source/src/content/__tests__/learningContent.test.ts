import { LEARNING_PATHS, LEARNING_SOURCES } from '../learningContent';
import fs from 'node:fs';
import path from 'node:path';
import type { LearningIllustration } from '../../domain/entities/learning';

describe('learning curriculum', () => {
  it('ships five complete routes and every source resolves', () => {
    expect(LEARNING_PATHS).toHaveLength(5);
    expect(LEARNING_PATHS.flatMap((path) => path.modules)).toHaveLength(21);
    const sourceCodes = new Set(LEARNING_SOURCES.map((source) => source.code));
    for (const module of LEARNING_PATHS.flatMap((path) => path.modules)) {
      expect(module.blocks.length).toBeGreaterThanOrEqual(3);
      expect(module.questions.length).toBeGreaterThan(0);
      expect(module.sourceCodes.every((code) => sourceCodes.has(code))).toBe(true);
    }
  });

  it('covers all four formative question types with unique objectives', () => {
    const questions = LEARNING_PATHS.flatMap((path) => path.modules.flatMap((module) => module.questions));
    expect(new Set(questions.map((question) => question.type))).toEqual(new Set(['single', 'multi', 'order', 'classify']));
    expect(new Set(questions.map((question) => question.objectiveId)).size).toBe(questions.length);
    for (const question of questions) {
      if (question.type === 'classify') expect(Object.keys(question.classification ?? {})).toHaveLength(question.options.length);
      else expect(question.correct.every((answer) => question.options.includes(answer))).toBe(true);
    }
  });

  it('answers every opening question in the reading and provides comprehension practice', () => {
    for (const module of LEARNING_PATHS.flatMap(route => route.modules)) {
      expect(module.minutes).toBeUndefined();
      expect(module.blocks.at(-1)?.title).toBe('Volvamos a la pregunta inicial');
      expect(module.blocks.at(-1)!.body.length).toBeGreaterThan(70);
      expect(module.questions.length).toBeGreaterThanOrEqual(2);
      expect(module.blocks.some(block => block.illustration)).toBe(true);
    }
    for (const module of LEARNING_PATHS.find(route => route.id === 'historias-del-territorio')!.modules) {
      expect(module.blocks.length).toBeGreaterThanOrEqual(6);
      expect(module.questions.length).toBeGreaterThanOrEqual(3);
      expect(module.blocks.map(block => block.body).join(' ').split(/\s+/).length).toBeGreaterThan(230);
    }
  });

  it('uses photographed catalog species, including every named example', () => {
    const root = path.resolve(__dirname, '../../..');
    const catalog = ['aves', 'mammalia', 'plantae'].flatMap(file => JSON.parse(fs.readFileSync(path.join(root, `data/catalog/${file}.json`), 'utf8')));
    const thumbMap = fs.readFileSync(path.join(root, 'src/data/assets/thumbMap.ts'), 'utf8');
    const illustrations: LearningIllustration[] = LEARNING_PATHS.flatMap(route => [route.illustration!, ...route.modules.flatMap(module => module.blocks.flatMap(block => block.illustration ? [block.illustration] : []))]);
    for (const figure of illustrations) {
      expect(figure.title.length).toBeGreaterThan(0);
      for (const item of figure.items) {
        if (!item.speciesCode) continue;
        const species = catalog.find(species => species.catalogCode === item.speciesCode);
        expect(species?.media?.image?.url).toMatch(/^https:\/\//);
        expect(species?.media?.image?.attribution).toBeTruthy();
        expect(species?.media?.image?.license).toBeTruthy();
        // Comparte SpeciesImage; no usa miniaturas históricas sin asociación editorial.
        const file = thumbMap.match(new RegExp(`'${item.speciesCode}': require\\('\\.\\./\\.\\./\\.\\./assets/thumbs/([^']+)'\\)`))?.[1];
        if (file) expect(fs.existsSync(path.join(root, 'assets/thumbs', file))).toBe(true);
      }
    }
    const examples: [RegExp, string][] = [[/cardenal de copete rojo|Paroaria coronata/i, 'P_coronata'], [/cardenal amarillo|Gubernatrix cristata/i, 'G_cristata'], [/ceibo/i, 'plant-erythrina-crista-galli'], [/carpincho/i, 'H_hydrocha'], [/cotorra/i, 'M_monachus'], [/torcaza\b/i, 'Z_auricula'], [/torcacita/i, 'C_picui'], [/venado/i, 'O_bezoarti'], [/zorzal/i, 'T_rufivent'], [/picaflor/i, 'H_chrysura'], [/pato.*maicero/i, 'A_georgica'], [/picazo/i, 'N_peposaca'], [/cara blanca/i, 'D_viduata']];
    for (const module of LEARNING_PATHS.flatMap(route => route.modules)) {
      const text = [module.title, module.hook, ...module.blocks.map(block => block.body), ...module.questions.map(question => [question.prompt, ...question.options].join(' '))].join(' ');
      const codes = module.blocks.flatMap(block => block.illustration?.items.map(item => item.speciesCode) ?? []);
      for (const [pattern, code] of examples) if (pattern.test(text)) expect(codes).toContain(code);
    }
  });
});
