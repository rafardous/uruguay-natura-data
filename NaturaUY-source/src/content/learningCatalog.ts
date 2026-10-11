import { LEARNING_PATHS, LEARNING_SOURCES } from './learningContent';
import type { LearningPath, LearningSource } from '../domain/entities/learning';
import { validLearningPath } from '../domain/services/learningCatalog';

export function mergeLearningCatalog(rows: { id: string; content: string }[]) {
  const paths = new Map(LEARNING_PATHS.map(p => [p.id, p]));
  const sources = new Map(LEARNING_SOURCES.map(s => [s.code, s]));
  for (const row of rows) {
    try {
      const content: unknown = JSON.parse(row.content);
      if (!validLearningPath(content) || content.id !== row.id) continue;
      const doc = content as LearningPath & { archived?: boolean; sources?: LearningSource[] };
      if (doc.archived) { paths.delete(row.id); continue; }
      paths.set(row.id, doc);
      for (const s of doc.sources ?? []) if (s.code && s.name && /^https?:\/\//.test(s.url)) sources.set(s.code, s);
    } catch { /* Un documento inválido no reemplaza el bootstrap. */ }
  }
  return { paths: [...paths.values()], sources: [...sources.values()] };
}
