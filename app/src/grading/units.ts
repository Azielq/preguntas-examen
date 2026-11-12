import type { Question, Unit } from '../bank/types';

/**
 * Agrupa preguntas en unidades por componentes conexos de `duplicates`
 * (no por contentHash). El id de la unidad es el primer miembro en orden del banco.
 */
export function computeUnits(questions: Question[]): { unitOf: Map<string, string>; units: Map<string, Unit> } {
  const parent = new Map<string, string>();
  const order = new Map<string, number>();
  questions.forEach((q, i) => {
    parent.set(q.id, q.id);
    order.set(q.id, i);
  });
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.get(c) !== r) {
      const n = parent.get(c)!;
      parent.set(c, r);
      c = n;
    }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    // la raíz es la de menor orden en el banco
    if (order.get(ra)! < order.get(rb)!) parent.set(rb, ra);
    else parent.set(ra, rb);
  };
  for (const q of questions) for (const d of q.duplicates) if (parent.has(d)) union(q.id, d);
  const unitOf = new Map<string, string>();
  const units = new Map<string, Unit>();
  for (const q of questions) {
    const r = find(q.id);
    unitOf.set(q.id, r);
    const u = units.get(r);
    if (u) u.members.push(q.id);
    else units.set(r, { id: r, members: [q.id] });
  }
  return { unitOf, units };
}
