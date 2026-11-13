import { describe, expect, it } from 'vitest';
import { useAnalysis, __resetAnalysisStore, readStoredAnalyses } from '../state/analysisStore';
import { makeAttempt, storedFor } from '../test/aiFixtures';
import { loadedBank } from '../test/bankFixture';
import { capAnalyses, pruneOrphans, sanitizeAnalyses } from './analyses';
import { buildExport, parseImport } from './exportImport';
import { KEYS } from './keys';
import { DEFAULT_PREFS, emptyProgress, isAnalysesState, isAttemptsState, type AnalysesState, type AttemptsState } from './schema';

const bank = loadedBank();
const ref = { bankVersion: bank.manifest.bankVersion, hashOf: (id: string) => bank.indexes.byId.get(id)?.contentHash };
const attempt = makeAttempt(bank);
const attempts: AttemptsState = { schemaVersion: 1, attempts: [attempt] };
const state = (): AnalysesState => ({ schemaVersion: 1, byAttempt: { [attempt.id]: storedFor(attempt, bank) } });

describe('persistencia de análisis', () => {
  it('isAnalysesState valida la forma exterior', () => {
    expect(isAnalysesState(state())).toBe(true);
    expect(isAnalysesState({ schemaVersion: 2, byAttempt: {} })).toBe(false);
    expect(isAnalysesState({ schemaVersion: 1 })).toBe(false);
  });

  it('una entrada inválida se descarta sola; una de esquema desconocido se informa como incompatible', () => {
    const s = state();
    const other = makeAttempt(bank, undefined, 'ex-test-2');
    const bad = storedFor(other, bank);
    (bad.output as unknown as Record<string, unknown>).exercises = [];
    const third = makeAttempt(bank, undefined, 'ex-test-3');
    const future = { ...storedFor(third, bank), analysisSchemaVersion: 2 };
    const raw = { schemaVersion: 1, byAttempt: { ...s.byAttempt, [other.id]: bad, [third.id]: future } };
    const r = sanitizeAnalyses(raw, { schemaVersion: 1, attempts: [attempt, other, third] });
    expect(Object.keys(r.state.byAttempt)).toEqual([attempt.id]);
    expect(r.dropped).toBe(2);
    expect(r.incompatible).toEqual([third.id]);
  });

  it('valida contra el intento: un id que no es del intento invalida la entrada', () => {
    const s = state();
    s.byAttempt[attempt.id]!.output.unassigned.push('gor-cap5-0001');
    expect(Object.keys(sanitizeAnalyses(s, attempts).state.byAttempt)).toEqual([]);
  });

  it('tope de 30: se eliminan los más antiguos', () => {
    const byAttempt: AnalysesState['byAttempt'] = {};
    for (let i = 0; i < 35; i++) {
      const a = makeAttempt(bank, undefined, `ex-cap-${i}`);
      byAttempt[a.id] = storedFor(a, bank, undefined, { createdAt: 1000 + i });
    }
    const c = capAnalyses({ schemaVersion: 1, byAttempt });
    expect(Object.keys(c.byAttempt).length).toBe(30);
    expect(c.byAttempt['ex-cap-0']).toBeUndefined();
    expect(c.byAttempt['ex-cap-34']).toBeDefined();
  });

  it('poda al borrar intentos', () => {
    expect(pruneOrphans(state(), new Set())).toEqual({ schemaVersion: 1, byAttempt: {} });
    const s = state();
    expect(pruneOrphans(s, new Set([attempt.id]))).toBe(s);
  });

  it('JSON corrupto en la clave no rompe: se arranca sin análisis', () => {
    localStorage.setItem(KEYS.analyses, '{{{');
    const r = readStoredAnalyses(attempts);
    expect(r.analyses.byAttempt).toEqual({});
    expect(r.corrupt).toBe(true);
  });

  it('recargar conserva el análisis (lectura desde localStorage)', () => {
    __resetAnalysisStore();
    useAnalysis.getState().replaceAll(state());
    const r = readStoredAnalyses(attempts);
    expect(r.analyses).toEqual(state());
  });

  it('el token vive en su clave, nunca en la exportación, y "Olvidar" lo borra', () => {
    __resetAnalysisStore();
    useAnalysis.getState().setToken('mi-token-secreto-de-prueba-123456');
    expect(localStorage.getItem(KEYS.aiAccess)).toContain('mi-token-secreto');
    const file = JSON.stringify(buildExport(DEFAULT_PREFS, emptyProgress(bank.manifest.bankVersion), attempts, new Date(0), state()));
    expect(file).not.toContain('mi-token-secreto');
    expect(file).not.toContain(KEYS.aiAccess);
    useAnalysis.getState().forgetToken();
    expect(localStorage.getItem(KEYS.aiAccess)).toBeNull();
  });
});

describe('exportar / importar con análisis', () => {
  it('ida y vuelta: exportar → borrar → importar conserva el análisis', () => {
    const file = JSON.stringify(buildExport(DEFAULT_PREFS, emptyProgress(bank.manifest.bankVersion), attempts, new Date(0), state()));
    const r = parseImport(file, ref);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.analyses).toEqual(state());
    expect(r.analysesCount).toBe(1);
  });

  it('un archivo viejo sin "analyses" importa igual', () => {
    const file = buildExport(DEFAULT_PREFS, emptyProgress(bank.manifest.bankVersion), attempts, new Date(0));
    expect(file).not.toHaveProperty('analyses');
    const r = parseImport(JSON.stringify(file), ref);
    expect(r.ok && r.analysesCount).toBe(0);
  });

  it('descarta el análisis huérfano (intento que no viene en el archivo)', () => {
    const file = JSON.stringify(buildExport(DEFAULT_PREFS, emptyProgress(bank.manifest.bankVersion), { schemaVersion: 1, attempts: [] }, new Date(0), state()));
    const r = parseImport(file, ref);
    expect(r.ok && r.analysesCount).toBe(0);
  });
});

describe('inmutabilidad de los intentos', () => {
  it('guardar un análisis no modifica el intento ni la clave attempts', () => {
    __resetAnalysisStore();
    localStorage.setItem(KEYS.attempts, JSON.stringify(attempts));
    const before = localStorage.getItem(KEYS.attempts);
    const snapshot = structuredClone(attempt);
    useAnalysis.getState().replaceAll(state());
    expect(localStorage.getItem(KEYS.attempts)).toBe(before);
    expect(attempt).toEqual(snapshot);
    expect(isAttemptsState(JSON.parse(before!))).toBe(true);
  });
});
