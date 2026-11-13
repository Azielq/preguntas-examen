/**
 * Validación y poda de los análisis guardados (PLAN-IA 8.1). Una entrada inválida se descarta sola,
 * sin arrastrar al resto ni al historial de intentos.
 */
import { checkVerifiedOutput, isCoverage, textErrors, validateModelOutputShape } from '../../shared/analysis/contract';
import { MAX_STORED_ANALYSES } from '../../shared/analysis/limits';
import { emptyAnalyses, type AnalysesState, type AttemptsState, type ExamAttempt, type StoredAnalysis } from './schema';

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStrArr = (x: unknown): x is string[] => Array.isArray(x) && x.every((s) => typeof s === 'string');
const isNat = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0;

function isDerived(x: unknown, conceptIds: Set<string>): boolean {
  if (!isObj(x)) return false;
  if (!isObj(x.priorities) || !isStrArr(x.order) || !isStrArr(x.improvedIds) || !isStrArr(x.practiceIds) || !isObj(x.practiceByConcept)) return false;
  for (const [id, p] of Object.entries(x.priorities)) {
    if (!conceptIds.has(id) || !isObj(p)) return false;
    if (p.level !== 'alta' && p.level !== 'media' && p.level !== 'baja') return false;
    if (!isNat(p.I) || !isNat(p.O) || !isNat(p.R)) return false;
    if (!(p.f === null || (typeof p.f === 'number' && p.f >= 0 && p.f <= 1))) return false;
    if (!(p.chapter === null || typeof p.chapter === 'string')) return false;
  }
  if (!x.order.every((id) => conceptIds.has(id))) return false;
  if (!Object.values(x.practiceByConcept).every(isStrArr)) return false;
  return Array.isArray(x.chapterStrengths) && x.chapterStrengths.every((c) => isObj(c) && typeof c.section === 'string' && isNat(c.correct) && isNat(c.total));
}

export function attemptIdSets(a: Pick<ExamAttempt, 'items'>): { failed: Set<string>; correct: Set<string> } {
  return {
    failed: new Set(a.items.filter((i) => i.result !== 'correct').map((i) => i.questionId)),
    correct: new Set(a.items.filter((i) => i.result === 'correct').map((i) => i.questionId)),
  };
}

export type EntryCheck = { ok: true; value: StoredAnalysis } | { ok: false; incompatible: boolean };

/** Valida una entrada. Con `attempt`, además exige que cada id de la salida pertenezca a ese intento. */
export function checkStoredAnalysis(x: unknown, attempt?: Pick<ExamAttempt, 'id' | 'items'>): EntryCheck {
  if (!isObj(x)) return { ok: false, incompatible: false };
  if (typeof x.analysisSchemaVersion === 'number' && x.analysisSchemaVersion !== 1) return { ok: false, incompatible: true };
  if (x.analysisSchemaVersion !== 1) return { ok: false, incompatible: false };
  if (typeof x.attemptId !== 'string' || (attempt && x.attemptId !== attempt.id)) return { ok: false, incompatible: false };
  if (typeof x.createdAt !== 'number' || typeof x.bankVersion !== 'string' || typeof x.promptVersion !== 'string' || typeof x.model !== 'string') return { ok: false, incompatible: false };
  if (x.provider !== 'anthropic' && x.provider !== 'mock') return { ok: false, incompatible: false };
  if (!isCoverage(x.coverage)) return { ok: false, incompatible: false };
  let outputOk: boolean;
  if (attempt) outputOk = checkVerifiedOutput(x.output, attemptIdSets(attempt)).ok;
  else {
    const shape = validateModelOutputShape(x.output);
    outputOk = shape.ok && textErrors(shape.value).length === 0;
  }
  if (!outputOk) return { ok: false, incompatible: false };
  const conceptIds = new Set((x.output as StoredAnalysis['output']).concepts.map((k) => k.id));
  if (!isDerived(x.derived, conceptIds)) return { ok: false, incompatible: false };
  return { ok: true, value: x as unknown as StoredAnalysis };
}

export interface SanitizeResult {
  state: AnalysesState;
  dropped: number;
  /** intentos con un análisis guardado de una versión de esquema desconocida */
  incompatible: string[];
}

/**
 * Descarta entradas inválidas una por una; con `attempts`, también las huérfanas (intento inexistente).
 * Aplica el tope de análisis guardados (se eliminan los más antiguos).
 */
export function sanitizeAnalyses(raw: unknown, attempts?: AttemptsState): SanitizeResult {
  const out = emptyAnalyses();
  const incompatible: string[] = [];
  let dropped = 0;
  if (!isObj(raw) || raw.schemaVersion !== 1 || !isObj(raw.byAttempt)) return { state: out, dropped: 0, incompatible };
  const byId = attempts ? new Map(attempts.attempts.map((a) => [a.id, a])) : null;
  for (const [key, entry] of Object.entries(raw.byAttempt)) {
    const attempt = byId?.get(key);
    if (byId && !attempt) {
      dropped += 1;
      continue;
    }
    const r = checkStoredAnalysis(entry, attempt);
    if (r.ok && r.value.attemptId === key) out.byAttempt[key] = r.value;
    else {
      dropped += 1;
      if (!r.ok && r.incompatible) incompatible.push(key);
    }
  }
  const capped = capAnalyses(out);
  return { state: capped, dropped: dropped + (Object.keys(out.byAttempt).length - Object.keys(capped.byAttempt).length), incompatible };
}

/** Tope de análisis guardados: se conservan los más nuevos. */
export function capAnalyses(s: AnalysesState, max = MAX_STORED_ANALYSES): AnalysesState {
  const entries = Object.entries(s.byAttempt);
  if (entries.length <= max) return s;
  const keep = entries.sort((a, b) => b[1].createdAt - a[1].createdAt).slice(0, max);
  return { schemaVersion: 1, byAttempt: Object.fromEntries(keep) };
}

/** Elimina análisis de intentos que ya no existen. Devuelve el mismo objeto si no cambió nada. */
export function pruneOrphans(s: AnalysesState, attemptIds: Set<string>): AnalysesState {
  const keys = Object.keys(s.byAttempt);
  if (keys.every((k) => attemptIds.has(k))) return s;
  return { schemaVersion: 1, byAttempt: Object.fromEntries(Object.entries(s.byAttempt).filter(([k]) => attemptIds.has(k))) };
}
