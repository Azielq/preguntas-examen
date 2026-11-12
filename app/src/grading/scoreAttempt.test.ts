import { describe, expect, it } from 'vitest';
import { loadedBank } from '../test/bankFixture';
import { formatPercent, scoreAttempt } from './scoreAttempt';
import type { ExamItem } from './types';

const bank = loadedBank();
const { byId } = bank.indexes;
const item = (id: string, selected: string[]): ExamItem => ({ questionId: id, contentHash: byId.get(id)!.contentHash, selected, flagged: false });

describe('scoreAttempt', () => {
  it('correctas + incorrectas + omitidas = puntuables; msr-a080 parcial cuenta como incorrecta', () => {
    const items = [item('gor-cap1-0001', ['C']), item('gor-cap1-0002', []), item('msr-a080', ['B']), item('msr-a046', byId.get('msr-a046')!.correct)];
    const r = scoreAttempt(items, byId);
    expect(r.totals).toEqual({ scorable: 4, correct: 2, incorrect: 1, omitted: 1 });
    expect(r.totals.correct + r.totals.incorrect + r.totals.omitted).toBe(r.totals.scorable);
    expect(r.items.find((i) => i.questionId === 'msr-a080')!.result).toBe('incorrect');
    expect(r.items.find((i) => i.questionId === 'msr-a080')!.correct).toEqual(['B', 'C']);
  });

  it('msr-a080 completa (C,B) es correcta', () => {
    expect(scoreAttempt([item('msr-a080', ['C', 'B'])], byId).totals.correct).toBe(1);
  });

  it('excluye del denominador lo no puntuable o con hash cambiado', () => {
    const items = [item('gor-cap1-0001', ['C']), item('gor-cap1-0023', ['C']), { ...item('gor-cap1-0002', ['A']), contentHash: 'otro' }];
    const r = scoreAttempt(items, byId);
    expect(r.totals.scorable).toBe(1);
    expect(r.notScored.map((i) => i.questionId)).toEqual(['gor-cap1-0023', 'gor-cap1-0002']);
  });

  it('porcentaje con un decimal y coma; sin puntuables no hay porcentaje', () => {
    expect(formatPercent(37, 45)).toBe('82,2 %');
    expect(formatPercent(0, 0)).toBeNull();
  });
});
