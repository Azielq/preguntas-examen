import type { LoadedBank } from '../../bank/types';
import { es } from '../../i18n/es';
import { KEYS } from '../../storage/keys';
import { reconcile, reconcileMessage, type ReconcileResult } from '../../storage/reconcile';
import { emptyProgress } from '../../storage/schema';
import { flushKey, removeKey, setWriteStatusListener, storageAvailable, writeDebounced, writeKey } from '../../storage/storage';
import { readStoredAnalyses, useAnalysis } from '../../state/analysisStore';
import { scheduleExplanations } from '../../state/contentStore';
import { readStoredExam, useExam } from '../../state/examStore';
import { usePrefs } from '../../state/prefsStore';
import { readStoredProgress, useProgress } from '../../state/progressStore';
import { toast } from '../../state/toastStore';

let booted: string | null = null;

export function bankRef(bank: LoadedBank) {
  return { bankVersion: bank.manifest.bankVersion, hashOf: (id: string) => bank.indexes.byId.get(id)?.contentHash };
}

/** Carga el progreso guardado, lo reconcilia con el banco (PLAN 6.4) y avisa con conteos reales. */
export function bootstrap(bank: LoadedBank): ReconcileResult | null {
  if (booted === bank.manifest.bankVersion) return null;
  booted = bank.manifest.bankVersion;

  if (!storageAvailable()) toast(es.storage.unavailable, { tone: 'warning', persistent: true });

  const p = readStoredProgress();
  const ex = readStoredExam();
  if (p.corrupt || ex.corrupt.length > 0) toast(es.storage.corrupt, { tone: 'warning', persistent: true });

  const progress = p.value ?? emptyProgress(bank.manifest.bankVersion);
  const r = reconcile(progress, ex.active, bankRef(bank));
  useProgress.setState({ state: r.progress });
  useExam.getState().setInitial(r.examActive, ex.attempts);
  if (r.progress !== progress || !p.value) {
    writeDebounced(KEYS.progress, r.progress);
    flushKey(KEYS.progress);
  }
  if (r.examDiscarded) {
    removeKey(KEYS.examActive);
    toast(es.storage.examDiscarded, { tone: 'warning', persistent: true });
  } else if (r.examActive && r.examActive !== ex.active) {
    writeKey(KEYS.examActive, r.examActive);
  }
  // Análisis con IA: clave propia; se descartan entradas inválidas y huérfanas una por una
  const an = readStoredAnalyses(ex.attempts);
  useAnalysis.getState().setInitial(an.analyses, an.incompatible, an.token);
  if (an.corrupt) toast(es.storage.corrupt, { tone: 'warning', persistent: true });
  // si se borran o reemplazan intentos, se eliminan los análisis de intentos que ya no existen
  useExam.subscribe((s, prev) => {
    if (s.attempts !== prev.attempts) useAnalysis.getState().prune(new Set(s.attempts.attempts.map((a) => a.id)));
  });

  const msg = reconcileMessage(r);
  if (msg && p.value) toast(msg, { tone: 'info', persistent: true });

  setWriteStatusListener((_key, status) => {
    if (status === 'quota') toast(es.storage.quota, { tone: 'warning', persistent: true, action: { label: 'Ir a Ajustes', href: '/ajustes#datos' } });
  });

  window.addEventListener('storage', (e) => {
    if (!e.key) return;
    if (e.key === KEYS.progress) useProgress.getState().reloadFromStorage();
    else if (e.key === KEYS.prefs) usePrefs.getState().reload();
    else if (e.key === KEYS.examActive || e.key === KEYS.attempts) useExam.getState().reloadFromStorage(e.key);
    else if (e.key === KEYS.analyses || e.key === KEYS.aiAccess) useAnalysis.getState().reloadFromStorage(e.key, useExam.getState().attempts);
  });

  scheduleExplanations(bank.manifest);
  return r;
}

/** Solo para tests. */
export function __resetBoot() {
  booted = null;
}
