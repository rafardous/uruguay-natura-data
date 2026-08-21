import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { QUIZ_MODES, createRun, type QuizMode, type QuizQuestion, type QuizRunState } from '../../domain/entities/quiz';
import type { Species } from '../../domain/entities/species';
import { useUserDatabase } from '../../data/db/UserDatabaseProvider';
import { quizRepository } from '../../data/repositories/quizRepository';
import { speciesRepository } from '../../data/repositories/speciesRepository';
import { answerQuestion, buildQuestion, eligibleTargets, finishRun, shuffle } from '../../domain/services/quizEngine';

export interface QuizRun {
  loading: boolean;
  state: QuizRunState;
  question: QuizQuestion | null;
  secondsLeft: number | null;
  /** Set once the player answers, until the next question is served. */
  answeredCodigo: string | null;
  answer: (codigo: string) => boolean;
  next: () => void;
  restart: () => void;
}

/**
 * Owns one play-through: loads the pool once, then drives the pure engine.
 *
 * Targets are drawn from a pre-shuffled queue rather than sampled at random,
 * which guarantees a species never repeats within a run.
 */
export function useQuizRun(mode: QuizMode): QuizRun {
  // Questions come from the catalogue; records are written to the user database.
  const catalog = useSQLiteContext();
  const userDb = useUserDatabase();

  const [pool, setPool] = useState<Species[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<QuizRunState>(() => createRun(mode));
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [answeredCodigo, setAnsweredCodigo] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(QUIZ_MODES[mode].durationSeconds);

  const queue = useRef<Species[]>([]);
  const submitted = useRef(false);

  const serveNext = useCallback((currentPool: Species[]) => {
    if (queue.current.length === 0) {
      queue.current = shuffle(eligibleTargets(currentPool), Math.random);
    }
    const target = queue.current.pop();
    if (target) setQuestion(buildQuestion(target, currentPool, Math.random));
    setAnsweredCodigo(null);
  }, []);

  useEffect(() => {
    let active = true;

    void speciesRepository.findQuizPool(catalog).then((loaded) => {
      if (!active) return;
      setPool(loaded);
      queue.current = shuffle(eligibleTargets(loaded), Math.random);
      serveNext(loaded);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [catalog, serveNext]);

  // Countdown for the timed mode.
  useEffect(() => {
    if (secondsLeft === null || state.finished || loading) return;

    if (secondsLeft <= 0) {
      setState(finishRun);
      return;
    }

    const timer = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, state.finished, loading]);

  // Persist the result exactly once per run.
  useEffect(() => {
    if (!state.finished || submitted.current) return;
    submitted.current = true;
    void quizRepository.submitRun(userDb, mode, state.score, state.bestStreakThisRun);
  }, [state.finished, state.score, state.bestStreakThisRun, userDb, mode]);

  const answer = useCallback(
    (codigo: string): boolean => {
      if (!question || answeredCodigo) return false;

      const wasCorrect = question.options.some((o) => o.codigo === codigo && o.correct);
      setAnsweredCodigo(codigo);
      setState((current) => answerQuestion(current, wasCorrect));
      return wasCorrect;
    },
    [question, answeredCodigo],
  );

  const next = useCallback(() => {
    if (state.finished) return;
    serveNext(pool);
  }, [pool, serveNext, state.finished]);

  const restart = useCallback(() => {
    submitted.current = false;
    queue.current = shuffle(eligibleTargets(pool), Math.random);
    setState(createRun(mode));
    setSecondsLeft(QUIZ_MODES[mode].durationSeconds);
    serveNext(pool);
  }, [mode, pool, serveNext]);

  return useMemo(
    () => ({ loading, state, question, secondsLeft, answeredCodigo, answer, next, restart }),
    [loading, state, question, secondsLeft, answeredCodigo, answer, next, restart],
  );
}
