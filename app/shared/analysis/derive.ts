/**
 * Datos derivados de un análisis (PLAN-IA 7 y 10): prioridad, fortalezas por capítulo, avances y
 * selección de práctica. Funciones puras: se calculan una vez al guardar y no se recalculan.
 */
import type { ModelOutput } from './contract.js';
import {
  CHAPTER_FRACTION_MIN_ITEMS,
  CHAPTER_STRENGTH_MIN_ITEMS,
  CHAPTER_STRENGTH_MIN_RATIO,
  PRACTICE_PER_CONCEPT,
  PRACTICE_TOTAL,
  RECURRENT_MIN_INCORRECT,
} from './limits.js';
import { compareRanked, priorityLevel, type PriorityLevel, type Ranked } from './priority.js';

export interface ConceptPriority {
  level: PriorityLevel;
  I: number;
  O: number;
  R: number;
  f: number | null;
  chapter: string | null;
}

export interface Derived {
  priorities: Record<string, ConceptPriority>;
  order: string[];
  chapterStrengths: { section: string; correct: number; total: number }[];
  improvedIds: string[];
  practiceIds: string[];
  practiceByConcept: Record<string, string[]>;
}

/** Progreso mínimo por pregunta (estructuralmente compatible con QuestionProgress). */
export interface ProgressLike {
  incorrectCount: number;
  last?: unknown;
  lastGraded?: { outcome: 'correct' | 'incorrect' };
}

export interface DeriveBank {
  /** preguntas en orden del banco */
  questions: { id: string; group: string; section: string }[];
  isScorable(id: string): boolean;
  unitOf(id: string): string;
  unitMembers(unitId: string): string[];
  chapterOf(id: string): string | null;
  /**
   * Objetivo SY0-701 que el PDF indica para la pregunta (solo el libro completo de Messer). Para las preguntas
   * sin capítulo es el único tema real del banco: se usa para "Practicar estos temas" (no para la prioridad).
   */
  objectiveOf?(id: string): string | null;
}

export interface DeriveInput {
  output: ModelOutput;
  items: { questionId: string; result: 'correct' | 'incorrect' | 'omitted' }[];
  bank: DeriveBank;
  progress: Record<string, ProgressLike | undefined>;
}

export function unitIncorrect(bank: DeriveBank, progress: Record<string, ProgressLike | undefined>, id: string): number {
  return bank.unitMembers(bank.unitOf(id)).reduce((n, m) => n + (progress[m]?.incorrectCount ?? 0), 0);
}

/** Estadística del intento por capítulo real (las preguntas sin capítulo no cuentan). */
export function attemptChapterStats(items: DeriveInput['items'], bank: DeriveBank): Map<string, { total: number; correct: number; failed: number }> {
  const m = new Map<string, { total: number; correct: number; failed: number }>();
  for (const it of items) {
    const ch = bank.chapterOf(it.questionId);
    if (!ch) continue;
    const e = m.get(ch) ?? { total: 0, correct: 0, failed: 0 };
    e.total += 1;
    if (it.result === 'correct') e.correct += 1;
    else e.failed += 1;
    m.set(ch, e);
  }
  return m;
}

