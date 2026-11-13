/**
 * Store del análisis con IA (PLAN-IA 8.1 y 9.4). El pedido vive acá (no en el componente) para que
 * navegar no lo cancele. Los análisis se guardan aparte de los intentos (clave propia, versionada).
 */
import { create } from 'zustand';
import { checkVerifiedOutput, type AiStatus } from '../../shared/analysis/contract';
import { deriveAnalysis } from '../../shared/analysis/derive';
import { ANALYSIS_SCHEMA_VERSION } from '../../shared/analysis/limits';
import type { LoadedBank } from '../bank/types';
import { analysisPlanPath } from '../features/exam/analysisPaths';
import { fetchAiStatus, INVALID_RESPONSE, postAnalyze, type ClientError } from '../features/exam/analysisClient';
import { buildAnalyzeRequest, deriveBank } from '../features/exam/analysisData';
import { es } from '../i18n/es';
import { attemptIdSets, capAnalyses, pruneOrphans, sanitizeAnalyses } from '../storage/analyses';
import { KEYS } from '../storage/keys';
import { emptyAnalyses, type AnalysesState, type AttemptsState, type ExamAttempt, type StoredAnalysis } from '../storage/schema';
import { readKey, removeKey, writeKey } from '../storage/storage';
import { useProgress } from './progressStore';
import { toast } from './toastStore';

export type Availability = { kind: 'checking' } | { kind: 'no_endpoint' } | { kind: 'ok'; status: AiStatus };

export interface RequestState {
  status: 'loading' | 'error';
  startedAt: number;
  error?: ClientError;
  regenerate: boolean;
}

export interface AnalysisEvent {
  attemptId: string;
  kind: 'ready' | 'error' | 'cancelled';
  seq: number;
}

interface AiAccessFile {
  schemaVersion: 1;
  token: string;
}

const isAiAccess = (x: unknown): x is AiAccessFile =>
  typeof x === 'object' && x !== null && (x as AiAccessFile).schemaVersion === 1 && typeof (x as AiAccessFile).token === 'string';

interface AnalysisStore {
  analyses: AnalysesState;
  /** intentos con un análisis guardado de un esquema desconocido (no se muestra) */
  incompatible: string[];
  requests: Record<string, RequestState>;
  availability: Availability;
  token: string | null;
  lastEvent: AnalysisEvent | null;
  setInitial(analyses: AnalysesState, incompatible: string[], token: string | null): void;
  checkStatus(force?: boolean): Promise<void>;
  setToken(token: string): void;
  forgetToken(): void;
  start(attempt: ExamAttempt, bank: LoadedBank, opts?: { regenerate?: boolean }): void;
  cancel(attemptId: string): void;
  remove(attemptId: string): void;
  replaceAll(a: AnalysesState): void;
  prune(attemptIds: Set<string>): void;
  clearAll(): void;
  reloadFromStorage(key: string, attempts?: AttemptsState): void;
}

export function readStoredAnalyses(attempts?: AttemptsState): { analyses: AnalysesState; incompatible: string[]; token: string | null; corrupt: boolean } {
  const r = readKey(KEYS.analyses, (x: unknown): x is unknown => typeof x === 'object' && x !== null && (x as { schemaVersion?: unknown }).schemaVersion === 1);
  const s = sanitizeAnalyses(r.value, attempts);
  const t = readKey(KEYS.aiAccess, isAiAccess);
  return { analyses: s.state, incompatible: s.incompatible, token: t.value?.token ?? null, corrupt: r.corrupt };
}

const controllers = new Map<string, AbortController>();
let statusPromise: Promise<void> | null = null;
let seq = 0;

/** Solo para tests. */
export function __resetAnalysisStore() {
  for (const c of controllers.values()) c.abort();
  controllers.clear();
  statusPromise = null;
  useAnalysis.setState({ analyses: emptyAnalyses(), incompatible: [], requests: {}, availability: { kind: 'checking' }, token: null, lastEvent: null });
}

function onPlanPage(attemptId: string): boolean {
  return typeof window !== 'undefined' && window.location.hash.includes(analysisPlanPath(attemptId));
}

