/**
 * Carga el banco real desde disco para tests (node). No se empaqueta en producción.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildIndexes } from '../bank/indexes';
import type { Explanation, Fragment, ImportReport, LoadedBank, Manifest, PbqSolution, Question } from '../bank/types';

export const ROOT = resolve(__dirname, '..', '..');

type RawQuestion = Question & { explanation: Explanation; fragment: Fragment };
export interface RawBank {
  bankVersion: string;
  generatedAt: string;
  documents: Manifest['documents'];
  questions: RawQuestion[];
  pbq: PbqSolution[];
}

let cache: { raw: RawBank; report: ImportReport; manifest: Manifest } | null = null;

export function readRaw() {
  if (!cache) {
    const raw = JSON.parse(readFileSync(join(ROOT, 'data', 'bank.json'), 'utf8')) as RawBank;
    const report = JSON.parse(readFileSync(join(ROOT, 'data', 'import-report.json'), 'utf8')) as ImportReport;
    const manifest = JSON.parse(readFileSync(join(ROOT, 'public', 'bank', 'manifest.json'), 'utf8')) as Manifest;
    cache = { raw, report, manifest };
  }
  return cache;
}

export function coreQuestions(): Question[] {
  return readRaw().raw.questions.map((q) => {
    const { explanation: _e, fragment: _f, ...rest } = q;
    return rest as Question;
  });
}

export function loadedBank(): LoadedBank {
  const questions = coreQuestions();
  return { manifest: readRaw().manifest, questions, indexes: buildIndexes(questions) };
}

export function explanationsMap(): Record<string, Explanation> {
  return Object.fromEntries(readRaw().raw.questions.map((q) => [q.id, q.explanation]));
}

export function fragmentsBySection(): Record<string, Record<string, Fragment>> {
  const out: Record<string, Record<string, Fragment>> = {};
  for (const q of readRaw().raw.questions) (out[q.section] ??= {})[q.id] = q.fragment;
  return out;
}

/** Pregunta ficticia `ai_proposed` SOLO para tests. */
export function aiProposedFixture(): Question {
  return {
    id: 'test-ai-0001',
    doc: 'messer',
    group: 'pe-a',
    section: 'pe-a',
    topic: 'Practice Exam A',
    number: 999,
    originalLabel: 'T1',
    page: 1,
    printedPage: 1,
    stem: [{ type: 'text', text: 'Fixture stem (test only).' }],
    options: [
      { id: 'test-ai-0001-A', letter: 'A', text: 'Alpha' },
      { id: 'test-ai-0001-B', letter: 'B', text: 'Beta' },
    ],
    selectionType: 'single',
    correct: ['B'],
    answerStatus: 'ai_proposed',
    answerSource: { doc: 'messer', page: 1, printedPage: 1, kind: 'quick_key' },
    review: { status: 'ok', reasons: [], notes: [] },
    duplicates: [],
    similar: [],
    scorable: true,
    contentHash: 'fixture00',
  };
}
