import { create } from 'zustand';
import type { Letter, Question } from '../bank/types';
import { scoreAttempt } from '../grading/scoreAttempt';
import type { ExamConfig, ExamItem } from '../grading/types';
import { KEYS } from '../storage/keys';
import {
  emptyAttempts,
  isAttemptsState,
  isExamActive,
  MAX_ATTEMPTS,
  type AttemptsState,
  type ExamActive,
  type ExamAttempt,
} from '../storage/schema';
import { readKey, removeKey, writeKey } from '../storage/storage';
import { applyAttempt, useProgress } from './progressStore';

interface ExamStore {
  active: ExamActive | null;
  attempts: AttemptsState;
  externalChangeAt: number | null;
  setInitial(active: ExamActive | null, attempts: AttemptsState): void;
  start(config: ExamConfig, items: ExamItem[], bankVersion: string, now?: number): ExamActive;
  setAnswer(index: number, selected: Letter[]): void;
  toggleFlag(index: number): void;
  go(index: number): void;
  tick(remainingMs: number | null, elapsedMs: number, persist: boolean): void;
  persistActive(): void;
  finish(byId: Map<string, Question>, endedBy: 'user' | 'timeout', now?: number): ExamAttempt | null;
  discard(): void;
  replaceAttempts(a: AttemptsState): void;
  clearAll(): void;
  reloadFromStorage(key: string): void;
}

export function readStoredExam(): { active: ExamActive | null; attempts: AttemptsState; corrupt: string[] } {
  const a = readKey(KEYS.examActive, isExamActive);
  const h = readKey(KEYS.attempts, isAttemptsState);
  const corrupt: string[] = [];
  if (a.corrupt) corrupt.push(KEYS.examActive);
  if (h.corrupt) corrupt.push(KEYS.attempts);
  return { active: a.value, attempts: h.value ?? emptyAttempts(), corrupt };
}

function newId(now: number): string {
  return `ex-${now.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export const useExam = create<ExamStore>((set, get) => {
  const save = (active: ExamActive | null) => {
    if (active) writeKey(KEYS.examActive, active);
    else removeKey(KEYS.examActive);
  };
  const update = (fn: (a: ExamActive) => ExamActive) => {
    const a = get().active;
    if (!a) return;
    const next = fn(a);
    set({ active: next });
    save(next);
  };
  return {
    active: null,
    attempts: emptyAttempts(),
    externalChangeAt: null,
    setInitial(active, attempts) {
      set({ active, attempts });
    },
    start(config, items, bankVersion, now = Date.now()) {
      const active: ExamActive = {
        schemaVersion: 1,
        id: newId(now),
        bankVersion,
        config,
        startedAt: now,
        items,
        currentIndex: 0,
        remainingMs: config.timerMinutes ? config.timerMinutes * 60_000 : null,
        elapsedMs: 0,
      };
      set({ active, externalChangeAt: null });
      save(active);
      return active;
    },
    setAnswer(index, selected) {
      update((a) => ({ ...a, items: a.items.map((it, i) => (i === index ? { ...it, selected: selected.slice() } : it)) }));
    },
    toggleFlag(index) {
      update((a) => ({ ...a, items: a.items.map((it, i) => (i === index ? { ...it, flagged: !it.flagged } : it)) }));
    },
    go(index) {
      update((a) => ({ ...a, currentIndex: Math.max(0, Math.min(a.items.length - 1, index)) }));
    },
    tick(remainingMs, elapsedMs, persist) {
      const a = get().active;
      if (!a) return;
      const next = { ...a, remainingMs, elapsedMs };
      set({ active: next });
      if (persist) save(next);
    },
    persistActive() {
      save(get().active);
    },
    finish(byId, endedBy, now = Date.now()) {
      const a = get().active;
      if (!a) return null;
      const scored = scoreAttempt(a.items, byId);
      const attempt: ExamAttempt = {
        id: a.id,
        bankVersion: a.bankVersion,
        config: a.config,
        startedAt: a.startedAt,
        finishedAt: now,
        elapsedMs: a.elapsedMs,
        endedBy,
        items: scored.items,
        totals: scored.totals,
      };
      if (scored.notScored.length > 0) attempt.notScored = scored.notScored;
      // progreso por pregunta (modo examen); las omitidas no registran respuesta
      let progress = useProgress.getState().state;
      for (const it of scored.items) {
        const q = byId.get(it.questionId);
        if (q && it.result !== 'omitted') progress = applyAttempt(progress, q, it.selected, it.result, 'exam', now);
      }
      useProgress.getState().replace(progress);
      const attempts: AttemptsState = { schemaVersion: 1, attempts: [attempt, ...get().attempts.attempts].slice(0, MAX_ATTEMPTS) };
      set({ active: null, attempts });
      writeKey(KEYS.attempts, attempts);
      save(null);
      return attempt;
    },
    discard() {
      set({ active: null });
      save(null);
    },
    replaceAttempts(attempts) {
      set({ attempts });
      writeKey(KEYS.attempts, attempts);
    },
    clearAll() {
      const attempts = emptyAttempts();
      set({ active: null, attempts });
      writeKey(KEYS.attempts, attempts);
      save(null);
    },
    reloadFromStorage(key) {
      if (key === KEYS.examActive) {
        const r = readKey(KEYS.examActive, isExamActive);
        set({ active: r.value, externalChangeAt: Date.now() });
      } else if (key === KEYS.attempts) {
        const r = readKey(KEYS.attempts, isAttemptsState);
        if (r.value) set({ attempts: r.value });
      }
    },
  };
});
