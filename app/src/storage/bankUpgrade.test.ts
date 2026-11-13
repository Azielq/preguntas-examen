/**
 * Actualización del banco 3efc5f1a3b → 758483f7ae (tercer documento `messerfull`): el progreso, las favoritas,
 * los intentos, el examen en curso y los análisis de IA guardados con el banco anterior se conservan porque
 * los ids y contentHash de las 1185 preguntas anteriores no cambiaron (PLAN 6.4, PLAN-IA 8.3 y "Ajustes al plan" 3).
 */
import { describe, expect, it } from 'vitest';
import { validateAnalyzeRequest } from '../../shared/analysis/contract';
import { deriveAnalysis } from '../../shared/analysis/derive';
import { bankRef } from '../features/app/bootstrap';
import { buildAnalyzeRequest, changedItems, deriveBank } from '../features/exam/analysisData';
import { buildPlanView } from '../features/exam/studyPlanModel';
import { applyAttempt } from '../state/progressStore';
import { makeAttempt, storedFor, validOutput, type Spec } from '../test/aiFixtures';
import { loadedBank } from '../test/bankFixture';
import { checkStoredAnalysis } from './analyses';
import { reconcile, reconcileMessage } from './reconcile';
import { emptyProgress, type ExamActive, type ProgressState } from './schema';

const OLD = '3efc5f1a3b';
const bank = loadedBank();
const Q = (id: string) => bank.indexes.byId.get(id)!;

function oldProgress(): ProgressState {
  let p = emptyProgress(OLD);
  p = applyAttempt(p, Q('gor-cap1-0001'), ['C'], 'correct', 'practice', 1);
  p = applyAttempt(p, Q('gor-cap1-0002'), ['A'], 'incorrect', 'practice', 2);
  p = applyAttempt(p, Q('msr-a080'), ['B'], 'incorrect', 'exam', 3);
  p = applyAttempt(p, Q('msr-a052'), Q('msr-a052').correct, 'correct', 'review', 4);
  p = applyAttempt(p, Q('gor-cap1-0023'), ['C'], 'ungraded', 'practice', 5);
  p.questions['gor-cap2-0111'] = { contentHash: Q('gor-cap2-0111').contentHash, attempts: 0, correctCount: 0, incorrectCount: 0, flagged: true, favorite: true, seenAt: 6 };
  p.questions['msr-a046'] = { contentHash: Q('msr-a046').contentHash, attempts: 0, correctCount: 0, incorrectCount: 0, favorite: true };
  p.lastPractice = { filter: { doc: 'messer' }, questionId: 'msr-a080', at: 7 };
  return p;
}

