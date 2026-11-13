/**
 * Contrato de la API de análisis (PLAN-IA 3 y 5.3): tipos y validadores escritos a mano.
 * Puro y sin dependencias: lo importan el cliente (src/) y el servidor (server/).
 * Regla general: ningún nivel admite campos extra.
 */
import { MAX_CHAPTER_COUNT, MAX_HISTORY_CHAPTERS, MAX_HISTORY_COUNT, MAX_HISTORY_QUESTIONS, MAX_ITEMS, MAX_NOT_SCORED, MAX_SELECTED, OUT } from './limits.js';
import { textViolations } from './textRules.js';

export type ItemResult = 'correct' | 'incorrect' | 'omitted';

export interface AnalyzeItem {
  id: string;
  hash: string;
  selected: string[];
  result: ItemResult;
}

export interface HistoryQuestion {
  id: string;
  attempts: number;
  incorrect: number;
}

export interface HistoryChapter {
  section: string;
  answered: number;
  incorrect: number;
}

export interface AnalyzeRequest {
  schemaVersion: 1;
  bankVersion: string;
  attempt: { items: AnalyzeItem[]; notScoredCount: number };
  history: { questions: HistoryQuestion[]; chapters: HistoryChapter[] };
}

export interface Coverage {
  failed: number;
  failedAnalyzed: number;
  correctSent: number;
  omitted: number;
  notScored: number;
}

export type Evidence = 'hipotesis' | 'respaldada';

export interface Confusion {
  between: [string, string];
  questionIds: string[];
  evidence: Evidence;
  note: string;
}

export interface Concept {
  id: string;
  name: string;
  questionIds: string[];
  reinforce: string;
  questionNotes: { questionId: string; note: string }[];
  confusions: Confusion[];
  learnPoints: string[];
  explanation: string;
  example: string;
  activity: { text: string; minutes: number };
}

export interface ModelOutput {
  summary: string;
  concepts: Concept[];
  unassigned: string[];
  strengths: { name: string; questionIds: string[] }[];
  keyFlags: { questionId: string; note: string }[];
}

export type ProviderName = 'anthropic' | 'mock';

export interface AnalyzeResponse {
  schemaVersion: 1;
  promptVersion: string;
  bankVersion: string;
  provider: ProviderName;
  model: string;
  coverage: Coverage;
  repairs: string[];
  output: ModelOutput;
}

export type ErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden_origin'
  | 'bank_mismatch'
  | 'payload_too_large'
  | 'attempt_mismatch'
  | 'nothing_to_analyze'
  | 'rate_limited'
  | 'invalid_model_output'
  | 'model_refused'
  | 'unavailable'
  | 'upstream_timeout'
  | 'upstream_error'
  | 'method_not_allowed'
  | 'unsupported_media_type';

export interface ErrorBody {
  error: { code: ErrorCode; message: string; retryable: boolean; retryAfterSec?: number; details?: string[] };
}

/** Mensajes aptos para mostrar (PLAN-IA 3.4). */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  invalid_request: 'No se pudo preparar el análisis de este intento.',
  payload_too_large: 'No se pudo preparar el análisis de este intento.',
  method_not_allowed: 'No se pudo preparar el análisis de este intento.',
  unsupported_media_type: 'No se pudo preparar el análisis de este intento.',
  unauthorized: 'El token de acceso no es válido. Revisalo en Ajustes.',
  forbidden_origin: 'Este sitio no está autorizado a usar el análisis.',
  bank_mismatch: 'Este intento es de otra versión del banco y no se puede analizar.',
  attempt_mismatch: 'No hay errores puntuables para analizar en este intento.',
  nothing_to_analyze: 'No hay errores puntuables para analizar en este intento.',
  rate_limited: 'Llegaste al límite de análisis. Probá de nuevo más tarde.',
  invalid_model_output: 'La IA devolvió una respuesta que no pudimos verificar. No se guardó nada.',
  model_refused: 'La IA no pudo analizar este intento.',
  unavailable: 'El análisis con IA no está configurado en este despliegue.',
  upstream_timeout: 'El servicio de IA no respondió. Tu nota y la revisión no cambian.',
  upstream_error: 'El servicio de IA no respondió. Tu nota y la revisión no cambian.',
};

