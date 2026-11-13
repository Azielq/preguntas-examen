import { docShort, duplicateLabel, duplicatesOf, objectivesOf, sectionGroupKey, sectionLabel } from '../../bank/selectors';
import type { LoadedBank, Question } from '../../bank/types';
import type { PracticeFilter, QuestionProgress } from '../../storage/schema';
import { relTime } from '../../i18n/es';

export function listTitle(f: PracticeFilter, bank: LoadedBank): string {
  if (f.list === 'falladas') return 'Repaso · Falladas';
  if (f.list === 'marcadas') return 'Repaso · Marcadas';
  if (f.list === 'favoritas') return 'Repaso · Favoritas';
  if (f.list?.startsWith('attempt:')) return 'Repaso · Incorrectas y omitidas del examen';
  if (f.list?.startsWith('plan:')) return f.list.split(':').length > 2 ? 'Práctica · Tema de tu plan de estudio' : 'Práctica · Temas de tu plan de estudio';
  const base = (() => {
    if (f.section) {
      const s = bank.manifest.sections.find((x) => x.section === f.section);
      return s ? sectionLabel(s) : f.section;
    }
    if (f.doc) return `${docShort(f.doc)} · todas las preguntas`;
    return f.objective ? '' : 'Todas las preguntas';
  })();
  if (!f.objective) return base;
  const o = objectivesOf(bank.indexes.byDoc.get('messerfull') ?? []).find((x) => x.code === f.objective);
  const obj = `Objetivo ${f.objective}${o ? ` · ${o.title}` : ''}`;
  return base ? `${base} · ${obj}` : obj;
}

/** Opciones de los filtros (documentos, secciones agrupadas por documento y objetivos SY0-701). */
export function filterAvailable(bank: LoadedBank, withSections = true) {
  return {
    docs: bank.manifest.documents.map((d) => ({ id: d.id, label: docShort(d.id) })),
    sections: withSections
      ? bank.manifest.sections.map((x) => ({ section: x.section, doc: x.doc, label: x.topic, group: sectionGroupKey(x) }))
      : [],
    objectives: objectivesOf(bank.indexes.byDoc.get('messerfull') ?? []).map((o) => ({ code: o.code, title: o.title })),
  };
}

/** El título de la lista es (o contiene) texto literal en inglés del PDF. */
export function listTitleIsEnglish(f: PracticeFilter): boolean {
  return !f.list && (!!f.section || !!f.objective);
}

export function duplicatesInfo(q: Question, bank: LoadedBank) {
  return duplicatesOf(q, bank.indexes).map((d) => ({ id: d.id, label: duplicateLabel(d), to: `/practica/${d.id}` }));
}

export function lastTimeText(p: QuestionProgress | undefined, now = Date.now()): string | null {
  if (!p?.last) return null;
  const o = p.last.outcome === 'correct' ? 'correcta' : p.last.outcome === 'incorrect' ? 'incorrecta' : 'sin corregir';
  return `Última vez: ${o} · ${relTime(p.last.at, now)}`;
}
