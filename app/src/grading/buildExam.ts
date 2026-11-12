import type { Question, Unit } from '../bank/types';
import { isScorable } from './grade';
import type { ExamConfig, ExamItem } from './types';

export type Rng = () => number;

/** Generador determinista (mulberry32) para tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ExamScope {
  source: ExamConfig['source'];
  sections?: string[];
  includeAiProposed: boolean;
}

function inScope(q: Question, scope: ExamScope): boolean {
  if (scope.source !== 'both' && q.doc !== scope.source) return false;
  if (scope.sections && scope.sections.length > 0 && !scope.sections.includes(q.section)) return false;
  return true;
}

function eligible(q: Question, scope: ExamScope): boolean {
  if (!isScorable(q)) return false;
  if (q.answerStatus === 'ai_proposed' && !scope.includeAiProposed) return false;
  return true;
}

/**
 * Representantes de las unidades del alcance: por unidad, copias puntuables dentro del alcance;
 * representante = primera con group 'cap' en orden del banco, si no la primera.
 */
export function examCandidates(
  questions: Question[],
  units: Map<string, Unit>,
  byId: Map<string, Question>,
  scope: ExamScope,
): Question[] {
  const out: Question[] = [];
  for (const u of units.values()) {
    const copies = u.members.map((id) => byId.get(id)!).filter((q) => inScope(q, scope) && eligible(q, scope));
    if (copies.length === 0) continue;
    out.push(copies.find((q) => q.group === 'cap') ?? copies[0]!);
  }
  // orden estable según el banco
  const order = new Map(questions.map((q, i) => [q.id, i]));
  out.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  return out;
}

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function buildExam(
  questions: Question[],
  units: Map<string, Unit>,
  byId: Map<string, Question>,
  config: ExamConfig,
  rng: Rng = Math.random,
): ExamItem[] {
  const candidates = examCandidates(questions, units, byId, config);
  return shuffle(candidates, rng)
    .slice(0, Math.max(0, config.count))
    .map((q) => ({ questionId: q.id, contentHash: q.contentHash, selected: [], flagged: false }));
}
