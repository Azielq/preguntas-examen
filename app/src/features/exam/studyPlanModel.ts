/**
 * Modelo de vista de "Tu plan de estudio" (PLAN-IA 6.3, 7, 8.3, 9.4): combina el análisis guardado,
 * el intento y el banco cargado. Función pura. Todo número, página o letra sale del intento o del banco.
 */
import type { Concept, Coverage } from '../../../shared/analysis/contract';
import { NO_CHAPTER_LABEL } from '../../../shared/analysis/chapters';
import { attemptChapterStats, type ConceptPriority } from '../../../shared/analysis/derive';
import type { PriorityLevel } from '../../../shared/analysis/priority';
import { answerSourceLabel, questionOriginLabel, sectionLabel } from '../../bank/selectors';
import type { LoadedBank, Question } from '../../bank/types';
import type { ExamAttempt, GradedExamItem, StoredAnalysis } from '../../storage/schema';
import { attemptCounts, changedItems, deriveBank, type AttemptCounts } from './analysisData';

export interface EvidenceView {
  id: string;
  n: number;
  item: GradedExamItem;
  question: Question | undefined;
  changed: boolean;
  note?: string;
  pageLabel: string;
  explanationRef: string | null;
  reviewHref: string;
}

export interface ConceptView {
  concept: Concept;
  priority: ConceptPriority;
  chapterLabel: string;
  chapterIsBank: boolean;
  countsText: string;
  whyText: string;
  recurrent: boolean;
  limited: boolean;
  evidence: EvidenceView[];
  practiceIds: string[];
}

