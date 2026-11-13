/**
 * Tema = capítulo real del banco (PLAN-IA 7.1). Nunca se inventa taxonomía.
 * Una pregunta de capítulo es de su capítulo; una de simulacro toma el capítulo de su copia (vía duplicates);
 * Messer y las que no tienen copia en un capítulo quedan sin capítulo (null).
 */
import type { Question } from '../../src/bank/types.js';

export type ChapterQuestion = Pick<Question, 'id' | 'group' | 'section' | 'duplicates'>;

export const NO_CHAPTER_LABEL = 'Sin capítulo asignado en el banco';

export function chapterOf(q: ChapterQuestion, byId: Map<string, ChapterQuestion>): string | null {
  if (q.group === 'cap') return q.section;
  // recorrido por componentes conexos de duplicates; el resultado se ordena para ser determinista
  const seen = new Set<string>([q.id]);
  const queue = [...q.duplicates];
  const found: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const d = byId.get(id);
    if (!d) continue;
    if (d.group === 'cap') found.push(d.section);
    queue.push(...d.duplicates);
  }
  if (found.length === 0) return null;
  return found.sort()[0]!;
}

/** Memoiza chapterOf para todo un banco. */
export function chapterMap(questions: ChapterQuestion[]): Map<string, string | null> {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return new Map(questions.map((q) => [q.id, chapterOf(q, byId)]));
}
