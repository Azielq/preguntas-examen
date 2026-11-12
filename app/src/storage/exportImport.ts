import { migrate } from './migrate';
import { reconcile, type BankRef, type ReconcileResult } from './reconcile';
import {
  DEFAULT_PREFS,
  isAttemptsState,
  isPrefs,
  isProgressState,
  type AttemptsState,
  type Prefs,
  type ProgressState,
} from './schema';

export interface ExportFile {
  app: 'secplus';
  schemaVersion: 1;
  exportedAt: string;
  prefs: Prefs;
  progress: ProgressState;
  attempts: AttemptsState;
}

export function buildExport(prefs: Prefs, progress: ProgressState, attempts: AttemptsState, now = new Date()): ExportFile {
  return { app: 'secplus', schemaVersion: 1, exportedAt: now.toISOString(), prefs, progress, attempts };
}

export type ParsedImport =
  | {
      ok: true;
      prefs: Prefs;
      progress: ProgressState;
      attempts: AttemptsState;
      reconcile: ReconcileResult;
      summary: { questions: number; attempts: number };
    }
  | { ok: false; error: string };

export function parseImport(text: string, bank: BankRef): ParsedImport {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' };
  }
  if (typeof raw !== 'object' || raw === null || (raw as { app?: unknown }).app !== 'secplus') {
    return { ok: false, error: 'El archivo no es una exportación de Sec+ Práctica.' };
  }
  const file = migrate(raw) as Partial<ExportFile> | null;
  if (!file) return { ok: false, error: 'La versión del archivo no es compatible con esta app.' };
  const progressRaw = migrate(file.progress);
  const attemptsRaw = migrate(file.attempts);
  if (!isProgressState(progressRaw)) return { ok: false, error: 'El progreso del archivo tiene un formato inválido.' };
  if (!isAttemptsState(attemptsRaw)) return { ok: false, error: 'El historial de exámenes del archivo tiene un formato inválido.' };
  const prefs = isPrefs(file.prefs) ? file.prefs : DEFAULT_PREFS;
  const r = reconcile(progressRaw, null, bank);
  return {
    ok: true,
    prefs,
    progress: r.progress,
    attempts: attemptsRaw,
    reconcile: r,
    summary: { questions: Object.keys(r.progress.questions).length, attempts: attemptsRaw.attempts.length },
  };
}
