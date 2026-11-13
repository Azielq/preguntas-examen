import { sanitizeAnalyses } from './analyses';
import { migrate } from './migrate';
import { reconcile, type BankRef, type ReconcileResult } from './reconcile';
import {
  DEFAULT_PREFS,
  emptyAnalyses,
  isAttemptsState,
  isPrefs,
  isProgressState,
  type AnalysesState,
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
  /** opcional: los archivos sin análisis (anteriores) siguen importando. El token de IA nunca se exporta. */
  analyses?: AnalysesState;
}

export function buildExport(prefs: Prefs, progress: ProgressState, attempts: AttemptsState, now = new Date(), analyses?: AnalysesState): ExportFile {
  const file: ExportFile = { app: 'secplus', schemaVersion: 1, exportedAt: now.toISOString(), prefs, progress, attempts };
  if (analyses && Object.keys(analyses.byAttempt).length > 0) file.analyses = analyses;
  return file;
}

export type ParsedImport =
  | {
      ok: true;
      prefs: Prefs;
      progress: ProgressState;
      attempts: AttemptsState;
      analyses: AnalysesState;
      reconcile: ReconcileResult;
      summary: { questions: number; attempts: number };
      analysesCount: number;
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
  // análisis: se valida cada uno y se descartan los de intentos que no vienen en el archivo
  const analyses = file.analyses === undefined ? emptyAnalyses() : sanitizeAnalyses(file.analyses, attemptsRaw).state;
  const r = reconcile(progressRaw, null, bank);
  return {
    ok: true,
    prefs,
    progress: r.progress,
    attempts: attemptsRaw,
    analyses,
    reconcile: r,
    summary: { questions: Object.keys(r.progress.questions).length, attempts: attemptsRaw.attempts.length },
    analysesCount: Object.keys(analyses.byAttempt).length,
  };
}
