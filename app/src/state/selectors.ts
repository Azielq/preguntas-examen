import { getAnswerState } from '../bank/selectors';
import { objectiveCode, type BankIndexes, type Question } from '../bank/types';
import { isScorable } from '../grading/grade';
import type { AnalysesState, AttemptsState, PracticeFilter, ProgressState, QuestionProgress } from '../storage/schema';

export type StudyState = 'unseen' | 'seen' | 'ungraded' | 'correct' | 'incorrect';

export const STUDY_STATE_LABEL: Record<StudyState, string> = {
  unseen: 'Sin ver',
  seen: 'Vista, sin responder',
  ungraded: 'Respondida, sin corregir',
  correct: 'Acertada',
  incorrect: 'Fallada',
};

export function getStudyState(p: QuestionProgress | undefined): StudyState {
  if (!p) return 'unseen';
  if (p.lastGraded) return p.lastGraded.outcome;
  if (p.last?.outcome === 'ungraded') return 'ungraded';
  if (p.seenAt !== undefined) return 'seen';
  return 'unseen';
}

export type FilterState = NonNullable<PracticeFilter['state']>;

function matchesState(q: Question, p: QuestionProgress | undefined, st: FilterState): boolean {
  switch (st) {
    case 'all':
      return true;
    case 'unanswered':
      return !p?.last;
    case 'failed':
      return p?.lastGraded?.outcome === 'incorrect';
    case 'flagged':
      return !!p?.flagged;
    case 'pending_review':
      return getAnswerState(q) === 'pending' || getAnswerState(q) === 'unknown';
  }
}

/** Ids de un intento para "Practicar las incorrectas" (incorrectas y omitidas). */
export function attemptReviewIds(attempts: AttemptsState, attemptId: string): string[] {
  const a = attempts.attempts.find((x) => x.id === attemptId);
  if (!a) return [];
  return a.items.filter((i) => i.result !== 'correct').map((i) => i.questionId);
}

export interface FilterContext {
  questions: Question[];
  progress: ProgressState;
  attempts: AttemptsState;
  /** análisis con IA guardados (listas `plan:`) */
  analyses?: AnalysesState;
}

/**
 * Ids de "Practicar estos temas" (`plan:<intento>`) o de "Practicar este tema" (`plan:<intento>:<concepto>`).
 * Lista congelada al guardar el análisis (PLAN-IA 10); los ids que ya no existan se ignoran al filtrar.
 */
export function planPracticeIds(analyses: AnalysesState | undefined, list: string): string[] {
  const rest = list.slice('plan:'.length);
  const sep = rest.indexOf(':');
  const attemptId = sep < 0 ? rest : rest.slice(0, sep);
  const conceptId = sep < 0 ? null : rest.slice(sep + 1);
  const a = analyses?.byAttempt[attemptId];
  if (!a) return [];
  return conceptId === null ? a.derived.practiceIds : a.derived.practiceByConcept[conceptId] ?? [];
}

/** Aplica el filtro de práctica en orden del banco. */
export function filterQuestions(ctx: FilterContext, f: PracticeFilter): Question[] {
  const qs = ctx.progress.questions;
  let base = ctx.questions;
  if (f.list?.startsWith('attempt:')) {
    const ids = new Set(attemptReviewIds(ctx.attempts, f.list.slice('attempt:'.length)));
    base = base.filter((q) => ids.has(q.id));
  } else if (f.list?.startsWith('plan:')) {
    const ids = new Set(planPracticeIds(ctx.analyses, f.list));
    base = base.filter((q) => ids.has(q.id));
  } else if (f.list === 'falladas') base = base.filter((q) => qs[q.id]?.lastGraded?.outcome === 'incorrect');
  else if (f.list === 'marcadas') base = base.filter((q) => !!qs[q.id]?.flagged);
  else if (f.list === 'favoritas') base = base.filter((q) => !!qs[q.id]?.favorite);
  return base.filter(
    (q) =>
      (!f.doc || q.doc === f.doc) &&
      (!f.section || q.section === f.section) &&
      (!f.objective || objectiveCode(q.objective) === f.objective) &&
      matchesState(q, qs[q.id], f.state ?? 'all') &&
      (!f.onlyFavorites || !!qs[q.id]?.favorite),
  );
}

export function activeFilterCount(f: PracticeFilter): number {
  return (f.doc ? 1 : 0) + (f.section ? 1 : 0) + (f.objective ? 1 : 0) + (f.state && f.state !== 'all' ? 1 : 0) + (f.onlyFavorites ? 1 : 0);
}

// ---- Estadísticas (solo puntuables) ----

export interface ProgressStats {
  scorable: number;
  answered: number;
  correct: number;
  incorrect: number;
  flagged: number;
}

export function progressStats(questions: Question[], progress: ProgressState): ProgressStats {
  const s: ProgressStats = { scorable: 0, answered: 0, correct: 0, incorrect: 0, flagged: 0 };
  for (const q of questions) {
    const p = progress.questions[q.id];
    if (p?.flagged) s.flagged += 1;
    if (!isScorable(q)) continue;
    s.scorable += 1;
    const st = getStudyState(p);
    if (st === 'correct') s.correct += 1;
    if (st === 'incorrect') s.incorrect += 1;
  }
  s.answered = s.correct + s.incorrect;
  return s;
}

export function hasAnyProgress(progress: ProgressState): boolean {
  return Object.values(progress.questions).some((p) => p.last || p.seenAt !== undefined || p.favorite || p.flagged);
}

// ---- Listas de repaso, agrupadas por unidad ----

export type ReviewList = 'falladas' | 'marcadas' | 'favoritas';

export interface ReviewRow {
  unitId: string;
  question: Question; // primera copia que coincide
  copies: Question[];
  state: StudyState;
  progress: QuestionProgress | undefined;
}

export function reviewListIds(questions: Question[], progress: ProgressState, list: ReviewList): Question[] {
  const qs = progress.questions;
  return questions.filter((q) => {
    const p = qs[q.id];
    if (list === 'falladas') return p?.lastGraded?.outcome === 'incorrect';
    if (list === 'marcadas') return !!p?.flagged;
    return !!p?.favorite;
  });
}

export function groupByUnit(list: Question[], idx: BankIndexes, progress: ProgressState): ReviewRow[] {
  const rows = new Map<string, ReviewRow>();
  for (const q of list) {
    const u = idx.unitOf.get(q.id) ?? q.id;
    const r = rows.get(u);
    if (r) r.copies.push(q);
    else rows.set(u, { unitId: u, question: q, copies: [q], state: getStudyState(progress.questions[q.id]), progress: progress.questions[q.id] });
  }
  return [...rows.values()];
}
