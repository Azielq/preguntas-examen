import type { AnswerSource, BankIndexes, DocId, Question, SectionInfo } from './types';

export type AnswerState = 'pdf' | 'ai_proposed' | 'pending' | 'unknown';

export function getAnswerState(q: Question): AnswerState {
  if (q.review?.status === 'pending') return 'pending';
  if (q.answerStatus === 'pdf' || q.answerStatus === 'ai_proposed' || q.answerStatus === 'pending') return q.answerStatus;
  return 'unknown';
}

export const DOC_SHORT: Record<DocId, string> = { gorgotsias: 'Gorgotsias', messer: 'Messer' };

export function docShort(doc: string): string {
  return (DOC_SHORT as Record<string, string>)[doc] ?? doc;
}

function pageText(page: number, printed: number): string {
  return page === printed ? `pág. ${page}` : `pág. PDF ${page} (impresa ${printed})`;
}

/** "Question 1 · pág. 11" / "A80 · pág. PDF 11 (impresa 27)" */
export function questionHeaderLabel(q: Question): string {
  return `${q.originalLabel} · ${pageText(q.page, q.printedPage)}`;
}

/** "Chapter 4 · Security Operations · Question 414 · pág. 541" */
export function questionOriginLabel(q: Question): string {
  return `${q.topic} · ${questionHeaderLabel(q)}`;
}

/** "Gorgotsias · pág. 51" / "Messer · clave rápida de respuestas · pág. PDF 17 (impresa 33)" */
export function answerSourceLabel(s: AnswerSource): string {
  const parts = [docShort(s.doc)];
  if (s.kind === 'quick_key') parts.push('clave rápida de respuestas');
  parts.push(pageText(s.page, s.printedPage));
  return parts.join(' · ');
}

export function duplicateLabel(q: Question): string {
  return `${q.topic} · ${q.originalLabel}`;
}

/** Otras copias de la misma unidad (en orden del banco). */
export function duplicatesOf(q: Question, idx: BankIndexes): Question[] {
  const unit = idx.units.get(idx.unitOf.get(q.id) ?? '');
  if (!unit) return [];
  return unit.members.filter((id) => id !== q.id).map((id) => idx.byId.get(id)!);
}

/** Vista previa: primeros 120 caracteres del primer bloque text, corte en límite de palabra. */
export function stemPreview(q: Question, max = 120): { text: string; truncated: boolean } {
  const block = q.stem.find((b) => b.type === 'text') ?? q.stem[0];
  const full = block?.text ?? '';
  if (full.length <= max) return { text: full, truncated: false };
  let cut = full.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  if (sp > max * 0.6) cut = cut.slice(0, sp);
  return { text: cut.trimEnd() + ' …', truncated: true };
}

export type SectionGroupKey = 'cap' | 'sim' | 'messer';
export const SECTION_GROUP_LABEL: Record<SectionGroupKey, string> = {
  cap: 'Gorgotsias — Capítulos',
  sim: 'Gorgotsias — Simuladores',
  messer: 'Messer',
};

export function sectionGroupKey(s: Pick<SectionInfo, 'doc' | 'group'>): SectionGroupKey {
  if (s.doc === 'messer') return 'messer';
  return s.group === 'sim' ? 'sim' : 'cap';
}

export function groupSections(sections: SectionInfo[]): { key: SectionGroupKey; label: string; sections: SectionInfo[] }[] {
  const keys: SectionGroupKey[] = ['cap', 'sim', 'messer'];
  return keys
    .map((key) => ({ key, label: SECTION_GROUP_LABEL[key], sections: sections.filter((s) => sectionGroupKey(s) === key) }))
    .filter((g) => g.sections.length > 0);
}
