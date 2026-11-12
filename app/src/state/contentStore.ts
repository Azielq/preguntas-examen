import { create } from 'zustand';
import { loadExplanations, loadFragments, loadPbq } from '../bank/loadBank';
import type { Explanation, Fragment, Manifest, PbqSolution } from '../bank/types';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface ContentStore {
  explanations: Record<string, Explanation> | null;
  explanationsStatus: Status;
  fragments: Record<string, Record<string, Fragment> | 'loading' | 'error'>;
  pbq: PbqSolution[] | null;
  pbqStatus: Status;
  ensureExplanations(m: Manifest): void;
  ensureFragments(m: Manifest, section: string, force?: boolean): void;
  ensurePbq(m: Manifest, force?: boolean): void;
  retryExplanations(m: Manifest): void;
}

export const useContent = create<ContentStore>((set, get) => ({
  explanations: null,
  explanationsStatus: 'idle',
  fragments: {},
  pbq: null,
  pbqStatus: 'idle',
  ensureExplanations(m) {
    const st = get().explanationsStatus;
    if (st === 'loading' || st === 'ready') return;
    set({ explanationsStatus: 'loading' });
    loadExplanations(m).then(
      (explanations) => set({ explanations, explanationsStatus: 'ready' }),
      () => set({ explanationsStatus: 'error' }),
    );
  },
  retryExplanations(m) {
    set({ explanationsStatus: 'idle' });
    get().ensureExplanations(m);
  },
  ensureFragments(m, section, force = false) {
    const cur = get().fragments[section];
    if (cur === 'loading' || (cur && cur !== 'error' && !force)) return;
    if (cur === 'error' && !force) return;
    set((s) => ({ fragments: { ...s.fragments, [section]: 'loading' } }));
    loadFragments(m, section).then(
      (data) => set((s) => ({ fragments: { ...s.fragments, [section]: data } })),
      () => set((s) => ({ fragments: { ...s.fragments, [section]: 'error' } })),
    );
  },
  ensurePbq(m, force = false) {
    const st = get().pbqStatus;
    if (st === 'loading' || st === 'ready' || (st === 'error' && !force)) return;
    set({ pbqStatus: 'loading' });
    loadPbq(m).then(
      (pbq) => set({ pbq, pbqStatus: 'ready' }),
      () => set({ pbqStatus: 'error' }),
    );
  },
}));

/** Carga explicaciones en segundo plano cuando el navegador está libre. */
export function scheduleExplanations(m: Manifest): void {
  const run = () => useContent.getState().ensureExplanations(m);
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 3000 });
  else setTimeout(run, 500);
}
