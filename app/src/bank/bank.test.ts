import { describe, expect, it } from 'vitest';
import { isScorable } from '../grading/grade';
import { examCandidates } from '../grading/buildExam';
import { loadedBank, readRaw } from '../test/bankFixture';
import { getAnswerState } from './selectors';
import { validateQuestions } from './validate';

describe('banco cargado', () => {
  const bank = loadedBank();
  const { report } = readRaw();
  const sum = (k: 'found' | 'scorable' | 'pending') => report.stats.gorgotsias[k] + report.stats.messer[k];

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

  it('unidades de duplicados: 586 en total y 583 con al menos una copia puntuable', () => {
    // unidades = preguntas - preguntas en grupos + grupos (dato del reporte)
    const expectedUnits = sum('found') - report.questionsInIdenticalDuplicateGroups + report.identicalDuplicateGroups;
    expect(bank.indexes.units.size).toBe(expectedUnits);
    expect(bank.indexes.units.size).toBe(586);
    const withScorable = [...bank.indexes.units.values()].filter((u) => u.members.some((id) => isScorable(bank.indexes.byId.get(id)!)));
    expect(withScorable.length).toBe(583);
    expect(examCandidates(bank.questions, bank.indexes.units, bank.indexes.byId, { source: 'both', includeAiProposed: false }).length).toBe(583);
    // ninguna unidad cruza documentos
    for (const u of bank.indexes.units.values()) expect(new Set(u.members.map((id) => bank.indexes.byId.get(id)!.doc)).size).toBe(1);
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
