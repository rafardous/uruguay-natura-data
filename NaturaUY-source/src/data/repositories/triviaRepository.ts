import type { SQLiteDatabase } from 'expo-sqlite';
import type { KnowledgeLevel } from '../../domain/entities/quiz';

export interface TriviaOption { id: string; body: string; correct: boolean }
export interface TriviaQuestion { id: string; prompt: string; explanation: string | null; speciesId: string | null; imageUrl:string|null; imageAttribution:string|null; imageLicense:string|null; options: TriviaOption[] }

export const triviaRepository = {
  async list(db: SQLiteDatabase, classes: string[], level: KnowledgeLevel): Promise<TriviaQuestion[]> {
    const allowed = level === 'easy' ? ['easy'] : level === 'medium' ? ['easy', 'medium'] : ['easy', 'medium', 'hard'];
    const classClause = classes.length ? `AND species.clase IN (${classes.map(() => '?').join(',')})` : '';
    try {
      const questions = await db.getAllAsync<{ id: string; prompt: string; explanation: string | null; stable_id: string | null; image_url:string|null; image_attribution:string|null; image_license:string|null }>(
        `SELECT question.id,question.prompt,question.explanation,question.stable_id,question.image_url,question.image_attribution,question.image_license
         FROM trivia_questions question LEFT JOIN species ON species.stable_id=question.stable_id
         LEFT JOIN species_game_rules rule ON rule.stable_id=species.stable_id AND rule.game_key='trivia'
         WHERE question.stable_id IS NULL OR (
           COALESCE(rule.enabled,1)=1 AND COALESCE(rule.min_knowledge_level,species.knowledge_level,'hard') IN (${allowed.map(() => '?').join(',')}) ${classClause}
         )`,
        [...allowed, ...classes],
      );
      const result: TriviaQuestion[] = [];
      for (const question of questions) {
        const options = await db.getAllAsync<{ id: string; body: string; is_correct: number }>('SELECT id,body,is_correct FROM trivia_options WHERE question_id=? ORDER BY sort_order', [question.id]);
        if (options.length === 4) result.push({ id: question.id, prompt: question.prompt, explanation: question.explanation, speciesId: question.stable_id, imageUrl:question.image_url, imageAttribution:question.image_attribution,imageLicense:question.image_license,options: options.map((option) => ({ id: option.id, body: option.body, correct: option.is_correct === 1 })) });
      }
      return result;
    } catch {
      return [];
    }
  },
};
