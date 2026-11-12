import { describe, expect, it } from 'vitest';
import { reconcile, reconcileMessage, type BankRef } from './reconcile';
import type { AttemptsState, ExamActive, ProgressState } from './schema';

const bankV2: BankRef = {
  bankVersion: 'v2',
  hashOf: (id) => ({ a: 'ha', b: 'hb-new', c: 'hc' })[id],
};

const progress = (): ProgressState => ({
  schemaVersion: 1,
  bankVersion: 'v1',
  questions: {
    a: { contentHash: 'ha', attempts: 2, correctCount: 1, incorrectCount: 1, last: { selected: ['A'], outcome: 'correct', at: 5, mode: 'practice' }, lastGraded: { outcome: 'correct', at: 5 } },
    b: {
      contentHash: 'hb-old',
      attempts: 3,
      correctCount: 0,
      incorrectCount: 3,
      favorite: true,
      flagged: true,
      seenAt: 1,
      last: { selected: ['B'], outcome: 'incorrect', at: 9, mode: 'exam' },
      lastGraded: { outcome: 'incorrect', at: 9 },
    },
    gone: { contentHash: 'hx', attempts: 1, correctCount: 1, incorrectCount: 0 },
  },
});

const exam = (hashB: string): ExamActive => ({
  schemaVersion: 1,
  id: 'e1',
  bankVersion: 'v1',
  config: { source: 'both', count: 2, timerMinutes: null, includeAiProposed: false },
  startedAt: 0,
  items: [
    { questionId: 'a', contentHash: 'ha', selected: [], flagged: false },
    { questionId: 'b', contentHash: hashB, selected: ['A'], flagged: false },
  ],
  currentIndex: 0,
  remainingMs: null,
  elapsedMs: 0,
});

describe('reconcile (cambio de bankVersion / contentHash)', () => {
  it('mismo bankVersion: no cambia nada', () => {
    const p = { ...progress(), bankVersion: 'v2' };
    const r = reconcile(p, null, bankV2);
    expect(r.progress).toBe(p);
    expect(r.versionChanged).toBe(false);
    expect(reconcileMessage(r)).toBeNull();
  });

  it('hash igual: se conserva intacto', () => {
    const r = reconcile(progress(), null, bankV2);
    expect(r.progress.questions.a).toEqual(progress().questions.a);
    expect(r.progress.bankVersion).toBe('v2');
  });

  it('hash distinto: reinicia historial, conserva favorita y marca, activa contentChanged', () => {
    const r = reconcile(progress(), null, bankV2);
    const b = r.progress.questions.b!;
    expect(b).toMatchObject({ contentHash: 'hb-new', attempts: 0, correctCount: 0, incorrectCount: 0, favorite: true, flagged: true, contentChanged: true });
    expect(b.last).toBeUndefined();
    expect(b.lastGraded).toBeUndefined();
    expect(r.changed).toBe(1);
  });

  it('id inexistente: pasa a orphans', () => {
    const r = reconcile(progress(), null, bankV2);
    expect(r.progress.questions.gone).toBeUndefined();
    expect(r.progress.orphans?.gone).toEqual(progress().questions.gone);
    expect(r.removed).toBe(1);
    expect(reconcileMessage(r)).toBe('El banco se actualizó: 1 pregunta cambió y reinició su historial; 1 ya no existe.');
  });

  it('examen activo compatible se conserva; incompatible se descarta', () => {
    const ok = reconcile(progress(), exam('hb-new'), bankV2);
    expect(ok.examActive?.items.length).toBe(2);
    expect(ok.examDiscarded).toBe(false);
    const bad = reconcile(progress(), exam('hb-old'), bankV2);
    expect(bad.examActive).toBeNull();
    expect(bad.examDiscarded).toBe(true);
  });

  it('los intentos históricos no se tocan (reconcile no los recibe ni los muta)', () => {
    const attempts: AttemptsState = { schemaVersion: 1, attempts: [] };
    const snapshot = JSON.stringify(attempts);
    reconcile(progress(), null, bankV2);
    expect(JSON.stringify(attempts)).toBe(snapshot);
  });

  it('es pura: no muta la entrada', () => {
    const p = progress();
    const snap = JSON.stringify(p);
    reconcile(p, exam('hb-old'), bankV2);
    expect(JSON.stringify(p)).toBe(snap);
  });
});