describe('cambio de bankVersion por el tercer documento', () => {
  it('el banco actual es 758483f7ae y contiene las preguntas anteriores con los mismos ids', () => {
    expect(bank.manifest.bankVersion).toBe('758483f7ae');
    expect(bank.manifest.bankVersion).not.toBe(OLD);
    for (const id of Object.keys(oldProgress().questions)) expect(bank.indexes.byId.has(id)).toBe(true);
  });

  it('reconcile conserva todo el progreso con el mismo contentHash (historial, favoritas, marcas, última práctica)', () => {
    const before = oldProgress();
    const r = reconcile(before, null, bankRef(bank));
    expect(r.versionChanged).toBe(true);
    expect(r.changed).toBe(0);
    expect(r.removed).toBe(0);
    expect(r.progress.bankVersion).toBe('758483f7ae');
    expect(r.progress.questions).toEqual(before.questions);
    expect(r.progress.orphans).toBeUndefined();
    expect(r.progress.lastPractice).toEqual(before.lastPractice);
    expect(Object.values(r.progress.questions).some((p) => p.contentChanged)).toBe(false);
    expect(reconcileMessage(r)).toBe('El banco se actualizó: 0 preguntas cambiaron y reiniciaron su historial; 0 ya no existen.');
  });

  it('el examen en curso empezado con el banco anterior no se descarta', () => {
    const items = ['gor-cap1-0001', 'msr-a080'].map((id) => ({ questionId: id, contentHash: Q(id).contentHash, selected: ['B'], flagged: false }));
    const active: ExamActive = {
      schemaVersion: 1,
      id: 'e-old',
      bankVersion: OLD,
      config: { source: 'both', count: 2, timerMinutes: 10, includeAiProposed: false },
      startedAt: 0,
      items,
      currentIndex: 1,
      remainingMs: 300_000,
      elapsedMs: 300_000,
    };
    const r = reconcile(emptyProgress(OLD), active, bankRef(bank));
    expect(r.examDiscarded).toBe(false);
    expect(r.examActive).toEqual({ ...active, bankVersion: '758483f7ae' });
  });

  it('un intento del banco anterior sigue siendo analizable: el pedido lleva el bankVersion actual y los hashes guardados', () => {
    const attempt = { ...makeAttempt(bank), bankVersion: OLD };
    expect(changedItems(attempt, bank).size).toBe(0);
    const r = buildAnalyzeRequest(attempt, bank, oldProgress());
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.request.bankVersion).toBe('758483f7ae');
    expect(r.request.attempt.items.map((i) => i.hash)).toEqual(attempt.items.map((i) => i.contentHash));
  });

  it('un análisis guardado con el banco anterior se conserva válido, con chip "Banco anterior" y sin pasar a solo lectura', () => {
    const attempt = { ...makeAttempt(bank), bankVersion: OLD };
    const stored = storedFor(attempt, bank, validOutput(), { bankVersion: OLD });
    expect(checkStoredAnalysis(JSON.parse(JSON.stringify(stored)), attempt).ok).toBe(true);
    const view = buildPlanView(stored, attempt, bank, '2026-11-a');
    expect(view.oldBank).toBe(true);
    expect(view.readOnly).toBe(false);
    expect(view.changedCount).toBe(0);
  });
});

describe('análisis con preguntas del libro completo de Messer', () => {
  const SPECS: Spec[] = [
    ['msf-a014', 'incorrect'], // Select THREE, 7 opciones, viñetas
    ['msf-c054', 'incorrect'], // bloque code, múltiple de 2, 5 opciones
    ['msf-a015', 'omitted'], // bloque code
    ['msf-b039', 'correct'], // múltiple, 6 opciones
    ['gor-cap1-0002', 'incorrect'],
  ];

  it('el pedido se arma con ids, hashes y letras (incluidas F y G) y nada de texto', () => {
    const attempt = makeAttempt(bank, SPECS, 'ex-msf');
    const r = buildAnalyzeRequest(attempt, bank, emptyProgress(bank.manifest.bankVersion));
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    const serialized = JSON.stringify(r.request);
    expect(serialized).not.toContain('insurance company');
    expect(r.request.attempt.items.find((i) => i.id === 'msf-b039')!.selected).toEqual(['A', 'F']);
    // el contrato del servidor acepta los ids del libro completo
    expect(validateAnalyzeRequest(JSON.parse(serialized)).ok).toBe(true);
  });

  it('"Practicar estos temas": las falladas del libro completo aportan preguntas del mismo objetivo SY0-701, fuera del intento', () => {
    const attempt = makeAttempt(bank, SPECS, 'ex-msf');
    const out = validOutput();
    out.concepts = [{ ...out.concepts[0]!, id: 'c1', questionIds: ['msf-a014', 'msf-c054'], questionNotes: [], confusions: [] }];
    out.unassigned = ['gor-cap1-0002', 'msf-a015'];
    out.strengths = [];
    out.keyFlags = [];
    const d = deriveAnalysis({ output: out, items: attempt.items, bank: deriveBank(bank), progress: {} });
    const ids = d.practiceByConcept.c1!;
    expect(ids.length).toBeGreaterThan(0);
    const objectives = new Set(['msf-a014', 'msf-c054'].map((id) => (Q(id).objective as { code: string }).code));
    const attemptUnits = new Set(attempt.items.map((i) => bank.indexes.unitOf.get(i.questionId)));
    expect(ids.every((id) => Q(id).doc === 'messerfull')).toBe(true);
    for (const id of ids) {
      const q = Q(id);
      const own = q.objective && 'code' in q.objective ? q.objective.code : null;
      expect(own && objectives.has(own)).toBe(true);
      expect(attemptUnits.has(bank.indexes.unitOf.get(id))).toBe(false);
    }
  });
});