export const RETRYABLE: Record<ErrorCode, boolean> = {
  invalid_request: false,
  payload_too_large: false,
  method_not_allowed: false,
  unsupported_media_type: false,
  unauthorized: false,
  forbidden_origin: false,
  bank_mismatch: false,
  attempt_mismatch: false,
  nothing_to_analyze: false,
  rate_limited: true,
  invalid_model_output: true,
  model_refused: true,
  unavailable: false,
  upstream_timeout: true,
  upstream_error: true,
};

export function rateLimitedMessage(retryAfterSec: number | undefined): string {
  if (!retryAfterSec || retryAfterSec <= 0) return ERROR_MESSAGES.rate_limited;
  const min = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `Llegaste al límite de análisis. Probá de nuevo en ${min} ${min === 1 ? 'minuto' : 'minutos'}.`;
}

export type StatusReason = 'ok' | 'no_key' | 'no_token' | 'disabled';

export interface AiStatus {
  available: boolean;
  reason: StatusReason;
  requiresToken: boolean;
  provider: ProviderName;
  promptVersion: string;
  bankVersion: string;
}

// ---------------------------------------------------------------------------
// Validación a mano
// ---------------------------------------------------------------------------

// gor-cap1-0001 · msr-a046 (extracto de Messer) · msf-b039 (libro completo de Messer, exámenes A, B y C)
export const QUESTION_ID_RE = /^(gor-(cap|sim)\d-\d{4}|msr-a\d{3}|msf-[abc]\d{3})$/;
const HASH_RE = /^[0-9a-f]{6,64}$/;
const BANK_VERSION_RE = /^[0-9a-f]{1,32}$/;
const LETTER_RE = /^[A-H]$/;
const CONCEPT_ID_RE = /^[A-Za-z0-9_-]{1,16}$/;

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isInt = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;

class Checker {
  errors: string[] = [];
  fail(path: string, what: string) {
    if (this.errors.length < 50) this.errors.push(`${path}: ${what}`);
  }
  /** Objeto con exactamente estas claves (todas obligatorias). */
  obj(x: unknown, path: string, keys: readonly string[]): x is Record<string, unknown> {
    if (!isObj(x)) {
      this.fail(path, 'debe ser un objeto');
      return false;
    }
    const allowed = new Set(keys);
    for (const k of Object.keys(x)) if (!allowed.has(k)) this.fail(`${path}.${k}`, 'campo no permitido');
    for (const k of keys) if (!(k in x)) this.fail(`${path}.${k}`, 'falta');
    return true;
  }
  arr(x: unknown, path: string, min: number, max: number): x is unknown[] {
    if (!Array.isArray(x)) {
      this.fail(path, 'debe ser una lista');
      return false;
    }
    if (x.length < min || x.length > max) this.fail(path, `debe tener entre ${min} y ${max} elementos`);
    return true;
  }
  str(x: unknown, path: string, max: number, min = 1, re?: RegExp): x is string {
    if (typeof x !== 'string') {
      this.fail(path, 'debe ser texto');
      return false;
    }
    if (x.length < min || x.length > max) this.fail(path, `largo fuera de rango (${min}–${max})`);
    if (re && !re.test(x)) this.fail(path, 'formato inválido');
    return true;
  }
  int(x: unknown, path: string, min: number, max: number): x is number {
    if (!isInt(x, min, max)) {
      this.fail(path, `debe ser un entero entre ${min} y ${max}`);
      return false;
    }
    return true;
  }
  result(): Result<never> | null {
    return this.errors.length ? { ok: false, errors: this.errors } : null;
  }
}

const RESULTS = new Set(['correct', 'incorrect', 'omitted']);

