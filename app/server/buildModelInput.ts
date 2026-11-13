/**
 * Arma los datos que ve el modelo a partir del pedido (ids, hashes, letras) y de la copia del banco
 * del servidor (PLAN-IA 3.3 y 4.2). El texto de las preguntas sale del banco, nunca del cliente.
 */
import type { AnalyzeRequest, Coverage, ErrorCode } from '../shared/analysis/contract.js';
import { MAX_CORRECT_DETAILED, MAX_FAILED_DETAILED, MAX_MODEL_CHARS, RECURRENT_MIN_INCORRECT } from '../shared/analysis/limits.js';
import type { Question } from '../src/bank/types.js';
import { grade } from '../src/grading/grade.js';
import type { ServerBank } from './bank.js';
import type { LiteQuestion } from './bankTypes.js';

export interface FailedEntry {
  id: string;
  chapter: string | null;
  topic: string;
  status: 'incorrecta' | 'omitida';
  selectionType: 'single' | 'multiple';
  stem: { type: 'text' | 'code'; text: string }[];
  options: { letter: string; text: string }[];
  chosen: string[];
  correct: string[];
  explanation?: { text: string; perOption: Record<string, string> };
  history?: { attempts: number; incorrect: number };
}

export interface CorrectEntry {
  id: string;
  chapter: string | null;
  stem: { type: 'text' | 'code'; text: string }[];
  options: { letter: string; text: string }[];
  correct: string[];
  previouslyFailed: boolean;
}

export interface ModelInput {
  totals: { scorable: number; correct: number; incorrect: number; omitted: number };
  notScored: number;
  byChapter: { chapter: string | null; topic: string; total: number; correct: number; incorrect: number; omitted: number }[];
  historyChapters: { chapter: string; topic: string; answered: number; incorrect: number }[];
  truncated: { failedNotDetailed: number; correctNotDetailed: number };
  failed: FailedEntry[];
  correct: CorrectEntry[];
}

export interface BuiltInput {
  input: ModelInput;
  coverage: Coverage;
  /** ids fallados/omitidos detallados (los únicos válidos en conceptos, unassigned, notas, confusiones y keyFlags) */
  failedIds: Set<string>;
  incorrectIds: Set<string>;
  /** ids acertados detallados (los únicos válidos en strengths) */
  correctIds: Set<string>;
}

export type BuildResult = { ok: true; built: BuiltInput } | { ok: false; status: number; code: ErrorCode; details?: string[] };

interface Graded {
  q: LiteQuestion;
  selected: string[];
  result: 'correct' | 'incorrect' | 'omitted';
  index: number;
}

const CHAPTER_KEY = (c: string | null) => c ?? '—';

function sectionTopics(bank: ServerBank): Map<string, string> {
  const m = new Map<string, string>();
  for (const q of bank.byId.values()) if (!m.has(q.section)) m.set(q.section, q.topic);
  return m;
}

/** Reparte `k` lugares entre capítulos en proporción a sus fallos (resto mayor) y respeta el orden del intento. */
function pickProportional(group: Graded[], k: number, chapter: (id: string) => string | null): Graded[] {
  if (group.length <= k) return group;
  const byCh = new Map<string, Graded[]>();
  for (const g of group) {
    const key = CHAPTER_KEY(chapter(g.q.id));
    byCh.set(key, [...(byCh.get(key) ?? []), g]);
  }
  const entries = [...byCh.entries()];
  const quotas = entries.map(([key, gs]) => {
    const exact = (gs.length * k) / group.length;
    return { key, base: Math.floor(exact), rem: exact - Math.floor(exact), first: gs[0]!.index };
  });
  let left = k - quotas.reduce((n, q) => n + q.base, 0);
  for (const q of [...quotas].sort((a, b) => b.rem - a.rem || a.first - b.first)) {
    if (left <= 0) break;
    q.base += 1;
    left -= 1;
  }
  const chosen: Graded[] = [];
  for (const q of quotas) chosen.push(...byCh.get(q.key)!.slice(0, q.base));
  return chosen.sort((a, b) => a.index - b.index);
}

