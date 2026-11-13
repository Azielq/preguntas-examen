// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { deriveBank } from '../../src/features/exam/analysisData';
import { loadedBank } from '../../src/test/bankFixture';
import { chapterMap, chapterOf } from './chapters';
import type { ModelOutput } from './contract';
import { deriveAnalysis, selectPractice, type DeriveInput } from './derive';
import { validOutput } from './fixtures';
import { compareRanked, priorityLevel, type Ranked } from './priority';

const bank = loadedBank();
const db = deriveBank(bank);
const byId = new Map(bank.questions.map((q) => [q.id, q]));

describe('chapterOf', () => {
  it('capítulo propio, simulacro vía copia y Messer sin capítulo', () => {
    expect(chapterOf(byId.get('gor-cap1-0001')!, byId)).toBe('cap1');
    expect(chapterOf(byId.get('msr-a080')!, byId)).toBeNull();
    const sim = bank.questions.find((q) => q.group === 'sim' && q.duplicates.some((d) => d.startsWith('gor-cap3')))!;
    expect(chapterOf(sim, byId)).toBe('cap3');
  });

  it('con el banco real: 599 de 600 preguntas de simulacro tienen capítulo; las 45 de Messer no', () => {
    const m = chapterMap(bank.questions);
    const sims = bank.questions.filter((q) => q.group === 'sim');
    expect(sims.length).toBe(600);
    expect(sims.filter((q) => m.get(q.id)).length).toBe(599);
    expect(bank.questions.filter((q) => q.doc === 'messer').every((q) => m.get(q.id) === null)).toBe(true);
  });
});

describe('prioridad (tabla 7.2)', () => {
  const p = (I: number, O: number, R: number, f: number | null, n = I + O) => priorityLevel({ I, O, R, f, n });
  it.each([
    ['I ≥ 3', p(3, 0, 0, null), 'alta'],
    ['I ≥ 2 y R ≥ 1', p(2, 0, 1, null), 'alta'],
    ['R ≥ 2', p(1, 1, 2, null), 'alta'],
    ['I ≥ 2 y f ≥ 0,5', p(2, 0, 0, 0.5), 'alta'],
    ['I = 2, f < 0,5 → media (I + O ≥ 2)', p(2, 0, 0, 0.4), 'media'],
    ['I + O ≥ 2', p(1, 1, 0, null), 'media'],
    ['R ≥ 1 (una pregunta recurrente)', p(1, 0, 1, null), 'media'],
    ['una sola pregunta sin recurrencia → baja aunque f ≥ 0,5', p(1, 0, 0, 0.8), 'baja'],
    ['una sola pregunta → baja', p(1, 0, 0, 0.1), 'baja'],
    ['solo omitidas con R ≥ 2 → tope media', p(0, 3, 2, 0.9), 'media'],
    ['solo omitidas, 2 → media', p(0, 2, 0, null), 'media'],
    ['una omitida → baja', p(0, 1, 0, null), 'baja'],
  ])('%s', (_n, got, want) => expect(got).toBe(want));

  it('orden: nivel, luego R, I, O, f descendentes y id', () => {
    const r = (id: string, level: Ranked['level'], R: number, I: number, O: number, f: number | null): Ranked => ({ id, level, R, I, O, f, n: I + O });
    const list = [r('c5', 'baja', 0, 1, 0, null), r('c2', 'alta', 0, 3, 0, null), r('c1', 'alta', 1, 2, 0, null), r('c4', 'media', 0, 1, 1, 0.5), r('c3', 'media', 0, 1, 1, 0.6), r('c0', 'media', 0, 1, 1, 0.6)];
    expect(list.sort(compareRanked).map((x) => x.id)).toEqual(['c1', 'c2', 'c0', 'c3', 'c4', 'c5']);
  });
});

function input(output: ModelOutput, items: DeriveInput['items'], progress: DeriveInput['progress'] = {}): DeriveInput {
  return { output, items, bank: db, progress };
}