/** Valida el pedido del cliente. `sections`: secciones reales del banco (para history.chapters). */
export function validateAnalyzeRequest(x: unknown, opts: { sections?: Set<string> } = {}): Result<AnalyzeRequest> {
  const c = new Checker();
  if (c.obj(x, 'body', ['schemaVersion', 'bankVersion', 'attempt', 'history'])) {
    if (x.schemaVersion !== 1) c.fail('schemaVersion', 'debe ser 1');
    c.str(x.bankVersion, 'bankVersion', 32, 1, BANK_VERSION_RE);
    const a = x.attempt;
    if (c.obj(a, 'attempt', ['items', 'notScoredCount'])) {
      c.int(a.notScoredCount, 'attempt.notScoredCount', 0, MAX_NOT_SCORED);
      if (c.arr(a.items, 'attempt.items', 1, MAX_ITEMS)) {
        const seen = new Set<string>();
        a.items.forEach((it, i) => {
          const p = `attempt.items[${i}]`;
          if (!c.obj(it, p, ['id', 'hash', 'selected', 'result'])) return;
          if (c.str(it.id, `${p}.id`, 20, 1, QUESTION_ID_RE)) {
            if (seen.has(it.id)) c.fail(`${p}.id`, 'repetido');
            seen.add(it.id);
          }
          c.str(it.hash, `${p}.hash`, 64, 6, HASH_RE);
          if (c.arr(it.selected, `${p}.selected`, 0, MAX_SELECTED)) {
            const ls = new Set<string>();
            it.selected.forEach((l, j) => {
              if (c.str(l, `${p}.selected[${j}]`, 1, 1, LETTER_RE)) {
                if (ls.has(l)) c.fail(`${p}.selected[${j}]`, 'letra repetida');
                ls.add(l);
              }
            });
          }
          if (typeof it.result !== 'string' || !RESULTS.has(it.result)) c.fail(`${p}.result`, 'valor inválido');
        });
      }
    }
    const h = x.history;
    if (c.obj(h, 'history', ['questions', 'chapters'])) {
      if (c.arr(h.questions, 'history.questions', 0, MAX_HISTORY_QUESTIONS)) {
        const seen = new Set<string>();
        h.questions.forEach((q, i) => {
          const p = `history.questions[${i}]`;
          if (!c.obj(q, p, ['id', 'attempts', 'incorrect'])) return;
          if (c.str(q.id, `${p}.id`, 20, 1, QUESTION_ID_RE)) {
            if (seen.has(q.id)) c.fail(`${p}.id`, 'repetido');
            seen.add(q.id);
          }
          const okA = c.int(q.attempts, `${p}.attempts`, 0, MAX_HISTORY_COUNT);
          const okI = c.int(q.incorrect, `${p}.incorrect`, 0, MAX_HISTORY_COUNT);
          if (okA && okI && (q.incorrect as number) > (q.attempts as number)) c.fail(`${p}.incorrect`, 'mayor que attempts');
        });
      }
      if (c.arr(h.chapters, 'history.chapters', 0, MAX_HISTORY_CHAPTERS)) {
        const seen = new Set<string>();
        h.chapters.forEach((ch, i) => {
          const p = `history.chapters[${i}]`;
          if (!c.obj(ch, p, ['section', 'answered', 'incorrect'])) return;
          if (c.str(ch.section, `${p}.section`, 16)) {
            if (opts.sections && !opts.sections.has(ch.section)) c.fail(`${p}.section`, 'sección inexistente');
            if (seen.has(ch.section)) c.fail(`${p}.section`, 'repetida');
            seen.add(ch.section);
          }
          const okA = c.int(ch.answered, `${p}.answered`, 0, MAX_CHAPTER_COUNT);
          const okI = c.int(ch.incorrect, `${p}.incorrect`, 0, MAX_CHAPTER_COUNT);
          if (okA && okI && (ch.incorrect as number) > (ch.answered as number)) c.fail(`${p}.incorrect`, 'mayor que answered');
        });
      }
    }
  }
  return c.result() ?? { ok: true, value: x as unknown as AnalyzeRequest };
}

