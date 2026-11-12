import type { Question } from '../bank/types';
import { grade } from './grade';
import type { ExamItem, ExamTotals, GradedExamItem } from './types';

export interface ScoredAttempt {
  items: GradedExamItem[];
  /** Ítems que al corregir resultaron no puntuables: fuera del denominador. */
  notScored: ExamItem[];
  totals: ExamTotals;
}

export function scoreAttempt(items: ExamItem[], byId: Map<string, Question>): ScoredAttempt {
  const graded: GradedExamItem[] = [];
  const notScored: ExamItem[] = [];
  const totals: ExamTotals = { scorable: 0, correct: 0, incorrect: 0, omitted: 0 };
  for (const it of items) {
    const q = byId.get(it.questionId);
    if (!q || q.contentHash !== it.contentHash) {
      notScored.push(it);
      continue;
    }
    const r = grade(q, it.selected);
    if (r.kind === 'ungraded') {
      notScored.push(it);
      continue;
    }
    totals.scorable += 1;
    totals[r.kind] += 1;
    graded.push({ ...it, correct: q.correct.slice(), result: r.kind });
  }
  return { items: graded, notScored, totals };
}

/** Porcentaje con un decimal y coma decimal; null si no hay puntuables. */
export function formatPercent(correct: number, scorable: number): string | null {
  if (scorable === 0) return null;
  return `${((correct / scorable) * 100).toFixed(1).replace('.', ',')} %`;
}