describe('selección de práctica (sección 10)', () => {
  const items: DeriveInput['items'] = [
    { questionId: 'gor-cap1-0001', result: 'correct' },
    { questionId: 'gor-cap1-0002', result: 'incorrect' },
    { questionId: 'gor-cap1-0003', result: 'omitted' },
    { questionId: 'msr-a052', result: 'incorrect' },
    { questionId: 'gor-cap2-0111', result: 'correct' },
  ];

  it('excluye las unidades del intento, una por unidad, máximo 8 por concepto, determinista', () => {
    const out = validOutput();
    const a = selectPractice(input(out, items), ['c1']);
    const b = selectPractice(input(out, items), ['c1']);
    expect(a).toEqual(b);
    const ids = a.practiceByConcept.c1!;
    expect(ids.length).toBe(8);
    const attemptUnits = new Set(items.map((i) => db.unitOf(i.questionId)));
    expect(ids.every((id) => byId.get(id)!.section === 'cap1' && byId.get(id)!.group === 'cap' && db.isScorable(id))).toBe(true);
    expect(ids.some((id) => attemptUnits.has(db.unitOf(id)))).toBe(false);
    expect(new Set(ids.map((id) => db.unitOf(id))).size).toBe(ids.length);
    // sin las pendientes de cap1
    expect(ids.some((id) => ['gor-cap1-0023', 'gor-cap1-0024', 'gor-cap1-0026'].includes(id))).toBe(false);
  });

  it('primero las falladas en el progreso, luego sin responder', () => {
    const progress = { 'gor-cap1-0050': { incorrectCount: 1, last: {}, lastGraded: { outcome: 'incorrect' as const } }, 'gor-cap1-0004': { incorrectCount: 0, last: {}, lastGraded: { outcome: 'correct' as const } } };
    const ids = selectPractice(input(validOutput(), items, progress), ['c1']).practiceByConcept.c1!;
    expect(ids[0]).toBe('gor-cap1-0050');
    expect(ids).not.toContain('gor-cap1-0004');
  });

  it('tope global de 20 intercalado por prioridad y sin candidatas (sin capítulo ni objetivo) → lista vacía', () => {
    const out = validOutput();
    out.concepts = ['cap1', 'cap2', 'cap3', 'cap4'].map((sec, i) => ({ ...validOutput().concepts[0]!, id: `c${i}`, questionIds: [bank.questions.find((q) => q.section === sec && q.id.endsWith('0005') === false && q.group === 'cap')!.id], questionNotes: [] }));
    const r = selectPractice(input(out, items), ['c0', 'c1', 'c2', 'c3']);
    expect(r.practiceIds.length).toBe(20);
    expect(r.practiceIds.slice(0, 4).map((id) => byId.get(id)!.section)).toEqual(['cap1', 'cap2', 'cap3', 'cap4']);
    // una pregunta sin capítulo y sin objetivo SY0-701 en su unidad no aporta candidatas
    const noTheme = bank.questions.find((q) => q.group === 'sim' && chapterOf(q, byId) === null)!;
    const messer = validOutput();
    messer.concepts[0]!.questionIds = [noTheme.id];
    const m = selectPractice(input(messer, items), ['c1']);
    expect(m.practiceByConcept.c1).toEqual([]);
    expect(m.practiceIds).toEqual([]);
  });

  it('el extracto de Messer toma el objetivo SY0-701 de su copia del libro completo: candidatas solo del libro completo', () => {
    const messer = validOutput();
    messer.concepts[0]!.questionIds = ['msr-a052'];
    const m = selectPractice(input(messer, items), ['c1']);
    const code = (id: string) => { const o = byId.get(id)!.objective; return o && 'code' in o ? o.code : null; };
    expect(m.practiceByConcept.c1!.length).toBeGreaterThan(0);
    for (const id of m.practiceByConcept.c1!) {
      expect(byId.get(id)!.doc).toBe('messerfull');
      expect(code(id)).toBe(code('msf-a052'));
    }
  });
});

describe('deriveAnalysis', () => {
  it('fortalezas por capítulo (≥ 5 y ≥ 80 %), avances y prioridad con números reales', () => {
    const cap3 = bank.questions.filter((q) => q.section === 'cap3').slice(0, 5);
    const items: DeriveInput['items'] = [...cap3.map((q) => ({ questionId: q.id, result: 'correct' as const })), { questionId: 'gor-cap1-0002', result: 'incorrect' }, { questionId: 'gor-cap1-0003', result: 'omitted' }];
    const progress = { [cap3[0]!.id]: { incorrectCount: 1, last: {}, lastGraded: { outcome: 'correct' as const } }, 'gor-cap1-0002': { incorrectCount: 2, last: {}, lastGraded: { outcome: 'incorrect' as const } } };
    const out = validOutput();
    out.strengths = [];
    const d = deriveAnalysis(input(out, items, progress));
    expect(d.chapterStrengths).toEqual([{ section: 'cap3', correct: 5, total: 5 }]);
    expect(d.improvedIds).toEqual([cap3[0]!.id]);
    expect(d.priorities.c1).toEqual({ level: 'media', I: 1, O: 1, R: 1, f: null, chapter: 'cap1' });
    expect(d.order).toEqual(['c1']);
  });
});
