import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { LEARNING_PATHS, LEARNING_SOURCES } from '../../content/learningContent';
import { mergeLearningCatalog } from '../../content/learningCatalog';

export function useLearningCatalog() {
  const db = useSQLiteContext();
  const [catalog, setCatalog] = useState({ paths: LEARNING_PATHS, sources: LEARNING_SOURCES });
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; setLoading(true); void db.getAllAsync<{ id: string; content: string }>('SELECT id,content FROM learning_paths').then(rows => { if (active) setCatalog(mergeLearningCatalog(rows)); }).catch(() => { if (active) setCatalog({ paths: LEARNING_PATHS, sources: LEARNING_SOURCES }); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [db]);
  return { ...catalog, loading };
}
