import { computeUnits } from '../grading/units';
import type { BankIndexes, DocId, Question } from './types';

export function buildIndexes(questions: Question[]): BankIndexes {
  const byId = new Map<string, Question>();
  const order = new Map<string, number>();
  const bySection = new Map<string, Question[]>();
  const byDoc = new Map<DocId, Question[]>();
  questions.forEach((q, i) => {
    byId.set(q.id, q);
    order.set(q.id, i);
    (bySection.get(q.section) ?? bySection.set(q.section, []).get(q.section)!).push(q);
    (byDoc.get(q.doc) ?? byDoc.set(q.doc, []).get(q.doc)!).push(q);
  });
  const { unitOf, units } = computeUnits(questions);
  return { byId, order, bySection, byDoc, unitOf, units };
}
