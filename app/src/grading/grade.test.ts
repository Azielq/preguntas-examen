import { describe, expect, it } from 'vitest';
import { aiProposedFixture, loadedBank } from '../test/bankFixture';
import { grade, gradeAgainst, isScorable, optionStates } from './grade';

const bank = loadedBank();
const q = (id: string) => bank.indexes.byId.get(id)!;

describe('grade: selección única', () => {
  it('gor-cap1-0001 (C) correcta e incorrecta', () => {
    expect(grade(q('gor-cap1-0001'), ['C'])).toEqual({ kind: 'correct' });
    expect(grade(q('gor-cap1-0001'), ['B'])).toEqual({ kind: 'incorrect' });
    expect(grade(q('gor-cap1-0001'), [])).toEqual({ kind: 'omitted' });
    expect(grade(q('gor-cap1-0001'), ['C', 'B'])).toEqual({ kind: 'incorrect' });
  });
});

describe('grade: selección múltiple todo o nada (msr-a080, B y C)', () => {
  const m = q('msr-a080');
  it('es múltiple con 5 opciones', () => {
    expect(m.selectionType).toBe('multiple');
    expect(m.options.map((o) => o.letter)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(m.correct).toEqual(['B', 'C']);
  });
  it.each([
    [['B', 'C'], 'correct'],
    [['C', 'B'], 'correct'],
    [['B'], 'incorrect'],
    [['B', 'C', 'D'], 'incorrect'],
    [['A', 'C'], 'incorrect'],
    [['B', 'B'], 'incorrect'],
    [[], 'omitted'],
  ])('%j → %s', (sel, kind) => {
    expect(grade(m, sel as string[]).kind).toBe(kind);
  });
});

describe('no puntuables', () => {
  it('pendiente de revisión → ungraded (sin mirar correct)', () => {
    const p = q('gor-cap1-0023');
    expect(isScorable(p)).toBe(false);
    expect(grade(p, p.correct)).toEqual({ kind: 'ungraded', reason: 'pending_review' });
  });
  it('scorable:false → ungraded aunque todo lo demás esté bien', () => {
    const x = { ...q('gor-cap1-0001'), scorable: false };
    expect(grade(x, ['C'])).toEqual({ kind: 'ungraded', reason: 'not_scorable' });
  });
  it('answerStatus desconocido → ungraded', () => {
    const x = { ...q('gor-cap1-0001'), answerStatus: 'raro' as never };
    expect(grade(x, ['C']).kind).toBe('ungraded');
  });
  it('correct con letra inexistente → no puntuable', () => {
    expect(isScorable({ ...q('gor-cap1-0001'), correct: ['Z'] })).toBe(false);
    expect(isScorable({ ...q('gor-cap1-0001'), correct: [] })).toBe(false);
  });
  it('fixture ai_proposed es puntuable', () => {
    expect(isScorable(aiProposedFixture())).toBe(true);
    expect(grade(aiProposedFixture(), ['B']).kind).toBe('correct');
  });
  it('las 8 pendientes del banco nunca son puntuables', () => {
    const pend = bank.questions.filter((x) => x.review.status === 'pending');
    expect(pend.length).toBe(8);
    expect(pend.every((x) => !isScorable(x))).toBe(true);
  });
});

describe('optionStates', () => {
  it('elegida correcta/errónea, correcta no elegida, resto idle', () => {
    const m = q('msr-a080');
    const st = optionStates(m, m.correct, ['B', 'D'], gradeAgainst('multiple', m.correct, ['B', 'D']));
    expect(st).toEqual({ A: 'idle', B: 'correct', C: 'missed', D: 'incorrect', E: 'idle' });
  });
  it('ungraded → todas neutral-locked', () => {
    const p = q('gor-cap1-0023');
    const st = optionStates(p, p.correct, ['A'], grade(p, ['A']));
    expect(Object.values(st).every((x) => x === 'neutral-locked')).toBe(true);
  });
});