export interface PlanView {
  counts: AttemptCounts;
  coverage: Coverage;
  createdAt: number;
  provider: StoredAnalysis['provider'];
  model: string;
  olderPrompt: boolean;
  oldBank: boolean;
  /** hay preguntas cambiadas: solo lectura, sin regenerar */
  readOnly: boolean;
  changedCount: number;
  summary: string;
  groups: { level: PriorityLevel; concepts: ConceptView[] }[];
  highCount: number;
  unassigned: EvidenceView[];
  notDetailed: number;
  chapterStrengths: { label: string; correct: number; total: number }[];
  improvedCount: number;
  aiStrengths: { name: string; n: number }[];
  keyFlags: { evidence: EvidenceView; note: string }[];
  reviewCount: number;
  practiceIds: string[];
  mostlyOmitted: boolean;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function sectionTopic(bank: LoadedBank, section: string | null): string {
  if (!section) return NO_CHAPTER_LABEL;
  const s = bank.manifest.sections.find((x) => x.section === section);
  return s ? sectionLabel(s) : section;
}

export function countsText(I: number, O: number): string {
  const parts: string[] = [];
  if (I) parts.push(plural(I, 'incorrecta', 'incorrectas'));
  if (O) parts.push(plural(O, 'omitida', 'omitidas'));
  return parts.join(' · ') || 'sin errores';
}

export function buildPlanView(analysis: StoredAnalysis, attempt: ExamAttempt, bank: LoadedBank, currentPromptVersion: string | null): PlanView {
  const counts = attemptCounts(attempt);
  const changed = changedItems(attempt, bank);
  const pos = new Map(attempt.items.map((it, i) => [it.questionId, i + 1]));
  const items = new Map(attempt.items.map((it) => [it.questionId, it]));
  const db = deriveBank(bank);
  const stats = attemptChapterStats(attempt.items, db);
  const usable = (id: string) => bank.indexes.byId.has(id) && !changed.has(id);

  const notes = new Map<string, string>();
  for (const k of analysis.output.concepts) for (const n of k.questionNotes) notes.set(n.questionId, n.note);

  const evidence = (id: string): EvidenceView | null => {
    const item = items.get(id);
    if (!item) return null;
    const q = bank.indexes.byId.get(id);
    return {
      id,
      n: pos.get(id)!,
      item,
      question: q,
      changed: changed.has(id),
      note: notes.get(id),
      pageLabel: q ? questionOriginLabel(q) : id,
      explanationRef: q && q.answerSource.kind === 'explanation' ? `Explicación en el PDF: ${answerSourceLabel(q.answerSource)}` : null,
      reviewHref: `/examen/resultado/${attempt.id}/revision/${pos.get(id)}`,
    };
  };

  const concepts = new Map(analysis.output.concepts.map((k) => [k.id, k]));
  const views: ConceptView[] = [];
  for (const cid of analysis.derived.order) {
    const k = concepts.get(cid);
    const p = analysis.derived.priorities[cid];
    if (!k || !p) continue;
    const st = p.chapter ? stats.get(p.chapter) : undefined;
    const why = [`${countsText(p.I, p.O).replace(' · ', ' y ')} en este intento`];
    if (p.R) why.push(p.R === 1 ? '1 ya la habías fallado antes' : `${p.R} ya las habías fallado antes`);
    if (st && p.f !== null) why.push(`fallaste ${st.failed} de ${st.total} preguntas de este capítulo`);
    views.push({
      concept: k,
      priority: p,
      chapterLabel: sectionTopic(bank, p.chapter),
      chapterIsBank: !!p.chapter,
      countsText: countsText(p.I, p.O),
      whyText: why.join(' · '),
      recurrent: p.R > 0,
      limited: k.questionIds.length === 1 && p.R === 0,
      evidence: k.questionIds.map(evidence).filter((e): e is EvidenceView => !!e),
      practiceIds: (analysis.derived.practiceByConcept[cid] ?? []).filter(usable),
    });
  }
  const levels: PriorityLevel[] = ['alta', 'media', 'baja'];
  const groups = levels.map((level) => ({ level, concepts: views.filter((v) => v.priority.level === level) })).filter((g) => g.concepts.length > 0);

  // "Otros errores sin agrupar": unassigned + falladas no detalladas (las que no aparecen en la salida)
  const inOutput = new Set([...analysis.output.unassigned, ...analysis.output.concepts.flatMap((k) => k.questionIds)]);
  const failedItems = attempt.items.filter((i) => i.result !== 'correct');
  const notDetailedIds = failedItems.map((i) => i.questionId).filter((id) => !inOutput.has(id));
  const unassigned = [...analysis.output.unassigned, ...notDetailedIds].map(evidence).filter((e): e is EvidenceView => !!e);

  const scorable = counts.correct + counts.incorrect + counts.omitted;
  return {
    counts,
    coverage: analysis.coverage,
    createdAt: analysis.createdAt,
    provider: analysis.provider,
    model: analysis.model,
    olderPrompt: !!currentPromptVersion && analysis.promptVersion !== currentPromptVersion,
    oldBank: analysis.bankVersion !== bank.manifest.bankVersion,
    readOnly: changed.size > 0,
    changedCount: changed.size,
    summary: analysis.output.summary,
    groups,
    highCount: views.filter((v) => v.priority.level === 'alta').length,
    unassigned,
    notDetailed: Math.max(0, analysis.coverage.failed - analysis.coverage.failedAnalyzed),
    chapterStrengths: analysis.derived.chapterStrengths.map((c) => ({ label: sectionTopic(bank, c.section), correct: c.correct, total: c.total })),
    improvedCount: analysis.derived.improvedIds.length,
    aiStrengths: analysis.output.strengths.map((s) => ({ name: s.name, n: s.questionIds.length })),
    keyFlags: analysis.output.keyFlags.map((f) => ({ evidence: evidence(f.questionId), note: f.note })).filter((f): f is { evidence: EvidenceView; note: string } => !!f.evidence),
    reviewCount: failedItems.length,
    practiceIds: analysis.derived.practiceIds.filter(usable),
    mostlyOmitted: scorable > 0 && counts.omitted / scorable >= 0.5,
  };
}
