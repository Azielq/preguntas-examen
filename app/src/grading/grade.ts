import type { Letter, Question } from '../bank/types';

export type GradeResult =
  | { kind: 'correct' }
  | { kind: 'incorrect' }
  | { kind: 'omitted' }
  | { kind: 'ungraded'; reason: 'pending_review' | 'not_scorable' | 'unknown_status' };

export type OptionState = 'idle' | 'selected' | 'correct' | 'incorrect' | 'missed' | 'neutral-locked';

/** Puntuable solo si el banco lo dice y todo es coherente. Nunca "asciende" una pregunta. */
export function isScorable(q: Question): boolean {
  if (q.scorable !== true) return false;
  if (q.review?.status !== 'ok') return false;
  if (q.answerStatus !== 'pdf' && q.answerStatus !== 'ai_proposed') return false;
  if (!Array.isArray(q.correct) || q.correct.length < 1) return false;
  const letters = new Set(q.options.map((o) => o.letter));
  return q.correct.every((l) => letters.has(l));
}

function ungradedReason(q: Question): 'pending_review' | 'not_scorable' | 'unknown_status' {
  if (q.review?.status === 'pending') return 'pending_review';
  if (q.answerStatus !== 'pdf' && q.answerStatus !== 'ai_proposed' && q.answerStatus !== 'pending') return 'unknown_status';
  return 'not_scorable';
}

export function grade(q: Question, selected: Letter[]): GradeResult {
  if (!isScorable(q)) return { kind: 'ungraded', reason: ungradedReason(q) };
  return gradeAgainst(q.selectionType, q.correct, selected);
}

/** Corrige contra una clave explícita (usado también para intentos guardados). */
export function gradeAgainst(type: 'single' | 'multiple', correct: Letter[], selected: Letter[]): GradeResult {
  if (selected.length === 0) return { kind: 'omitted' };
  if (type === 'single') {
    return selected.length === 1 && selected[0] === correct[0] ? { kind: 'correct' } : { kind: 'incorrect' };
  }
  // Múltiple: todo o nada; sin distinguir orden.
  const s = new Set(selected);
  const c = new Set(correct);
  if (s.size !== c.size || s.size !== selected.length) return { kind: 'incorrect' };
  for (const l of s) if (!c.has(l)) return { kind: 'incorrect' };
  return { kind: 'correct' };
}

/** Estado visual de cada opción tras corregir (por letra). */
export function optionStates(q: Pick<Question, 'options'>, correct: Letter[], selected: Letter[], result: GradeResult): Record<Letter, OptionState> {
  const out: Record<Letter, OptionState> = {};
  for (const o of q.options) {
    if (result.kind === 'ungraded') {
      out[o.letter] = 'neutral-locked';
      continue;
    }
    const sel = selected.includes(o.letter);
    const cor = correct.includes(o.letter);
    out[o.letter] = sel && cor ? 'correct' : sel ? 'incorrect' : cor ? 'missed' : 'idle';
  }
  return out;
}
