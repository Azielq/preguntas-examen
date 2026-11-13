/**
 * Proveedor simulado determinista (PLAN-IA 2.7): sin red ni clave. Arma una salida válida a partir de la
 * entrada (un concepto por capítulo con fallos) con textos fijos de ejemplo.
 * Escenarios (cabecera x-mock-scenario, solo con este proveedor): ok, invalid_json, unknown_id, with_url,
 * slow, refusal, upstream_error.
 */
import type { Concept, ModelOutput } from '../../shared/analysis/contract.js';
import type { ModelInput } from '../buildModelInput.js';
import { DATA_CLOSE, DATA_OPEN } from '../prompt.js';
import { ProviderError, type AnalysisProvider, type ProviderRequest } from './types.js';

export const MOCK_SCENARIOS = ['ok', 'invalid_json', 'unknown_id', 'with_url', 'slow', 'refusal', 'upstream_error'] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

export const MOCK_TEXT = 'Texto de ejemplo del proveedor simulado.';

export function extractData(req: ProviderRequest): ModelInput {
  const first = req.messages[0]?.content ?? '';
  const a = first.indexOf(DATA_OPEN);
  const b = first.lastIndexOf(DATA_CLOSE);
  if (a < 0 || b < a) throw new ProviderError('upstream_error', 'mock: sin bloque de datos');
  return JSON.parse(first.slice(a + DATA_OPEN.length, b)) as ModelInput;
}

export function mockOutput(data: ModelInput): ModelOutput {
  const groups = new Map<string, ModelInput['failed']>();
  const unassigned: string[] = [];
  for (const f of data.failed) {
    // sin capítulo (Messer): agrupa por sección literal, para ejercitar también esas preguntas; si no, a unassigned
    const key = f.chapter ?? (f.topic ? `sin-capitulo:${f.topic}` : null);
    if (!key) {
      unassigned.push(f.id);
      continue;
    }
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  const concepts: Concept[] = [...groups.entries()].slice(0, 8).map(([, fs], i) => {
    const incorrect = fs.filter((f) => f.status === 'incorrecta').map((f) => f.id);
    return {
      id: `c${i + 1}`,
      name: `Concepto simulado ${i + 1}`,
      questionIds: fs.map((f) => f.id),
      reinforce: MOCK_TEXT,
      questionNotes: fs.map((f) => ({ questionId: f.id, note: `${MOCK_TEXT} Nota sobre esta pregunta.` })),
      confusions: incorrect.length ? [{ between: ['término simulado uno', 'término simulado dos'], questionIds: incorrect.slice(0, 2), evidence: 'hipotesis' as const, note: MOCK_TEXT }] : [],
      learnPoints: [`${MOCK_TEXT} Punto 1.`, `${MOCK_TEXT} Punto 2.`],
      explanation: MOCK_TEXT,
      example: `${MOCK_TEXT} Ejemplo.`,
      activity: { text: `${MOCK_TEXT} Actividad.`, minutes: 15 },
    };
  });
  // concepts más allá de 8: a unassigned
  for (const [, fs] of [...groups.entries()].slice(8)) unassigned.push(...fs.map((f) => f.id));
  const byCh = new Map<string, string[]>();
  for (const c of data.correct) if (c.chapter) byCh.set(c.chapter, [...(byCh.get(c.chapter) ?? []), c.id]);
  const strengths = [...byCh.values()]
    .filter((ids) => ids.length >= 2)
    .slice(0, 2)
    .map((ids, i) => ({ name: `Fortaleza simulada ${i + 1}`, questionIds: ids.slice(0, 3) }));
  return { summary: `${MOCK_TEXT} Resumen del intento.`, concepts, unassigned, strengths, keyFlags: [] };
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new ProviderError('upstream_timeout', 'mock: cancelado'));
    });
  });

export function createMockProvider(opts: { delayMs?: number } = {}): AnalysisProvider {
  return {
    name: 'mock',
    model: 'mock',
    async generate(req, { scenario = 'ok', signal } = {}) {
      if (opts.delayMs) await sleep(opts.delayMs, signal);
      switch (scenario as MockScenario) {
        case 'slow':
          await sleep(3000, signal);
          break;
        case 'refusal':
          throw new ProviderError('model_refused', 'mock: refusal');
        case 'upstream_error':
          throw new ProviderError('upstream_error', 'mock: upstream_error');
        case 'invalid_json':
          return { text: '{"summary": "sin cerrar', model: 'mock' };
        default:
          break;
      }
      const out = mockOutput(extractData(req));
      if (scenario === 'unknown_id' && out.concepts[0]) {
        out.concepts[0].questionIds.push('gor-cap9-9999');
        out.concepts[0].questionNotes.push({ questionId: 'gor-cap9-9999', note: MOCK_TEXT });
      }
      if (scenario === 'with_url') out.summary = `${MOCK_TEXT} Más información en https://ejemplo.invalid/recurso`;
      return { text: JSON.stringify(out), model: 'mock', usage: { inputTokens: 0, outputTokens: 0 } };
    },
  };
}