function dominantChapter(ids: string[], bank: DeriveBank): string | null {
  const counts = new Map<string, number>();
  for (const id of ids) {
    const ch = bank.chapterOf(id);
    if (ch) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [ch, n] of [...counts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) if (best === null || n > counts.get(best)!) best = ch;
  return best;
}

export function computePriorities(input: DeriveInput): { priorities: Record<string, ConceptPriority>; order: string[] } {
  const { output, items, bank, progress } = input;
  const resultOf = new Map(items.map((i) => [i.questionId, i.result]));
  const stats = attemptChapterStats(items, bank);
  const ranked: Ranked[] = [];
  const priorities: Record<string, ConceptPriority> = {};
  for (const k of output.concepts) {
    const I = k.questionIds.filter((id) => resultOf.get(id) === 'incorrect').length;
    const O = k.questionIds.filter((id) => resultOf.get(id) === 'omitted').length;
    const R = k.questionIds.filter((id) => unitIncorrect(bank, progress, id) >= RECURRENT_MIN_INCORRECT).length;
    const chapter = dominantChapter(k.questionIds, bank);
    const st = chapter ? stats.get(chapter) : undefined;
    const f = st && st.total >= CHAPTER_FRACTION_MIN_ITEMS ? st.failed / st.total : null;
    const level = priorityLevel({ I, O, R, f, n: k.questionIds.length });
    priorities[k.id] = { level, I, O, R, f, chapter };
    ranked.push({ id: k.id, level, I, O, R, f, n: k.questionIds.length });
  }
  return { priorities, order: ranked.sort(compareRanked).map((r) => r.id) };
}

type StateRank = 0 | 1 | 2; // fallada en el progreso, sin responder, respondida

function unitState(bank: DeriveBank, progress: DeriveInput['progress'], unitId: string): StateRank {
  const ms = bank.unitMembers(unitId);
  if (ms.some((m) => progress[m]?.lastGraded?.outcome === 'incorrect')) return 0;
  if (ms.every((m) => !progress[m]?.last)) return 1;
  return 2;
}

/** Selección determinista de "Practicar estos temas" (PLAN-IA 10). La IA no elige preguntas. */
export function selectPractice(input: DeriveInput, order: string[]): { practiceIds: string[]; practiceByConcept: Record<string, string[]> } {
  const { output, items, bank, progress } = input;
  const attemptUnits = new Set(items.map((i) => bank.unitOf(i.questionId)));
  const bankPos = new Map(bank.questions.map((q, i) => [q.id, i]));
  const byConcept: Record<string, string[]> = {};
  const concepts = new Map(output.concepts.map((k) => [k.id, k]));
  for (const cid of order) {
    const k = concepts.get(cid);
    if (!k) continue;
    const chapters = new Set(k.questionIds.map((id) => bank.chapterOf(id)).filter((c): c is string => !!c));
    // objetivos SY0-701 de las preguntas del concepto que no tienen capítulo (libro completo de Messer)
    // (el objetivo puede venir de otra copia de la unidad: el extracto de Messer lo toma del libro completo)
    const objectives = new Set(
      k.questionIds
        .filter((id) => !bank.chapterOf(id))
        .flatMap((id) => bank.unitMembers(bank.unitOf(id)).map((m) => bank.objectiveOf?.(m) ?? null))
        .filter((c): c is string => !!c),
    );
    if (chapters.size === 0 && objectives.size === 0) {
      byConcept[cid] = [];
      continue;
    }
    const seenUnits = new Set<string>();
    const cands: { id: string; rank: StateRank; pos: number }[] = [];
    for (const q of bank.questions) {
      const byChapter = q.group === 'cap' && chapters.has(q.section);
      const obj = objectives.size > 0 ? bank.objectiveOf?.(q.id) : null;
      const byObjective = !!obj && objectives.has(obj);
      if ((!byChapter && !byObjective) || !bank.isScorable(q.id)) continue;
      const u = bank.unitOf(q.id);
      if (attemptUnits.has(u) || seenUnits.has(u)) continue;
      seenUnits.add(u);
      cands.push({ id: q.id, rank: unitState(bank, progress, u), pos: bankPos.get(q.id)! });
    }
    cands.sort((a, b) => a.rank - b.rank || a.pos - b.pos);
    byConcept[cid] = cands.slice(0, PRACTICE_PER_CONCEPT).map((c) => c.id);
  }
  // intercalado por prioridad (alta primero) hasta el tope global
  const global: string[] = [];
  const seen = new Set<string>();
  const lists = order.map((cid) => byConcept[cid] ?? []);
  for (let i = 0; global.length < PRACTICE_TOTAL && lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const id = l[i];
      if (id && !seen.has(id) && global.length < PRACTICE_TOTAL) {
        seen.add(id);
        global.push(id);
      }
    }
  }
  return { practiceIds: global, practiceByConcept: byConcept };
}

export function deriveAnalysis(input: DeriveInput): Derived {
  const { priorities, order } = computePriorities(input);
  const stats = attemptChapterStats(input.items, input.bank);
  const chapterStrengths = [...stats.entries()]
    .filter(([, s]) => s.total >= CHAPTER_STRENGTH_MIN_ITEMS && s.correct / s.total >= CHAPTER_STRENGTH_MIN_RATIO)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([section, s]) => ({ section, correct: s.correct, total: s.total }));
  const improvedIds = input.items.filter((i) => i.result === 'correct' && unitIncorrect(input.bank, input.progress, i.questionId) >= 1).map((i) => i.questionId);
  return { priorities, order, chapterStrengths, improvedIds, ...selectPractice(input, order) };
}
