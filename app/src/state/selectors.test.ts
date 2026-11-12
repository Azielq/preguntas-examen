import { describe, expect, it } from 'vitest';
import { isScorable } from '../grading/grade';
import { emptyProgress, type ProgressState } from '../storage/schema';
import { loadedBank } from '../test/bankFixture';
import { applyAttempt } from './progressStore';
import { filterQuestions, getStudyState, groupByUnit, progressStats, reviewListIds } from './selectors';

const bank = loadedBank();
const Q = (id: string) => bank.indexes.byId.get(id)!;
const attempts = { schemaVersion: 1 as const, attempts: [] };
const ctx = (progress: ProgressState) => ({ questions: bank.questions, progress, attempts });

function sampleProgress(): ProgressState {
  let p = emptyProgress(bank.manifest.bankVersion);
  p = applyAttempt(p, Q('gor-cap1-0001'), ['C'], 'correct', 'practice', 1);
  p = applyAttempt(p, Q('gor-cap1-0002'), ['A'], 'incorrect', 'practice', 2);
  p = applyAttempt(p, Q('msr-a080'), ['B'], 'incorrect', 'exam', 3);
  p = applyAttempt(p, Q('gor-cap1-0023'), ['C'], 'ungraded', 'practice', 4);
  p.questions['gor-cap2-0111'] = { contentHash: Q('gor-cap2-0111').contentHash, attempts: 0, correctCount: 0, incorrectCount: 0, flagged: true, favorite: true };
  p.questions['gor-cap1-0003'] = { contentHash: Q('gor-cap1-0003').contentHash, attempts: 0, correctCount: 0, incorrectCount: 0, seenAt: 5 };
  return p;
}

describe('filtros de práctica', () => {
  const p = sampleProgress();
  it('Documento y Sección', () => {
    expect(filterQuestions(ctx(p), { doc: 'gorgotsias' }).length).toBe(1140);
    expect(filterQuestions(ctx(p), { doc: 'messer' }).length).toBe(45);
    expect(filterQuestions(ctx(p), { section: 'cap4' }).length).toBe(150);
    expect(filterQuestions(ctx(p), { section: 'sim3', doc: 'gorgotsias' }).length).toBe(100);
  });
  it('Sin responder, Falladas, Marcadas, Pendientes de revisión, Solo favoritas', () => {
    expect(filterQuestions(ctx(p), { state: 'unanswered' }).length).toBe(1185 - 4);
    expect(filterQuestions(ctx(p), { state: 'failed' }).map((q) => q.id)).toEqual(['gor-cap1-0002', 'msr-a080']);
    expect(filterQuestions(ctx(p), { state: 'flagged' }).map((q) => q.id)).toEqual(['gor-cap2-0111']);
    expect(filterQuestions(ctx(p), { state: 'pending_review' }).length).toBe(8);
    expect(filterQuestions(ctx(p), { onlyFavorites: true }).map((q) => q.id)).toEqual(['gor-cap2-0111']);
    expect(filterQuestions(ctx(p), { state: 'pending_review', section: 'cap1' }).map((q) => q.id)).toEqual(['gor-cap1-0023', 'gor-cap1-0024', 'gor-cap1-0026']);
    expect(filterQuestions(ctx(p), { doc: 'messer', state: 'failed' }).map((q) => q.id)).toEqual(['msr-a080']);
  });
  it('lista de un intento: incorrectas y omitidas', () => {
    const at = {
      schemaVersion: 1 as const,
      attempts: [
        {
          id: 'x',
          bankVersion: 'v',
          config: { source: 'both' as const, count: 3, timerMinutes: null, includeAiProposed: false },
          startedAt: 0,
          finishedAt: 0,
          elapsedMs: 0,
          endedBy: 'user' as const,
          items: [
            { questionId: 'gor-cap1-0001', contentHash: '', selected: ['C'], flagged: false, correct: ['C'], result: 'correct' as const },
            { questionId: 'gor-cap1-0005', contentHash: '', selected: ['A'], flagged: false, correct: ['B'], result: 'incorrect' as const },
            { questionId: 'msr-a050', contentHash: '', selected: [], flagged: false, correct: ['B'], result: 'omitted' as const },
          ],
          totals: { scorable: 3, correct: 1, incorrect: 1, omitted: 1 },
        },
      ],
    };
    expect(filterQuestions({ ...ctx(p), attempts: at }, { list: 'attempt:x' }).map((q) => q.id)).toEqual(['gor-cap1-0005', 'msr-a050']);
  });
});

describe('estados de estudio y contadores', () => {
  it('getStudyState distingue los cinco estados', () => {
    const p = sampleProgress();
    expect(getStudyState(p.questions['gor-cap1-0001'])).toBe('correct');
    expect(getStudyState(p.questions['gor-cap1-0002'])).toBe('incorrect');
    expect(getStudyState(p.questions['gor-cap1-0023'])).toBe('ungraded');
    expect(getStudyState(p.questions['gor-cap1-0003'])).toBe('seen');
    expect(getStudyState(undefined)).toBe('unseen');
  });

  it('las estadísticas cuentan solo puntuables; un intento ungraded no cambia aciertos ni errores', () => {
    const base = sampleProgress();
    const before = progressStats(bank.questions, base);
    expect(before.scorable).toBe(bank.questions.filter(isScorable).length);
    expect(before.scorable).toBe(1177);
    expect(before).toMatchObject({ answered: 3, correct: 1, incorrect: 2 });
    const after = progressStats(bank.questions, applyAttempt(base, Q('gor-cap1-0024'), ['A'], 'ungraded', 'practice', 9));
    expect(after).toEqual(before);
  });

  it('fallar agrega a Falladas; acertar después la quita (al recalcular la lista)', () => {
    let p = emptyProgress('v');
    p = applyAttempt(p, Q('gor-cap1-0010'), ['A'], 'incorrect', 'practice', 1);
    expect(reviewListIds(bank.questions, p, 'falladas').map((q) => q.id)).toEqual(['gor-cap1-0010']);
    // la sesión de repaso congela su lista; la pertenencia se recalcula desde el progreso al salir
    const frozen = reviewListIds(bank.questions, p, 'falladas').map((q) => q.id);
    p = applyAttempt(p, Q('gor-cap1-0010'), [Q('gor-cap1-0010').correct[0]!], 'correct', 'review', 2);
    expect(frozen).toEqual(['gor-cap1-0010']);
    expect(reviewListIds(bank.questions, p, 'falladas')).toEqual([]);
    expect(p.questions['gor-cap1-0010']).toMatchObject({ attempts: 2, correctCount: 1, incorrectCount: 1 });
  });

  it('las listas agrupan duplicados por unidad', () => {
    let p = emptyProgress('v');
    p = applyAttempt(p, Q('gor-cap1-0001'), ['A'], 'incorrect', 'practice', 1);
    p = applyAttempt(p, Q('gor-sim1-0092'), ['A'], 'incorrect', 'practice', 2);
    const rows = groupByUnit(reviewListIds(bank.questions, p, 'falladas'), bank.indexes, p);
    expect(rows.length).toBe(1);
    expect(rows[0]!.copies.map((q) => q.id)).toEqual(['gor-cap1-0001', 'gor-sim1-0092']);
  });
});