export const useAnalysis = create<AnalysisStore>((set, get) => {
  const persist = (analyses: AnalysesState) => {
    set({ analyses });
    const st = writeKey(KEYS.analyses, analyses);
    // sin espacio: el análisis se sigue viendo en memoria, con el aviso existente
    if (st === 'quota') toast(es.storage.quota, { tone: 'warning', persistent: true, action: { label: 'Ir a Ajustes', href: '/ajustes#datos' } });
  };
  const event = (attemptId: string, kind: AnalysisEvent['kind']) => set({ lastEvent: { attemptId, kind, seq: ++seq } });
  const setRequest = (attemptId: string, r: RequestState | null) =>
    set((s) => {
      const requests = { ...s.requests };
      if (r) requests[attemptId] = r;
      else delete requests[attemptId];
      return { requests };
    });

  return {
    analyses: emptyAnalyses(),
    incompatible: [],
    requests: {},
    availability: { kind: 'checking' },
    token: null,
    lastEvent: null,
    setInitial(analyses, incompatible, token) {
      set({ analyses, incompatible, token });
    },
    checkStatus(force = false) {
      if (statusPromise && !force) return statusPromise;
      if (force) set({ availability: { kind: 'checking' } });
      statusPromise = fetchAiStatus().then((r) => {
        set({ availability: r.kind === 'ok' ? { kind: 'ok', status: r.status } : { kind: 'no_endpoint' } });
      });
      return statusPromise;
    },
    setToken(token) {
      const t = token.trim();
      if (!t) return;
      set({ token: t });
      writeKey(KEYS.aiAccess, { schemaVersion: 1, token: t } satisfies AiAccessFile);
    },
    forgetToken() {
      set({ token: null });
      removeKey(KEYS.aiAccess);
    },
    start(attempt, bank, opts = {}) {
      const id = attempt.id;
      // un solo pedido por intento (doble clic, reintento mientras carga)
      if (get().requests[id]?.status === 'loading') return;
      const built = buildAnalyzeRequest(attempt, bank, useProgress.getState().state);
      if (built.kind !== 'ok') return;
      const controller = new AbortController();
      controllers.set(id, controller);
      setRequest(id, { status: 'loading', startedAt: Date.now(), regenerate: !!opts.regenerate });
      postAnalyze(built.request, get().token, controller.signal)
        .then((r) => {
          if (controller.signal.aborted || controllers.get(id) !== controller) return;
          controllers.delete(id);
          if (!r.ok) {
            setRequest(id, { status: 'error', startedAt: Date.now(), error: r.error, regenerate: !!opts.regenerate });
            event(id, 'error');
            return;
          }
          const resp = r.response;
          // misma verificación que el servidor + cada id debe existir en el intento y en el banco cargado
          const allowed = attemptIdSets(attempt);
          const checked = checkVerifiedOutput(resp.output, allowed);
          const inBank = [...allowed.failed, ...allowed.correct].every((q) => bank.indexes.byId.has(q));
          if (!checked.ok || !inBank) {
            setRequest(id, { status: 'error', startedAt: Date.now(), error: INVALID_RESPONSE, regenerate: !!opts.regenerate });
            event(id, 'error');
            return;
          }
          // derivados calculados una vez, con el progreso de este momento
          const derived = deriveAnalysis({ output: checked.value, items: attempt.items, bank: deriveBank(bank), progress: useProgress.getState().state.questions });
          const stored: StoredAnalysis = {
            attemptId: id,
            createdAt: Date.now(),
            bankVersion: resp.bankVersion,
            promptVersion: resp.promptVersion,
            analysisSchemaVersion: ANALYSIS_SCHEMA_VERSION,
            provider: resp.provider,
            model: resp.model,
            coverage: resp.coverage,
            output: checked.value,
            derived,
          };
          const cur = get().analyses;
          persist(capAnalyses({ schemaVersion: 1, byAttempt: { ...cur.byAttempt, [id]: stored } }));
          set((s) => ({ incompatible: s.incompatible.filter((x) => x !== id) }));
          setRequest(id, null);
          event(id, 'ready');
          if (!onPlanPage(id)) toast('Tu plan de estudio está listo', { tone: 'success', action: { label: 'Ver plan', href: analysisPlanPath(id) } });
        })
        .catch(() => {
          // abortado por el usuario: el estado ya se limpió en cancel()
        });
    },
    cancel(attemptId) {
      const c = controllers.get(attemptId);
      controllers.delete(attemptId);
      c?.abort();
      setRequest(attemptId, null);
      event(attemptId, 'cancelled');
    },
    remove(attemptId) {
      const cur = get().analyses;
      if (!cur.byAttempt[attemptId]) return;
      const byAttempt = { ...cur.byAttempt };
      delete byAttempt[attemptId];
      persist({ schemaVersion: 1, byAttempt });
    },
    replaceAll(a) {
      persist(a);
    },
    prune(attemptIds) {
      const cur = get().analyses;
      const next = pruneOrphans(cur, attemptIds);
      if (next !== cur) persist(next);
    },
    clearAll() {
      for (const c of controllers.values()) c.abort();
      controllers.clear();
      set({ requests: {}, incompatible: [] });
      persist(emptyAnalyses());
    },
    reloadFromStorage(key, attempts) {
      const r = readStoredAnalyses(attempts);
      if (key === KEYS.analyses) set({ analyses: r.analyses, incompatible: r.incompatible });
      else if (key === KEYS.aiAccess) set({ token: r.token });
    },
  };
});