/** Forma y límites de la salida del modelo (sin reglas de ids ni de texto). */
export function validateModelOutputShape(x: unknown): Result<ModelOutput> {
  const c = new Checker();
  const idList = (v: unknown, p: string, min: number, max: number) => {
    if (c.arr(v, p, min, max)) v.forEach((id, i) => c.str(id, `${p}[${i}]`, 20));
  };
  if (c.obj(x, 'output', ['summary', 'concepts', 'unassigned', 'strengths', 'keyFlags'])) {
    c.str(x.summary, 'summary', OUT.summary);
    if (c.arr(x.concepts, 'concepts', 0, OUT.maxConcepts)) {
      const ids = new Set<string>();
      x.concepts.forEach((k, i) => {
        const p = `concepts[${i}]`;
        if (!c.obj(k, p, ['id', 'name', 'questionIds', 'reinforce', 'questionNotes', 'confusions', 'learnPoints', 'explanation', 'example', 'activity'])) return;
        if (c.str(k.id, `${p}.id`, OUT.conceptId, 1, CONCEPT_ID_RE)) {
          if (ids.has(k.id)) c.fail(`${p}.id`, 'repetido');
          ids.add(k.id);
        }
        c.str(k.name, `${p}.name`, OUT.conceptName);
        idList(k.questionIds, `${p}.questionIds`, 1, OUT.maxQuestionIds);
        c.str(k.reinforce, `${p}.reinforce`, OUT.reinforce);
        if (c.arr(k.questionNotes, `${p}.questionNotes`, 0, OUT.maxQuestionIds)) {
          const noteIds: string[] = [];
          k.questionNotes.forEach((n, j) => {
            const pn = `${p}.questionNotes[${j}]`;
            if (!c.obj(n, pn, ['questionId', 'note'])) return;
            if (c.str(n.questionId, `${pn}.questionId`, 20)) noteIds.push(n.questionId);
            c.str(n.note, `${pn}.note`, OUT.questionNote);
          });
          // exactamente una nota por id de questionIds
          if (Array.isArray(k.questionIds)) {
            const qs = k.questionIds as unknown[];
            const same = noteIds.length === qs.length && new Set(noteIds).size === noteIds.length && noteIds.every((id) => qs.includes(id));
            if (!same) c.fail(`${p}.questionNotes`, 'debe haber exactamente una nota por cada id de questionIds');
          }
        }
        if (c.arr(k.confusions, `${p}.confusions`, 0, OUT.maxConfusions)) {
          k.confusions.forEach((cf, j) => {
            const pc = `${p}.confusions[${j}]`;
            if (!c.obj(cf, pc, ['between', 'questionIds', 'evidence', 'note'])) return;
            if (c.arr(cf.between, `${pc}.between`, 2, 2)) cf.between.forEach((t, z) => c.str(t, `${pc}.between[${z}]`, OUT.confusionTerm));
            idList(cf.questionIds, `${pc}.questionIds`, 1, OUT.maxQuestionIds);
            if (cf.evidence !== 'hipotesis' && cf.evidence !== 'respaldada') c.fail(`${pc}.evidence`, 'valor inválido');
            c.str(cf.note, `${pc}.note`, OUT.confusionNote);
          });
        }
        if (c.arr(k.learnPoints, `${p}.learnPoints`, OUT.minLearnPoints, OUT.maxLearnPoints)) k.learnPoints.forEach((t, j) => c.str(t, `${p}.learnPoints[${j}]`, OUT.learnPoint));
        c.str(k.explanation, `${p}.explanation`, OUT.explanation);
        c.str(k.example, `${p}.example`, OUT.example);
        if (c.obj(k.activity, `${p}.activity`, ['text', 'minutes'])) {
          c.str(k.activity.text, `${p}.activity.text`, OUT.activity);
          c.int(k.activity.minutes, `${p}.activity.minutes`, OUT.minMinutes, OUT.maxMinutes);
        }
      });
    }
    idList(x.unassigned, 'unassigned', 0, OUT.maxUnassigned);
    if (c.arr(x.strengths, 'strengths', 0, OUT.maxStrengths)) {
      x.strengths.forEach((s, i) => {
        const p = `strengths[${i}]`;
        if (!c.obj(s, p, ['name', 'questionIds'])) return;
        c.str(s.name, `${p}.name`, OUT.strengthName);
        idList(s.questionIds, `${p}.questionIds`, 0, OUT.maxQuestionIds);
      });
    }
    if (c.arr(x.keyFlags, 'keyFlags', 0, OUT.maxKeyFlags)) {
      x.keyFlags.forEach((f, i) => {
        const p = `keyFlags[${i}]`;
        if (!c.obj(f, p, ['questionId', 'note'])) return;
        c.str(f.questionId, `${p}.questionId`, 20);
        c.str(f.note, `${p}.note`, OUT.keyFlagNote);
      });
    }
  }
  return c.result() ?? { ok: true, value: x as unknown as ModelOutput };
}

/** Todas las cadenas redactadas por la IA, con su ruta. */
export function generatedTexts(o: ModelOutput): [string, string][] {
  const out: [string, string][] = [['summary', o.summary]];
  o.concepts.forEach((k, i) => {
    const p = `concepts[${i}]`;
    out.push([`${p}.name`, k.name], [`${p}.reinforce`, k.reinforce], [`${p}.explanation`, k.explanation], [`${p}.example`, k.example], [`${p}.activity.text`, k.activity.text]);
    k.questionNotes.forEach((n, j) => out.push([`${p}.questionNotes[${j}].note`, n.note]));
    k.confusions.forEach((cf, j) => {
      out.push([`${p}.confusions[${j}].note`, cf.note]);
      cf.between.forEach((t, z) => out.push([`${p}.confusions[${j}].between[${z}]`, t]));
    });
    k.learnPoints.forEach((t, j) => out.push([`${p}.learnPoints[${j}]`, t]));
  });
  o.strengths.forEach((s, i) => out.push([`strengths[${i}].name`, s.name]));
  o.keyFlags.forEach((f, i) => out.push([`keyFlags[${i}].note`, f.note]));
  return out;
}

