/**
 * JSON Schema de ModelOutput v1 (PLAN-IA 5.3).
 * MODEL_OUTPUT_SCHEMA expresa todo, incluidos largos y cantidades.
 * API_OUTPUT_SCHEMA es el que se envía en output_config.format: la salida estructurada no admite
 * minLength/maxLength, minimum/maximum ni restricciones de cantidad en listas, así que se quitan
 * y las hace cumplir el validador a mano de contract.ts.
 */
import { OUT } from './limits.js';

type Schema = Record<string, unknown>;

const str = (max: number): Schema => ({ type: 'string', minLength: 1, maxLength: max });
const ids = (min: number, max: number): Schema => ({ type: 'array', items: { type: 'string' }, minItems: min, maxItems: max });
const obj = (properties: Record<string, Schema>): Schema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const MODEL_OUTPUT_SCHEMA: Schema = obj({
  summary: str(OUT.summary),
  concepts: {
    type: 'array',
    minItems: 0,
    maxItems: OUT.maxConcepts,
    items: obj({
      id: { type: 'string', minLength: 1, maxLength: OUT.conceptId },
      name: str(OUT.conceptName),
      questionIds: ids(1, OUT.maxQuestionIds),
      reinforce: str(OUT.reinforce),
      questionNotes: { type: 'array', items: obj({ questionId: { type: 'string' }, note: str(OUT.questionNote) }) },
      confusions: {
        type: 'array',
        minItems: 0,
        maxItems: OUT.maxConfusions,
        items: obj({
          between: { type: 'array', items: str(OUT.confusionTerm), minItems: 2, maxItems: 2 },
          questionIds: ids(1, OUT.maxQuestionIds),
          evidence: { type: 'string', enum: ['hipotesis', 'respaldada'] },
          note: str(OUT.confusionNote),
        }),
      },
      learnPoints: { type: 'array', items: str(OUT.learnPoint), minItems: OUT.minLearnPoints, maxItems: OUT.maxLearnPoints },
      explanation: str(OUT.explanation),
      example: str(OUT.example),
      activity: obj({ text: str(OUT.activity), minutes: { type: 'integer', minimum: OUT.minMinutes, maximum: OUT.maxMinutes } }),
    }),
  },
  unassigned: ids(0, OUT.maxUnassigned),
  strengths: { type: 'array', minItems: 0, maxItems: OUT.maxStrengths, items: obj({ name: str(OUT.strengthName), questionIds: ids(0, OUT.maxQuestionIds) }) },
  keyFlags: { type: 'array', minItems: 0, maxItems: OUT.maxKeyFlags, items: obj({ questionId: { type: 'string' }, note: str(OUT.keyFlagNote) }) },
});

const UNSUPPORTED = new Set(['minLength', 'maxLength', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minItems', 'maxItems', 'uniqueItems', 'pattern']);

export function stripUnsupported(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(stripUnsupported);
  if (typeof s !== 'object' || s === null) return s;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (UNSUPPORTED.has(k)) continue;
    // dentro de "properties" las claves son nombres de campo, no palabras del esquema
    out[k] = k === 'properties' ? Object.fromEntries(Object.entries(v as Schema).map(([pk, pv]) => [pk, stripUnsupported(pv)])) : stripUnsupported(v);
  }
  return out;
}

export const API_OUTPUT_SCHEMA = stripUnsupported(MODEL_OUTPUT_SCHEMA) as Schema;
