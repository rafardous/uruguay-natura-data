import type { LearningPath } from '../entities/learning';

/** El catálogo editorial se valida antes de reemplazar una lectura bootstrap. */
export function validLearningPath(value: unknown): value is LearningPath {
  if (!value || typeof value !== 'object') return false;
  const p = value as LearningPath;
  const text=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
  if (typeof p.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id) || !text(p.title) || !text(p.shortTitle) || !text(p.description) || !/^#[0-9a-f]{6}$/i.test(p.color) || typeof p.icon !== 'string' || !Array.isArray(p.modules)) return false;
  const modules = new Set<string>(), questions = new Set<string>(), objectives = new Set<string>();
  return p.modules.every(m => {
    if (!m || !text(m.id) || modules.has(m.id) || !text(m.title) || !text(m.hook) || !Array.isArray(m.blocks) || !m.blocks.length || !Array.isArray(m.questions) || !Array.isArray(m.sourceCodes)) return false;
    modules.add(m.id);
    if (!m.blocks.every(b => b && typeof b.title === 'string' && b.title.trim() && typeof b.body === 'string' && b.body.trim())) return false;
    return m.questions.every(q => {
      if (!q || !text(q.id) || questions.has(q.id) || !text(q.objectiveId) || objectives.has(q.objectiveId) || !Number.isInteger(q.version) || q.version < 1 || !text(q.prompt) || !text(q.explanation) || !Array.isArray(q.options) || q.options.length < 2 || q.options.some(o => typeof o !== 'string' || !o.trim()) || new Set(q.options).size !== q.options.length || !Array.isArray(q.correct)) return false;
      questions.add(q.id); objectives.add(q.objectiveId);
      if (q.type === 'classify') return Array.isArray(q.categories) && q.categories.length >= 2 && !!q.classification && q.options.every(o => q.categories!.includes(q.classification![o]!));
      if (!['single', 'multi', 'order'].includes(q.type) || !q.correct.length || new Set(q.correct).size !== q.correct.length || !q.correct.every(o => q.options.includes(o))) return false;
      return q.type === 'single' ? q.correct.length === 1 : q.type !== 'order' || q.correct.length === q.options.length;
    });
  });
}
