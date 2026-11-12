import { create } from 'zustand';
import { KEYS } from '../storage/keys';
import { DEFAULT_PREFS, isPrefs, type Prefs } from '../storage/schema';
import { readKey, writeKey } from '../storage/storage';

interface PrefsStore {
  prefs: Prefs;
  set(patch: Partial<Prefs>): void;
  replace(p: Prefs): void;
  reload(): void;
}

function loadPrefs(): Prefs {
  const r = readKey(KEYS.prefs, isPrefs, false);
  return r.value ? { ...DEFAULT_PREFS, ...r.value } : { ...DEFAULT_PREFS };
}

export function resolveTheme(theme: Prefs['theme']): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyPrefsToDocument(p: Prefs): void {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  el.dataset.theme = resolveTheme(p.theme);
  el.dataset.themePref = p.theme;
  el.dataset.textSize = p.textSize;
}

export const usePrefs = create<PrefsStore>((set, get) => ({
  prefs: loadPrefs(),
  set(patch) {
    const prefs = { ...get().prefs, ...patch };
    set({ prefs });
    writeKey(KEYS.prefs, prefs);
    applyPrefsToDocument(prefs);
  },
  replace(p) {
    set({ prefs: p });
    writeKey(KEYS.prefs, p);
    applyPrefsToDocument(p);
  },
  reload() {
    const prefs = loadPrefs();
    set({ prefs });
    applyPrefsToDocument(prefs);
  },
}));

if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    const p = usePrefs.getState().prefs;
    if (p.theme === 'system') applyPrefsToDocument(p);
  });
}
