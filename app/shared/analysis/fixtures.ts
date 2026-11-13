/** Fixtures de prueba (solo tests): una salida de modelo válida y un validador mínimo de JSON Schema. */
import type { ModelOutput } from './contract.js';

export function validOutput(): ModelOutput {
  return {
    summary: 'Fallaste preguntas de no repudio y de controles. En esta pregunta se ve una confusión puntual.',
    concepts: [
      {
        id: 'c1',
        name: 'No repudio (non-repudiation)',
        questionIds: ['gor-cap1-0002', 'gor-cap1-0003'],
        reinforce: 'Distinguir el no repudio de la integridad.',
        questionNotes: [
          { questionId: 'gor-cap1-0002', note: 'Elegiste un concepto cercano; lo que lo descarta es que no prueba autoría.' },
          { questionId: 'gor-cap1-0003', note: 'La omitiste: fijate en la palabra que indica autoría.' },
        ],
        confusions: [{ between: ['integridad', 'no repudio'], questionIds: ['gor-cap1-0002'], evidence: 'hipotesis', note: 'Se apoya en una sola pregunta.' }],
        learnPoints: ['La firma digital aporta no repudio.', 'Un hash solo no identifica al autor.'],
        explanation: 'El no repudio impide negar la autoría de una acción.',
        example: 'Un contrato firmado con un certificado personal.',
        activity: { text: 'Escribí tres ejemplos propios y clasificalos.', minutes: 15 },
      },
    ],
    unassigned: ['msr-a052'],
    strengths: [{ name: 'Tipos de malware', questionIds: ['gor-cap1-0001', 'gor-cap2-0111'] }],
    keyFlags: [],
  };
}

type Schema = Record<string, unknown>;

/** Validador mínimo de JSON Schema (solo las palabras que usa modelSchema.ts). */
export function schemaErrors(schema: Schema, x: unknown, path = '$'): string[] {
  const errs: string[] = [];
  const t = schema.type;
  const typeOk =
    t === undefined ||
    (t === 'object' && typeof x === 'object' && x !== null && !Array.isArray(x)) ||
    (t === 'array' && Array.isArray(x)) ||
    (t === 'string' && typeof x === 'string') ||
    (t === 'integer' && Number.isInteger(x)) ||
    (t === 'number' && typeof x === 'number') ||
    (t === 'boolean' && typeof x === 'boolean');
  if (!typeOk) return [`${path}: tipo`];
  if (Array.isArray(schema.enum) && !schema.enum.includes(x)) errs.push(`${path}: enum`);
  if (typeof x === 'string') {
    if (typeof schema.minLength === 'number' && x.length < schema.minLength) errs.push(`${path}: minLength`);
    if (typeof schema.maxLength === 'number' && x.length > schema.maxLength) errs.push(`${path}: maxLength`);
  }
  if (typeof x === 'number') {
    if (typeof schema.minimum === 'number' && x < schema.minimum) errs.push(`${path}: minimum`);
    if (typeof schema.maximum === 'number' && x > schema.maximum) errs.push(`${path}: maximum`);
  }
  if (Array.isArray(x)) {
    if (typeof schema.minItems === 'number' && x.length < schema.minItems) errs.push(`${path}: minItems`);
    if (typeof schema.maxItems === 'number' && x.length > schema.maxItems) errs.push(`${path}: maxItems`);
    if (schema.items) x.forEach((v, i) => errs.push(...schemaErrors(schema.items as Schema, v, `${path}[${i}]`)));
  }
  if (t === 'object') {
    const o = x as Record<string, unknown>;
    const props = (schema.properties ?? {}) as Record<string, Schema>;
    for (const r of (schema.required as string[] | undefined) ?? []) if (!(r in o)) errs.push(`${path}.${r}: required`);
    for (const [k, v] of Object.entries(o)) {
      if (props[k]) errs.push(...schemaErrors(props[k]!, v, `${path}.${k}`));
      else if (schema.additionalProperties === false) errs.push(`${path}.${k}: additionalProperties`);
    }
  }
  return errs;
}
