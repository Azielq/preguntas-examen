/** Fixtures del análisis con IA para tests del cliente. */
import type { ModelOutput } from '../../shared/analysis/contract';
import { deriveAnalysis } from '../../shared/analysis/derive';
import { validOutput } from '../../shared/analysis/fixtures';
import type { LoadedBank } from '../bank/types';
import { deriveBank } from '../features/exam/analysisData';
import { grade } from '../grading/grade';
import type { ExamAttempt, StoredAnalysis } from '../storage/schema';

export { validOutput };

export type Spec = [string, 'correct' | 'incorrect' | 'omitted'];

export const BASIC: Spec[] = [
  ['gor-cap1-0001', 'correct'],
  ['gor-cap1-0002', 'incorrect'],
  ['gor-cap1-0003', 'omitted'],
  ['msr-a052', 'incorrect'],
  ['gor-cap2-0111', 'correct'],
];

export function makeAttempt(bank: LoadedBank, specs: Spec[] = BASIC, id = 'ex-test-1'): ExamAttempt {
  const items = specs.map(([qid, result]) => {
    const q = bank.indexes.byId.get(qid)!;
    const selected = result === 'correct' ? q.correct.slice() : result === 'incorrect' ? [q.options.find((o) => !q.correct.includes(o.letter))!.letter] : [];
    const r = grade(q, selected);
    if (r.kind !== result) throw new Error(`fixture: ${qid} da ${r.kind}`);
    return { questionId: qid, contentHash: q.contentHash, selected, flagged: false, correct: q.correct.slice(), result };
  });
  return {
    id,
    bankVersion: bank.manifest.bankVersion,
    config: { source: 'both', count: items.length, timerMinutes: null, includeAiProposed: false },
    startedAt: 1_700_000_000_000,
    finishedAt: 1_700_000_600_000,
    elapsedMs: 600_000,
    endedBy: 'user',
    items,
    totals: {
      scorable: items.length,
      correct: items.filter((i) => i.result === 'correct').length,
      incorrect: items.filter((i) => i.result === 'incorrect').length,
      omitted: items.filter((i) => i.result === 'omitted').length,
    },
  };
}

export function storedFor(attempt: ExamAttempt, bank: LoadedBank, output: ModelOutput = validOutput(), over: Partial<StoredAnalysis> = {}): StoredAnalysis {
  const failed = attempt.items.filter((i) => i.result !== 'correct').length;
  return {
    attemptId: attempt.id,
    createdAt: 1_700_000_700_000,
    bankVersion: bank.manifest.bankVersion,
    promptVersion: '2026-11-a',
    analysisSchemaVersion: 1,
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    coverage: { failed, failedAnalyzed: failed, correctSent: attempt.items.length - failed, omitted: attempt.items.filter((i) => i.result === 'omitted').length, notScored: 0 },
    output,
    derived: deriveAnalysis({ output, items: attempt.items, bank: deriveBank(bank), progress: {} }),
    ...over,
  };
}
