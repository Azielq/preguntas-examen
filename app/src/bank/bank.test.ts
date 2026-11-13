import { describe, expect, it } from 'vitest';
import { isScorable } from '../grading/grade';
import { examCandidates } from '../grading/buildExam';
import { loadedBank, readRaw } from '../test/bankFixture';
import { getAnswerState } from './selectors';
import { validateQuestions } from './validate';

describe('banco cargado', () => {
  const bank = loadedBank();
  const { report } = readRaw();
  const sum = (k: 'found' | 'scorable' | 'pending') => Object.values(report.stats).reduce((n, d) => n + d[k], 0);

  it('pasa la validación sin problemas', () => {
    expect(validateQuestions(bank.questions)).toEqual([]);
  });

  it('cantidades coinciden con import-report.json', () => {
    expect(bank.questions.length).toBe(sum('found'));
    expect(bank.questions.filter(isScorable).length).toBe(sum('scorable'));
    const pending = bank.questions.filter((q) => q.review.status === 'pending').map((q) => q.id);
    expect(pending.length).toBe(sum('pending'));
    expect(pending.sort()).toEqual(report.pending.map((p) => p.id).sort());
    expect(bank.questions.filter((q) => getAnswerState(q) === 'pending').length).toBe(report.pending.length);
  });

  it('unidades de duplicados: 796 en total y 793 con al menos una copia puntuable', () => {
    // unidades = preguntas - preguntas en grupos + grupos (dato del reporte)
    const expectedUnits = sum('found') - report.questionsInIdenticalDuplicateGroups + report.identicalDuplicateGroups;
    expect(bank.indexes.units.size).toBe(expectedUnits);
    expect(bank.indexes.units.size).toBe(796);
    const withScorable = [...bank.indexes.units.values()].filter((u) => u.members.some((id) => isScorable(bank.indexes.byId.get(id)!)));
    expect(withScorable.length).toBe(793);
    expect(examCandidates(bank.questions, bank.indexes.units, bank.indexes.byId, { source: 'both', includeAiProposed: false }).length).toBe(793);
    // las únicas unidades que cruzan documentos son las 45 del extracto de Messer con su copia del libro completo
    const cross = [...bank.indexes.units.values()].filter((u) => new Set(u.members.map((id) => bank.indexes.byId.get(id)!.doc)).size > 1);
    expect(cross).toHaveLength(45);
    for (const u of cross) expect(u.members.map((id) => bank.indexes.byId.get(id)!.doc).sort()).toEqual(['messer', 'messerfull']);
  });

  it('el validador detecta problemas estructurales', () => {
    const q = structuredClone(bank.questions[0]!);
    const bad = [q, { ...q }, { ...q, id: 'x', correct: ['Z'] }, { ...q, id: 'y', stem: [] }, { ...q, id: 'z', selectionType: 'otro' }];
    const p = validateQuestions(bad);
    expect(p.some((x) => x.includes('id repetido'))).toBe(true);
    expect(p.some((x) => x.includes('correct no es subconjunto'))).toBe(true);
    expect(p.some((x) => x.includes('enunciado vacío'))).toBe(true);
    expect(p.some((x) => x.includes('selectionType'))).toBe(true);
  });
});
