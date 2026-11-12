import type { Question } from './types';

/** Validador escrito a mano. Devuelve la lista de problemas (vacía = banco válido). */
export function validateQuestions(raw: unknown): string[] {
  const problems: string[] = [];
  if (!Array.isArray(raw)) return ['El núcleo del banco no es una lista de preguntas.'];
  const ids = new Set<string>();
  raw.forEach((q: Partial<Question>, i) => {
    const where = typeof q?.id === 'string' ? q.id : `#${i}`;
    if (typeof q?.id !== 'string' || q.id === '') problems.push(`${where}: falta id`);
    else if (ids.has(q.id)) problems.push(`${where}: id repetido`);
    else ids.add(q.id);
    if (q.selectionType !== 'single' && q.selectionType !== 'multiple') problems.push(`${where}: selectionType desconocido`);
    if (!Array.isArray(q.stem) || q.stem.length === 0) problems.push(`${where}: enunciado vacío`);
    else if (q.stem.some((b) => typeof b?.text !== 'string' || (b.type !== 'text' && b.type !== 'code'))) problems.push(`${where}: bloque de enunciado inválido`);
    if (!Array.isArray(q.options) || q.options.length < 2) problems.push(`${where}: opciones inválidas`);
    else {
      const letters = new Set(q.options.map((o) => o.letter));
      if (letters.size !== q.options.length) problems.push(`${where}: letras de opción repetidas`);
      if (!Array.isArray(q.correct) || q.correct.some((l) => !letters.has(l))) problems.push(`${where}: correct no es subconjunto de las letras`);
    }
    if (typeof q.contentHash !== 'string') problems.push(`${where}: falta contentHash`);
    if (!q.review || (q.review.status !== 'ok' && q.review.status !== 'pending')) problems.push(`${where}: review inválido`);
    if (!Array.isArray(q.duplicates)) problems.push(`${where}: duplicates inválido`);
  });
  return problems;
}
