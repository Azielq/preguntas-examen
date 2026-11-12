import { create } from 'zustand';
import type { Letter, Question } from '../bank/types';
import { KEYS } from '../storage/keys';
import { emptyProgress, isProgressState, type AttemptMode, type Outcome, type PracticeFilter, type ProgressState, type QuestionProgress } from '../storage/schema';
import { flushKey, readKey, writeDebounced } from '../storage/storage';

interface ProgressStore {
  state: ProgressState;
  markSeen(q: Question, now?: number): void;
  recordAttempt(q: Question, selected: Letter[], outcome: Outcome, mode: AttemptMode, now?: number): void;
  toggleFavorite(q: Question): boolean;
  toggleFlag(q: Question): boolean;
  setLastPractice(filter: PracticeFilter, questionId: string, now?: number): void;
  replace(state: ProgressState): void;
  clear(): void;
  reloadFromStorage(): void;
}

export function readStoredProgress(): { value: ProgressState | null; corrupt: boolean } {
  return readKey(KEYS.progress, isProgressState);
}

function entry(state: ProgressState, q: Question): QuestionProgress {
  const p = state.questions[q.id];
  if (p) return { ...p };
  return { contentHash: q.contentHash, attempts: 0, correctCount: 0, incorrectCount: 0 };
}

/** Función pura: registra un intento. Los `ungraded` no tocan contadores. */
export function applyAttempt(
  state: ProgressState,
  q: Question,
  selected: Letter[],
  outcome: Outcome,
  mode: AttemptMode,
  now: number,
): ProgressState {
  const p = entry(state, q);
  p.contentHash = q.contentHash;
  p.seenAt ??= now;
  p.lastSeenAt = now;
  p.last = { selected: selected.slice(), outcome, at: now, mode };
  if (outcome !== 'ungraded') {
    p.attempts += 1;
    if (outcome === 'correct') p.correctCount += 1;
    else p.incorrectCount += 1;
    p.lastGraded = { outcome, at: now };
    delete p.contentChanged;
  }
  return { ...state, questions: { ...state.questions, [q.id]: p } };
}

export const useProgress = create<ProgressStore>((set, get) => {
  const commit = (state: ProgressState) => {
    set({ state });
    writeDebounced(KEYS.progress, state);
  };
  return {
    state: emptyProgress(''),
    markSeen(q, now = Date.now()) {
      const s = get().state;
      const p = entry(s, q);
      p.seenAt ??= now;
      p.lastSeenAt = now;
      commit({ ...s, questions: { ...s.questions, [q.id]: p } });
    },
    recordAttempt(q, selected, outcome, mode, now = Date.now()) {
      commit(applyAttempt(get().state, q, selected, outcome, mode, now));
    },
    toggleFavorite(q) {
      const s = get().state;
      const p = entry(s, q);
      p.favorite = !p.favorite;
      if (!p.favorite) delete p.favorite;
      commit({ ...s, questions: { ...s.questions, [q.id]: p } });
      return !!p.favorite;
    },
    toggleFlag(q) {
      const s = get().state;
      const p = entry(s, q);
      p.flagged = !p.flagged;
      if (!p.flagged) delete p.flagged;
      commit({ ...s, questions: { ...s.questions, [q.id]: p } });
      return !!p.flagged;
    },
    setLastPractice(filter, questionId, now = Date.now()) {
      const s = get().state;
      commit({ ...s, lastPractice: { filter, questionId, at: now } });
    },
    replace(state) {
      set({ state });
      writeDebounced(KEYS.progress, state);
      flushKey(KEYS.progress);
    },
    clear() {
      const s = emptyProgress(get().state.bankVersion);
      set({ state: s });
      writeDebounced(KEYS.progress, s);
      flushKey(KEYS.progress);
    },
    reloadFromStorage() {
      const r = readStoredProgress();
      if (r.value) set({ state: r.value });
    },
  };
});
