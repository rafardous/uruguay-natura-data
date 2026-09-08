import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { Image } from 'expo-image';

import { QUIZ_MODES, QUIZ_SCOPES, createRun, type QuizMode, type QuizQuestion, type QuizRunState, type QuizScope } from '../../domain/entities/quiz';
import type { Species } from '../../domain/entities/species';
import { useUserDatabase } from '../../data/db/UserDatabaseProvider';
import { quizRepository } from '../../data/repositories/quizRepository';
import { speciesRepository } from '../../data/repositories/speciesRepository';
import { answerQuestion, buildQuestion, eligibleTargets, finishRun, grantExtraLife, shuffle } from '../../domain/services/quizEngine';
import { useMobileSync } from '../../sync/MobileSyncProvider';
import { rankNameMatches } from '../../domain/services/naming';
import { isNewPersonalRecord as isNewPersonalRecordScore, upcomingQuizImageUrls } from '../quizUtils';

export interface QuizRun {
  loading: boolean;
  state: QuizRunState;
  question: QuizQuestion | null;
  secondsLeft: number | null;
  /** Set once the player answers, until the next question is served. */
  answeredCodigo: string | null;
  isNewPersonalRecord: boolean;
  answer: (codigo: string) => boolean;
  next: () => void;
  restart: () => void;
  awardLife: () => void;
  nameCandidates: (query: string) => Species[];
}

/**
 * Owns one play-through: loads the pool once, then drives the pure engine.
 *
 * Targets are drawn from a pre-shuffled queue rather than sampled at random,
 * which guarantees a species never repeats within a run.
 */
export function useQuizRun(mode: QuizMode, scope: QuizScope): QuizRun {
  // Questions come from the catalogue; records are written to the user database.
  const catalog = useSQLiteContext();
  const userDb = useUserDatabase();
  const { requestSync } = useMobileSync();

  const [pool, setPool] = useState<Species[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<QuizRunState>(() => createRun(mode));
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [answeredCodigo, setAnsweredCodigo] = useState<string | null>(null);
  const [isNewPersonalRecord, setIsNewPersonalRecord] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(QUIZ_MODES[mode].durationSeconds);

  const queue = useRef<Species[]>([]);
  const submitted = useRef(false);
  const previousBestScore = useRef(0);
  const prefetchedUrls = useRef(new Set<string>());

  const serveNext = useCallback((currentPool: Species[]) => {
    if (queue.current.length === 0) {
      queue.current = shuffle(eligibleTargets(currentPool), Math.random);
    }
    const target = queue.current.pop();
    if (target) setQuestion(buildQuestion(target, currentPool, Math.random));
    const upcoming = upcomingQuizImageUrls(queue.current.slice(-2));
    const pending = upcoming.filter((url) => !prefetchedUrls.current.has(url));
    if (pending.length) {
      pending.forEach((url) => prefetchedUrls.current.add(url));
      void Image.prefetch(pending, 'memory-disk').catch(() => undefined);
    }
    setAnsweredCodigo(null);
  }, []);

  useEffect(() => {
    let active = true;

    void Promise.all([
      speciesRepository.findQuizPool(catalog, QUIZ_SCOPES[scope].classes),
      quizRepository.getRecord(userDb, mode, scope).catch(() => null),
    ]).then(([loaded, record]) => {
      if (!active) return;
      setPool(loaded);
      previousBestScore.current = record?.bestScore ?? 0;
      queue.current = shuffle(eligibleTargets(loaded), Math.random);
      serveNext(loaded);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [catalog, mode, scope, serveNext, userDb]);

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
    const newRecord = isNewPersonalRecordScore(previousBestScore.current, state.score);
    setIsNewPersonalRecord(newRecord);
    previousBestScore.current = Math.max(previousBestScore.current, state.score);
    void quizRepository.submitRun(userDb, mode, scope, state.score, state.bestStreakThisRun).then(requestSync);
  }, [state.finished, state.score, state.bestStreakThisRun, userDb, mode, scope, requestSync]);

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
    setIsNewPersonalRecord(false);
    queue.current = shuffle(eligibleTargets(pool), Math.random);
    setState(createRun(mode));
    setSecondsLeft(QUIZ_MODES[mode].durationSeconds);
    serveNext(pool);
  }, [mode, pool, serveNext]);

  const awardLife = useCallback(() => setState(grantExtraLife), []);

  const nameCandidates = useCallback((query: string): Species[] => {
    return rankNameMatches(pool, query);
  }, [pool]);

  return useMemo(
    () => ({ loading, state, question, secondsLeft, answeredCodigo, isNewPersonalRecord, answer, next, restart, awardLife, nameCandidates }),
    [loading, state, question, secondsLeft, answeredCodigo, isNewPersonalRecord, answer, next, restart, awardLife, nameCandidates],
  );
}