/** Reglas de texto (6.1.4) sobre toda cadena generada. */
export function textErrors(o: ModelOutput): string[] {
  const errs: string[] = [];
  for (const [path, t] of generatedTexts(o)) for (const v of textViolations(t)) errs.push(`${path}: texto no permitido (${v})`);
  return errs;
}

/** Ids que referencia la salida, por destino. */
export function referencedIds(o: ModelOutput): { failed: string[]; correct: string[] } {
  const failed: string[] = [...o.unassigned];
  for (const k of o.concepts) {
    failed.push(...k.questionIds, ...k.questionNotes.map((n) => n.questionId));
    for (const cf of k.confusions) failed.push(...cf.questionIds);
  }
  failed.push(...o.keyFlags.map((f) => f.questionId));
  const correct = o.strengths.flatMap((s) => s.questionIds);
  return { failed, correct };
}

/**
 * Verificación completa de una salida ya reparada (la usa el cliente al recibir, leer o importar):
 * forma + reglas de texto + ids dentro de los conjuntos permitidos.
 */
export function checkVerifiedOutput(x: unknown, allowed: { failed: Set<string>; correct: Set<string> }): Result<ModelOutput> {
  const shape = validateModelOutputShape(x);
  if (!shape.ok) return shape;
  const errors = textErrors(shape.value);
  const ids = referencedIds(shape.value);
  for (const id of ids.failed) if (!allowed.failed.has(id)) errors.push(`id no permitido: ${id}`);
  for (const id of ids.correct) if (!allowed.correct.has(id)) errors.push(`id no permitido en fortalezas: ${id}`);
  return errors.length ? { ok: false, errors } : shape;
}

/** Forma de la respuesta 200 (la salida se verifica aparte con checkVerifiedOutput). */
export function validateAnalyzeResponseShape(x: unknown): Result<AnalyzeResponse> {
  const c = new Checker();
  if (c.obj(x, 'response', ['schemaVersion', 'promptVersion', 'bankVersion', 'provider', 'model', 'coverage', 'repairs', 'output'])) {
    if (x.schemaVersion !== 1) c.fail('schemaVersion', 'debe ser 1');
    c.str(x.promptVersion, 'promptVersion', 64);
    c.str(x.bankVersion, 'bankVersion', 32);
    if (x.provider !== 'anthropic' && x.provider !== 'mock') c.fail('provider', 'valor inválido');
    c.str(x.model, 'model', 80);
    checkCoverage(c, x.coverage, 'coverage');
    if (c.arr(x.repairs, 'repairs', 0, 200)) x.repairs.forEach((r, i) => c.str(r, `repairs[${i}]`, 200));
    const o = validateModelOutputShape(x.output);
    if (!o.ok) c.errors.push(...o.errors);
  }
  return c.result() ?? { ok: true, value: x as unknown as AnalyzeResponse };
}

function checkCoverage(c: Checker, x: unknown, p: string) {
  if (c.obj(x, p, ['failed', 'failedAnalyzed', 'correctSent', 'omitted', 'notScored'])) {
    for (const k of ['failed', 'failedAnalyzed', 'correctSent', 'omitted', 'notScored'] as const) c.int(x[k], `${p}.${k}`, 0, 1000);
  }
}

export function isCoverage(x: unknown): x is Coverage {
  const c = new Checker();
  checkCoverage(c, x, 'coverage');
  return c.errors.length === 0;
}

export function isAiStatus(x: unknown): x is AiStatus {
  return (
    isObj(x) &&
    typeof x.available === 'boolean' &&
    (x.reason === 'ok' || x.reason === 'no_key' || x.reason === 'no_token' || x.reason === 'disabled') &&
    typeof x.requiresToken === 'boolean' &&
    (x.provider === 'anthropic' || x.provider === 'mock') &&
    typeof x.promptVersion === 'string' &&
    typeof x.bankVersion === 'string'
  );
}

export function isErrorBody(x: unknown): x is ErrorBody {
  return isObj(x) && isObj(x.error) && typeof x.error.code === 'string' && x.error.code in ERROR_MESSAGES && typeof x.error.retryable === 'boolean';
}
