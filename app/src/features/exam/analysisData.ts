/**
 * Datos del cliente para el análisis con IA (PLAN-IA 4.1): arma el pedido (solo ids, hashes, letras y
 * contadores) y adapta el banco cargado a las funciones puras de shared/analysis.
 */
import { chapterMap } from '../../../shared/analysis/chapters';
import type { AnalyzeRequest, HistoryChapter, HistoryQuestion } from '../../../shared/analysis/contract';
import type { DeriveBank } from '../../../shared/analysis/derive';
import { MAX_CHAPTER_COUNT, MAX_HISTORY_CHAPTERS, MAX_HISTORY_COUNT, MAX_HISTORY_QUESTIONS } from '../../../shared/analysis/limits';
import { objectiveCode, type LoadedBank } from '../../bank/types';
import { isScorable } from '../../grading/grade';
import { getStudyState } from '../../state/selectors';
import type { ExamAttempt, ProgressState } from '../../storage/schema';

const chapterCache = new WeakMap<LoadedBank, Map<string, string | null>>();

export function chaptersOf(bank: LoadedBank): Map<string, string | null> {
  let m = chapterCache.get(bank);
  if (!m) {
    m = chapterMap(bank.questions);
    chapterCache.set(bank, m);
  }
  return m;
}

export function deriveBank(bank: LoadedBank): DeriveBank {
  const chapters = chaptersOf(bank);
  return {
    questions: bank.questions,
    isScorable: (id) => {
      const q = bank.indexes.byId.get(id);
      return !!q && isScorable(q);
    },
    unitOf: (id) => bank.indexes.unitOf.get(id) ?? id,
    unitMembers: (u) => bank.indexes.units.get(u)?.members ?? [u],
    chapterOf: (id) => chapters.get(id) ?? null,
    objectiveOf: (id) => objectivesOfBank(bank).get(id) ?? null,
  };
}

const objectiveCache = new WeakMap<LoadedBank, Map<string, string>>();

/** Objetivo SY0-701 propio de cada pregunta (solo el libro completo de Messer lo trae). */
export function objectivesOfBank(bank: LoadedBank): Map<string, string> {
  let m = objectiveCache.get(bank);
  if (!m) {
    m = new Map();
    for (const q of bank.questions) {
      const code = objectiveCode(q.objective);
      if (code) m.set(q.id, code);
    }
    objectiveCache.set(bank, m);
  }
  return m;
}

export interface AttemptCounts {
  total: number;
  correct: number;
  incorrect: number;
  omitted: number;
  notScored: number;
}

export function attemptCounts(a: ExamAttempt): AttemptCounts {
  return {
    total: a.items.length,
    correct: a.items.filter((i) => i.result === 'correct').length,
    incorrect: a.items.filter((i) => i.result === 'incorrect').length,
    omitted: a.items.filter((i) => i.result === 'omitted').length,
    notScored: a.notScored?.length ?? 0,
  };
}

/** Preguntas del intento cuyo contenido cambió o ya no existe en el banco actual. */
export function changedItems(a: ExamAttempt, bank: LoadedBank): Set<string> {
  return new Set(a.items.filter((i) => bank.indexes.byId.get(i.questionId)?.contentHash !== i.contentHash).map((i) => i.questionId));
}

export type Analyzability =
  | { kind: 'ok'; request: AnalyzeRequest }
  | { kind: 'no_errors' }
  | { kind: 'all_omitted' }
  | { kind: 'not_analyzable' };

const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));

export function buildAnalyzeRequest(a: ExamAttempt, bank: LoadedBank, progress: ProgressState): Analyzability {
  const c = attemptCounts(a);
  if (c.incorrect + c.omitted === 0) return { kind: 'no_errors' };
  if (c.incorrect === 0) return { kind: 'all_omitted' };
  // contenido cambiado o eliminado: no se envía (PLAN-IA 4.1)
  if (changedItems(a, bank).size > 0) return { kind: 'not_analyzable' };
  const failedNowScorable = a.items.filter((i) => i.result === 'incorrect' && isScorable(bank.indexes.byId.get(i.questionId)!));
  if (failedNowScorable.length === 0) return { kind: 'not_analyzable' };

  const idx = bank.indexes;
  const unitSum = (id: string) => {
    const members = idx.units.get(idx.unitOf.get(id) ?? id)?.members ?? [id];
    let attempts = 0;
    let incorrect = 0;
    for (const m of members) {
      const p = progress.questions[m];
      attempts += p?.attempts ?? 0;
      incorrect += p?.incorrectCount ?? 0;
    }
    return { attempts: clamp(attempts, MAX_HISTORY_COUNT), incorrect: clamp(Math.min(incorrect, attempts), MAX_HISTORY_COUNT) };
  };
  const failed: HistoryQuestion[] = [];
  const improved: HistoryQuestion[] = [];
  for (const it of a.items) {
    const h = { id: it.questionId, ...unitSum(it.questionId) };
    if (h.attempts === 0) continue;
    if (it.result !== 'correct') failed.push(h);
    else if (h.incorrect >= 1) improved.push(h);
  }
  const byIncorrect = (x: HistoryQuestion, y: HistoryQuestion) => y.incorrect - x.incorrect;
  const questions = [...failed.sort(byIncorrect), ...improved.sort(byIncorrect)].slice(0, MAX_HISTORY_QUESTIONS);

  const chapters = chaptersOf(bank);
  const perChapter = new Map<string, HistoryChapter>();
  for (const q of bank.questions) {
    const ch = chapters.get(q.id);
    if (!ch || !isScorable(q)) continue;
    const st = getStudyState(progress.questions[q.id]);
    const e = perChapter.get(ch) ?? { section: ch, answered: 0, incorrect: 0 };
    if (st === 'correct' || st === 'incorrect') e.answered += 1;
    if (st === 'incorrect') e.incorrect += 1;
    perChapter.set(ch, e);
  }
  const chapterRows = [...perChapter.values()]
    .sort((x, y) => (x.section < y.section ? -1 : 1))
    .slice(0, MAX_HISTORY_CHAPTERS)
    .map((r) => ({ section: r.section, answered: clamp(r.answered, MAX_CHAPTER_COUNT), incorrect: clamp(r.incorrect, MAX_CHAPTER_COUNT) }));

  return {
    kind: 'ok',
    request: {
      schemaVersion: 1,
      bankVersion: bank.manifest.bankVersion,
      attempt: {
        items: a.items.map((i) => ({ id: i.questionId, hash: i.contentHash, selected: i.selected.slice(), result: i.result })),
        notScoredCount: c.notScored,
      },
      history: { questions, chapters: chapterRows },
    },
  };
}
