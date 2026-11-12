import { docShort, duplicateLabel, duplicatesOf } from '../../bank/selectors';
import type { LoadedBank, Question } from '../../bank/types';
import type { PracticeFilter, QuestionProgress } from '../../storage/schema';
import { relTime } from '../../i18n/es';

export function listTitle(f: PracticeFilter, bank: LoadedBank): string {
  if (f.list === 'falladas') return 'Repaso · Falladas';
  if (f.list === 'marcadas') return 'Repaso · Marcadas';
  if (f.list === 'favoritas') return 'Repaso · Favoritas';
  if (f.list?.startsWith('attempt:')) return 'Repaso · Incorrectas y omitidas del examen';
  if (f.section) return bank.manifest.sections.find((s) => s.section === f.section)?.topic ?? f.section;
  if (f.doc) return `${docShort(f.doc)} · todas las preguntas`;
  return 'Todas las preguntas';
}

export function duplicatesInfo(q: Question, bank: LoadedBank) {
  return duplicatesOf(q, bank.indexes).map((d) => ({ id: d.id, label: duplicateLabel(d), to: `/practica/${d.id}` }));
}

export function lastTimeText(p: QuestionProgress | undefined, now = Date.now()): string | null {
  if (!p?.last) return null;
  const o = p.last.outcome === 'correct' ? 'correcta' : p.last.outcome === 'incorrect' ? 'incorrecta' : 'sin corregir';
  return `Última vez: ${o} · ${relTime(p.last.at, now)}`;
}
