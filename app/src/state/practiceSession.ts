import { create } from 'zustand';
import type { Letter } from '../bank/types';
import type { GradeResult } from '../grading/grade';

export interface CheckedEntry {
  selected: Letter[];
  result: GradeResult;
}

interface PracticeSessionStore {
  key: string | null;
  ids: string[];
  checked: Record<string, CheckedEntry>;
  start(key: string, ids: string[]): void;
  setChecked(id: string, entry: CheckedEntry): void;
  clearChecked(id: string): void;
}

/** Sesión de práctica en memoria: la lista se congela al iniciar. */
export const usePracticeSession = create<PracticeSessionStore>((set) => ({
  key: null,
  ids: [],
  checked: {},
  start(key, ids) {
    set({ key, ids, checked: {} });
  },
  setChecked(id, entry) {
    set((s) => ({ checked: { ...s.checked, [id]: entry } }));
  },
  clearChecked(id) {
    set((s) => {
      const c = { ...s.checked };
      delete c[id];
      return { checked: c };
    });
  },
}));
