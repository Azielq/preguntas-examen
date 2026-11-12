import { describe, expect, it } from 'vitest';
import { applyAttempt } from '../state/progressStore';
import { loadedBank } from '../test/bankFixture';
import { buildExport, parseImport } from './exportImport';
import { DEFAULT_PREFS, emptyProgress, type AttemptsState } from './schema';

const bank = loadedBank();
const ref = { bankVersion: bank.manifest.bankVersion, hashOf: (id: string) => bank.indexes.byId.get(id)?.contentHash };

describe('exportar / importar', () => {
  it('ida y vuelta sin pérdida', () => {
    let progress = emptyProgress(bank.manifest.bankVersion);
    progress = applyAttempt(progress, bank.indexes.byId.get('gor-cap1-0001')!, ['C'], 'correct', 'practice', 1000);
    progress = applyAttempt(progress, bank.indexes.byId.get('msr-a080')!, ['B'], 'incorrect', 'exam', 2000);
    progress.questions['msr-a080']!.flagged = true;
    progress.lastPractice = { filter: { section: 'cap1' }, questionId: 'gor-cap1-0001', at: 1000 };
    const attempts: AttemptsState = {
      schemaVersion: 1,
      attempts: [
        {
          id: 'ex-1',
          bankVersion: bank.manifest.bankVersion,
          config: { source: 'messer', count: 1, timerMinutes: 1, includeAiProposed: false },
          startedAt: 1,
          finishedAt: 2,
          elapsedMs: 1,
          endedBy: 'user',
          items: [{ questionId: 'msr-a080', contentHash: bank.indexes.byId.get('msr-a080')!.contentHash, selected: ['B'], flagged: false, correct: ['B', 'C'], result: 'incorrect' }],
          totals: { scorable: 1, correct: 0, incorrect: 1, omitted: 0 },
        },
      ],
    };
    const prefs = { ...DEFAULT_PREFS, theme: 'dark' as const };
    const file = JSON.stringify(buildExport(prefs, progress, attempts, new Date(0)));
    // "borrar": el estado nuevo vendrá solo del archivo
    const r = parseImport(file, ref);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.progress).toEqual(progress);
    expect(r.attempts).toEqual(attempts);
    expect(r.prefs).toEqual(prefs);
    expect(r.summary).toEqual({ questions: 2, attempts: 1 });
  });

  it('rechaza archivos ajenos o inválidos', () => {
    expect(parseImport('no json', ref)).toMatchObject({ ok: false });
    expect(parseImport(JSON.stringify({ app: 'otra' }), ref)).toMatchObject({ ok: false });
    expect(parseImport(JSON.stringify({ app: 'secplus', schemaVersion: 9 }), ref)).toMatchObject({ ok: false });
    expect(parseImport(JSON.stringify({ app: 'secplus', schemaVersion: 1, progress: {}, attempts: {} }), ref)).toMatchObject({ ok: false });
  });

  it('al importar un progreso de otro banco, se reconcilia', () => {
    const old = { ...emptyProgress('viejo'), questions: { 'gor-cap1-0001': { contentHash: 'distinto', attempts: 1, correctCount: 1, incorrectCount: 0 } } };
    const r = parseImport(JSON.stringify(buildExport(DEFAULT_PREFS, old, { schemaVersion: 1, attempts: [] })), ref);
    expect(r.ok && r.progress.questions['gor-cap1-0001']?.contentChanged).toBe(true);
    expect(r.ok && r.reconcile.changed).toBe(1);
  });
});
