/**
 * Verificación de la salida del modelo (PLAN-IA 6.1): parseo, forma, ids, reglas de texto y reparaciones.
 * Lo que no se puede reparar invalida la salida entera; nunca se muestra nada parcial.
 */
import { referencedIds, textErrors, validateModelOutputShape, type ModelOutput } from '../shared/analysis/contract.js';

export interface VerifyContext {
  failedIds: Set<string>;
  incorrectIds: Set<string>;
  correctIds: Set<string>;
}

export type VerifyResult = { ok: true; output: ModelOutput; repairs: string[] } | { ok: false; errors: string[] };

export function verifyOutput(text: string, ctx: VerifyContext): VerifyResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['invalid_json'] };
  }
  const shape = validateModelOutputShape(raw);
  if (!shape.ok) return { ok: false, errors: shape.errors.map((e) => `shape ${e}`) };
  const out = structuredClone(shape.value);

  const ids = referencedIds(out);
  const errors: string[] = [];
  for (const id of new Set(ids.failed)) if (!ctx.failedIds.has(id)) errors.push(`unknown_id ${id}`);
  for (const id of new Set(ids.correct)) if (!ctx.correctIds.has(id)) errors.push(`unknown_strength_id ${id}`);
  errors.push(...textErrors(out).map((e) => `text ${e}`));
  if (errors.length) return { ok: false, errors };

  return { ok: true, ...repair(out, ctx) };
}

function repair(out: ModelOutput, ctx: VerifyContext): { output: ModelOutput; repairs: string[] } {
  const counts = new Map<string, number>();
  const note = (code: string, n = 1) => counts.set(code, (counts.get(code) ?? 0) + n);

  // id repetido en dos conceptos → queda en el primero
  const assigned = new Set<string>();
  for (const k of out.concepts) {
    const keep = k.questionIds.filter((id, i) => k.questionIds.indexOf(id) === i && !assigned.has(id));
    if (keep.length !== k.questionIds.length) note('duplicate_ids_removed', k.questionIds.length - keep.length);
    keep.forEach((id) => assigned.add(id));
    k.questionIds = keep;
    k.questionNotes = k.questionNotes.filter((n, i) => keep.includes(n.questionId) && k.questionNotes.findIndex((m) => m.questionId === n.questionId) === i);
  }
  // confusiones: solo ids incorrectos del propio concepto; "respaldada" exige ≥ 2 incorrectas
  for (const k of out.concepts) {
    k.confusions = k.confusions.flatMap((cf) => {
      const qs = [...new Set(cf.questionIds)].filter((id) => k.questionIds.includes(id) && ctx.incorrectIds.has(id));
      if (qs.length !== cf.questionIds.length) note('confusion_ids_removed', cf.questionIds.length - qs.length);
      if (qs.length === 0) {
        note('confusion_removed');
        return [];
      }
      const evidence = cf.evidence === 'respaldada' && qs.length < 2 ? 'hipotesis' : cf.evidence;
      if (evidence !== cf.evidence) note('evidence_downgraded');
      return [{ ...cf, questionIds: qs, evidence }];
    });
  }
  // concepto sin preguntas → se elimina
  const before = out.concepts.length;
  out.concepts = out.concepts.filter((k) => k.questionIds.length > 0);
  if (out.concepts.length !== before) note('empty_concepts_removed', before - out.concepts.length);

  // unassigned: sin repetidos ni ids que ya están en un concepto; los detallados que faltan se agregan
  const un: string[] = [];
  for (const id of out.unassigned) if (!assigned.has(id) && !un.includes(id)) un.push(id);
  if (un.length !== out.unassigned.length) note('unassigned_deduplicated', out.unassigned.length - un.length);
  const missing = [...ctx.failedIds].filter((id) => !assigned.has(id) && !un.includes(id));
  if (missing.length) note('missing_ids_moved_to_unassigned', missing.length);
  out.unassigned = [...un, ...missing];

  // fortalezas con menos de 2 ids válidos → se eliminan
  out.strengths = out.strengths.flatMap((s) => {
    const qs = [...new Set(s.questionIds)].filter((id) => ctx.correctIds.has(id));
    if (qs.length < 2) {
      note('strength_removed');
      return [];
    }
    return [{ ...s, questionIds: qs }];
  });
  // keyFlags duplicados por pregunta → queda el primero
  const flagged = new Set<string>();
  const flags = out.keyFlags.filter((f) => (flagged.has(f.questionId) ? false : (flagged.add(f.questionId), true)));
  if (flags.length !== out.keyFlags.length) note('duplicate_key_flags_removed', out.keyFlags.length - flags.length);
  out.keyFlags = flags;

  return { output: out, repairs: [...counts.entries()].map(([k, n]) => `${k}:${n}`) };
}
