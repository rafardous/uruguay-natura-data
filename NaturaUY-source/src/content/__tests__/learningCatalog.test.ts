import { mergeLearningCatalog } from '../learningCatalog';
import { LEARNING_PATHS } from '../learningContent';
import { validLearningPath } from '../../domain/services/learningCatalog';

const path = LEARNING_PATHS.find(p => p.id === 'historias-del-territorio')!;
test('el catálogo aprobado reemplaza una historia y conserva IDs', () => {
  const revised = { ...path, title: 'Historia editorial actualizada' };
  const result = mergeLearningCatalog([{ id: path.id, content: JSON.stringify(revised) }]);
  expect(result.paths.find(p => p.id === path.id)?.title).toBe(revised.title);
  expect(result.paths.find(p => p.id === path.id)?.modules[0]?.id).toBe(path.modules[0]?.id);
});
test('el archivo editorial oculta el bootstrap; la restauración lo recupera', () => {
  expect(mergeLearningCatalog([{ id: path.id, content: JSON.stringify({ ...path, archived: true }) }]).paths.some(p => p.id === path.id)).toBe(false);
  expect(mergeLearningCatalog([{ id: path.id, content: JSON.stringify(path) }]).paths.some(p => p.id === path.id)).toBe(true);
});
test('documentos rotos o identidad cruzada conservan las lecturas incluidas', () => {
  const result = mergeLearningCatalog([{ id: path.id, content: '{bad' }, { id: path.id, content: JSON.stringify({ ...path, title: 22 }) }, { id: 'other-id', content: JSON.stringify(path) }]);
  expect(result.paths).toEqual(LEARNING_PATHS);
});
test('rechaza respuestas duplicadas o sin clasificación completa', () => {
  const malformed = JSON.parse(JSON.stringify(path));
  malformed.modules[0].questions[0].options=['igual','igual'];
  expect(validLearningPath(malformed)).toBe(false);
  const classified = JSON.parse(JSON.stringify(path));
  Object.assign(classified.modules[0].questions[0],{type:'classify',categories:['A','B'],classification:{}});
  expect(validLearningPath(classified)).toBe(false);
});
