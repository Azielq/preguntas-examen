import { describe, expect, it } from 'vitest';
import { loadedBank } from '../test/bankFixture';
import { buildExam, examCandidates, seededRng } from './buildExam';
import { isScorable } from './grade';
import type { ExamConfig } from './types';

const bank = loadedBank();
const { units, byId, unitOf } = bank.indexes;
const cfg = (c: Partial<ExamConfig>): ExamConfig => ({ source: 'both', count: 10000, timerMinutes: null, includeAiProposed: false, ...c });

describe('buildExam', () => {
  it('máximos: Ambos 583, Gorgotsias 538, Messer 45', () => {
    expect(buildExam(bank.questions, units, byId, cfg({}), seededRng(1)).length).toBe(583);
    expect(buildExam(bank.questions, units, byId, cfg({ source: 'gorgotsias' }), seededRng(2)).length).toBe(538);
    expect(buildExam(bank.questions, units, byId, cfg({ source: 'messer' }), seededRng(3)).length).toBe(45);
  });

  for (const seed of [1, 7, 42, 1234, 99999]) {
    it(`semilla ${seed}: sin unidades repetidas, solo puntuables, sin gor-sim6-0514`, () => {
      const items = buildExam(bank.questions, units, byId, cfg({}), seededRng(seed));
      const unitIds = items.map((i) => unitOf.get(i.questionId));
      expect(new Set(unitIds).size).toBe(items.length);
      expect(items.every((i) => isScorable(byId.get(i.questionId)!))).toBe(true);
      expect(items.some((i) => i.questionId === 'gor-sim6-0514')).toBe(false);
      expect(items.every((i) => i.contentHash === byId.get(i.questionId)!.contentHash && i.selected.length === 0 && !i.flagged)).toBe(true);
    });
  }

  it('la unidad de gor-sim6-0514 está representada por gor-cap4-0414', () => {
    expect(unitOf.get('gor-sim6-0514')).toBe(unitOf.get('gor-cap4-0414'));
    const items = buildExam(bank.questions, units, byId, cfg({}), seededRng(5));
    expect(items.some((i) => i.questionId === 'gor-cap4-0414')).toBe(true);
    // aun limitando a sim6, la pendiente no entra
    const sim6 = buildExam(bank.questions, units, byId, cfg({ sections: ['sim6'] }), seededRng(5));
    expect(sim6.some((i) => i.questionId === 'gor-sim6-0514')).toBe(false);
  });

  it('el representante prefiere la copia de capítulo', () => {
    const c = examCandidates(bank.questions, units, byId, { source: 'both', includeAiProposed: false });
    for (const q of c) {
      const u = units.get(unitOf.get(q.id)!)!;
      const capCopies = u.members.map((id) => byId.get(id)!).filter((x) => x.group === 'cap' && isScorable(x));
      if (capCopies.length > 0) expect(q.group).toBe('cap');
    }
  });

  it('la cantidad pedida se respeta y el orden es aleatorio pero reproducible', () => {
    const a = buildExam(bank.questions, units, byId, cfg({ count: 45 }), seededRng(11));
    const b = buildExam(bank.questions, units, byId, cfg({ count: 45 }), seededRng(11));
    const c = buildExam(bank.questions, units, byId, cfg({ count: 45 }), seededRng(12));
    expect(a.length).toBe(45);
    expect(a.map((i) => i.questionId)).toEqual(b.map((i) => i.questionId));
    expect(a.map((i) => i.questionId)).not.toEqual(c.map((i) => i.questionId));
  });

  it('no reordena opciones: los ítems solo referencian ids y el banco queda intacto', () => {
    const before = JSON.stringify(bank.questions.map((q) => q.options));
    buildExam(bank.questions, units, byId, cfg({}), seededRng(3));
    expect(JSON.stringify(bank.questions.map((q) => q.options))).toBe(before);
    for (const q of bank.questions) expect(q.options.map((o) => o.letter)).toEqual([...q.options.map((o) => o.letter)].sort());
  });

  it('limitar a secciones solo toma preguntas de esas secciones', () => {
    const items = buildExam(bank.questions, units, byId, cfg({ source: 'gorgotsias', sections: ['cap1', 'sim2'] }), seededRng(9));
    expect(items.every((i) => ['cap1', 'sim2'].includes(byId.get(i.questionId)!.section))).toBe(true);
  });
});