/** Neutraliza cualquier aparición del delimitador dentro de los datos (PLAN-IA 5.1). */
export function neutralizeDelimiters(serialized: string): string {
  return serialized.replace(/<(\/?)datos_del_intento>/gi, '‹$1datos_del_intento›');
}

export function serializeInput(input: ModelInput): string {
  return neutralizeDelimiters(JSON.stringify(input));
}

export function buildModelInput(req: AnalyzeRequest, bank: ServerBank): BuildResult {
  if (req.bankVersion !== bank.bankVersion) return { ok: false, status: 409, code: 'bank_mismatch', details: ['bankVersion'] };
  const mismatched: string[] = [];
  for (const it of req.attempt.items) {
    const q = bank.byId.get(it.id);
    if (!q || q.contentHash !== it.hash) mismatched.push(it.id);
  }
  if (mismatched.length) return { ok: false, status: 409, code: 'bank_mismatch', details: mismatched.slice(0, 10) };

  const graded: Graded[] = [];
  let notScored = req.attempt.notScoredCount;
  const wrongLetters: string[] = [];
  const wrongResult: string[] = [];
  req.attempt.items.forEach((it, index) => {
    const q = bank.byId.get(it.id)!;
    const letters = new Set(q.options.map((o) => o.letter));
    if (!it.selected.every((l) => letters.has(l))) {
      wrongLetters.push(it.id);
      return;
    }
    // el servidor vuelve a corregir con la misma función que la app
    const r = grade(q as unknown as Question, it.selected);
    if (r.kind === 'ungraded') {
      notScored += 1; // pendiente o no puntuable: fuera del análisis (ni texto ni letra)
      return;
    }
    if (r.kind !== it.result) {
      wrongResult.push(it.id);
      return;
    }
    graded.push({ q, selected: it.selected, result: r.kind, index });
  });
  if (wrongLetters.length || wrongResult.length) return { ok: false, status: 422, code: 'attempt_mismatch', details: [...wrongLetters, ...wrongResult].slice(0, 10) };

  const failedAll = graded.filter((g) => g.result !== 'correct');
  if (failedAll.length === 0) return { ok: false, status: 422, code: 'nothing_to_analyze' };

  const chapter = (id: string) => bank.chapter.get(id) ?? null;
  const topics = sectionTopics(bank);
  const hist = new Map(req.history.questions.map((h) => [h.id, h]));

  // 1. selección de falladas (recurrentes → incorrectas → omitidas, proporcional por capítulo)
  let failedPick = failedAll;
  if (failedAll.length > MAX_FAILED_DETAILED) {
    const recurrent = failedAll.filter((g) => (hist.get(g.q.id)?.incorrect ?? 0) >= RECURRENT_MIN_INCORRECT);
    const rest = failedAll.filter((g) => !recurrent.includes(g));
    const groups = [recurrent, rest.filter((g) => g.result === 'incorrect'), rest.filter((g) => g.result === 'omitted')];
    const pick: Graded[] = [];
    for (const g of groups) {
      const room = MAX_FAILED_DETAILED - pick.length;
      if (room <= 0) break;
      pick.push(...pickProportional(g, room, chapter));
    }
    failedPick = pick.sort((a, b) => a.index - b.index);
  }

  const failedEntry = (g: Graded): FailedEntry => {
    const e: FailedEntry = {
      id: g.q.id,
      chapter: chapter(g.q.id),
      topic: g.q.topic,
      status: g.result === 'incorrect' ? 'incorrecta' : 'omitida',
      selectionType: g.q.selectionType,
      stem: g.q.stem.map((b) => ({ type: b.type, text: b.text })),
      options: g.q.options.map((o) => ({ letter: o.letter, text: o.text })),
      chosen: g.selected.slice(),
      correct: g.q.correct.slice(),
    };
    // solo explicaciones del PDF: las generadas por IA no son evidencia
    if (g.q.explanation.origin === 'pdf') e.explanation = { text: g.q.explanation.text, perOption: { ...g.q.explanation.perOption } };
    const h = hist.get(g.q.id);
    if (h) e.history = { attempts: h.attempts, incorrect: h.incorrect };
    return e;
  };

  const totals = {
    scorable: graded.length,
    correct: graded.filter((g) => g.result === 'correct').length,
    incorrect: graded.filter((g) => g.result === 'incorrect').length,
    omitted: graded.filter((g) => g.result === 'omitted').length,
  };
  const chapterRows = new Map<string, ModelInput['byChapter'][number]>();
  for (const g of graded) {
    const ch = chapter(g.q.id);
    const key = CHAPTER_KEY(ch);
    const row = chapterRows.get(key) ?? { chapter: ch, topic: ch ? topics.get(ch) ?? ch : 'Sin capítulo asignado en el banco', total: 0, correct: 0, incorrect: 0, omitted: 0 };
    row.total += 1;
    row[g.result] += 1;
    chapterRows.set(key, row);
  }

  const input: ModelInput = {
    totals,
    notScored,
    byChapter: [...chapterRows.values()],
    historyChapters: req.history.chapters.map((c) => ({ chapter: c.section, topic: topics.get(c.section) ?? c.section, answered: c.answered, incorrect: c.incorrect })),
    truncated: { failedNotDetailed: 0, correctNotDetailed: 0 },
    failed: failedPick.map(failedEntry),
    correct: [],
  };
  // margen para los contadores de truncated, que se completan al final
  const size = () => serializeInput(input).length + 64;

  // 3a. si las falladas solas exceden el presupuesto: quitar perOption de letras no elegidas…
  if (size() > MAX_MODEL_CHARS) {
    for (const e of input.failed) {
      if (!e.explanation) continue;
      e.explanation.perOption = Object.fromEntries(Object.entries(e.explanation.perOption).filter(([l]) => e.chosen.includes(l)));
    }
  }
  // …y luego sacar preguntas completas desde el final (nunca se corta un texto por la mitad)
  while (size() > MAX_MODEL_CHARS && input.failed.length > 1) input.failed.pop();

  // 2. acertadas: primero las que habías fallado antes; luego orden del intento; enteras o nada
  const correctAll = graded.filter((g) => g.result === 'correct');
  const prevFailed = (g: Graded) => (hist.get(g.q.id)?.incorrect ?? 0) >= 1;
  const correctOrder = [...correctAll.filter(prevFailed), ...correctAll.filter((g) => !prevFailed(g))];
  for (const g of correctOrder) {
    if (input.correct.length >= MAX_CORRECT_DETAILED) break;
    const entry: CorrectEntry = {
      id: g.q.id,
      chapter: chapter(g.q.id),
      stem: g.q.stem.map((b) => ({ type: b.type, text: b.text })),
      options: g.q.options.map((o) => ({ letter: o.letter, text: o.text })),
      correct: g.q.correct.slice(),
      previouslyFailed: prevFailed(g),
    };
    input.correct.push(entry);
    if (size() > MAX_MODEL_CHARS) {
      input.correct.pop();
      break;
    }
  }
  input.correct.sort((a, b) => correctAll.findIndex((g) => g.q.id === a.id) - correctAll.findIndex((g) => g.q.id === b.id));
  input.truncated = { failedNotDetailed: failedAll.length - input.failed.length, correctNotDetailed: correctAll.length - input.correct.length };

  const failedIds = new Set(input.failed.map((e) => e.id));
  return {
    ok: true,
    built: {
      input,
      coverage: { failed: failedAll.length, failedAnalyzed: input.failed.length, correctSent: input.correct.length, omitted: totals.omitted, notScored },
      failedIds,
      incorrectIds: new Set(input.failed.filter((e) => e.status === 'incorrecta').map((e) => e.id)),
      correctIds: new Set(input.correct.map((e) => e.id)),
    },
  };
}
