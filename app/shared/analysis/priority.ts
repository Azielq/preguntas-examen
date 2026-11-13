/**
 * Prioridad determinista por concepto (PLAN-IA 7.2). La IA no decide la prioridad.
 * I = incorrectas, O = omitidas, R = preguntas de evidencia recurrentes (fallos acumulados de la unidad ≥ 2),
 * f = proporción de fallos del capítulo dominante en este intento (null si ese capítulo tiene < 4 preguntas).
 */
export type PriorityLevel = 'alta' | 'media' | 'baja';

export interface PriorityInput {
  I: number;
  O: number;
  R: number;
  f: number | null;
  /** cantidad de preguntas de evidencia del concepto */
  n: number;
}

export function priorityLevel({ I, O, R, f, n }: PriorityInput): PriorityLevel {
  const ff = f ?? 0;
  // una sola pregunta y sin recurrencia: baja (evidencia limitada)
  if (n <= 1 && R === 0) return 'baja';
  const high = I >= 3 || (I >= 2 && R >= 1) || R >= 2 || (I >= 2 && ff >= 0.5);
  const medium = I + O >= 2 || R >= 1 || (I === 1 && ff >= 0.5);
  let level: PriorityLevel = high ? 'alta' : medium ? 'media' : 'baja';
  // solo omitidas: nunca pasa de media
  if (I === 0 && level === 'alta') level = 'media';
  return level;
}

export const LEVEL_RANK: Record<PriorityLevel, number> = { alta: 0, media: 1, baja: 2 };

export interface Ranked extends PriorityInput {
  id: string;
  level: PriorityLevel;
}

/** Orden: nivel; dentro de cada nivel R, I, O, f descendentes; luego id. */
export function compareRanked(a: Ranked, b: Ranked): number {
  return (
    LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
    b.R - a.R ||
    b.I - a.I ||
    b.O - a.O ||
    (b.f ?? -1) - (a.f ?? -1) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
