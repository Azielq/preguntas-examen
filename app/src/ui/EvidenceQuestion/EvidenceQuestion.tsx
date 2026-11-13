import { CircleCheck, CircleDashed, CircleX, FileText, TriangleAlert } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import type { Question } from '../../bank/types';
import { optionStates } from '../../grading/grade';
import { AiGenerated, AiText } from '../AiGenerated/AiGenerated';
import { OptionItem } from '../OptionItem/OptionItem';
import { StemRenderer } from '../StemRenderer/StemRenderer';
import s from './EvidenceQuestion.module.css';

export interface EvidenceQuestionProps {
  question: Question;
  selected: string[];
  correct: string[];
  result: 'correct' | 'incorrect' | 'omitted';
  /** "Chapter 1 · General Security Concepts · Question 3 · pág. 12" (lo arma la app, del banco) */
  pageLabel: string;
  /** "Explicación en el PDF: Gorgotsias · pág. 53", o null (Messer: solo origen de la pregunta) */
  explanationRef: string | null;
  reviewHref: string;
  /** nota de la IA sobre esta pregunta (va fuera del bloque del PDF) */
  note?: string;
  noteLabel?: string;
  defaultOpen?: boolean;
  /** el contenido cambió en el banco desde el intento: no se muestra el enunciado */
  changed?: boolean;
}

const RESULT: Record<EvidenceQuestionProps['result'], { text: string; Icon: typeof CircleX; cls: string }> = {
  incorrect: { text: 'Incorrecta', Icon: CircleX, cls: 'bad' },
  omitted: { text: 'Omitida', Icon: CircleDashed, cls: 'om' },
  correct: { text: 'Correcta', Icon: CircleCheck, cls: 'ok' },
};

/** Bloque "Pregunta del PDF" de solo lectura: enunciado y opciones literales del banco (PLAN-IA 9.2, 9.5). */
export function EvidenceQuestion({ question, selected, correct, result, pageLabel, explanationRef, reviewHref, note, noteLabel = 'Sobre tu respuesta', defaultOpen, changed }: EvidenceQuestionProps) {
  const name = useId();
  const r = RESULT[result];
  const states = optionStates(question, correct, selected, { kind: result });
  return (
    <details className={s.wrap} open={defaultOpen}>
      <summary className={s.summary}>
        <span className={`${s.res} ${s[r.cls]}`}>
          <r.Icon size={16} aria-hidden="true" /> {r.text}
        </span>
        <span className={s.label} lang="en">
          {question.originalLabel}
        </span>
      </summary>
      <div className={s.content}>
        <section className={s.pdf} data-origin="pdf" aria-label={`Pregunta del PDF · ${question.originalLabel}`} data-question-id={question.id}>
          <header className={s.head}>
            <span className={s.kind}>
              <FileText size={16} strokeWidth={1.75} aria-hidden="true" /> Pregunta del PDF
            </span>
            <span className="small muted" lang="en">
              {pageLabel}
            </span>
          </header>
          {changed ? (
            <p className="notice warning">
              <TriangleAlert size={18} aria-hidden="true" />
              <span>El contenido de esta pregunta cambió desde este intento.</span>
            </p>
          ) : (
            <>
              <StemRenderer blocks={question.stem} />
              <div role="group" aria-label="Opciones (solo lectura)" className={s.options}>
                {question.options.map((o) => (
                  <OptionItem
                    key={o.letter}
                    option={o}
                    type={question.selectionType}
                    name={name}
                    checked={selected.includes(o.letter)}
                    disabled
                    state={states[o.letter] ?? 'idle'}
                    onChange={() => {}}
                  />
                ))}
              </div>
            </>
          )}
          <p className={`small ${s.ref}`}>
            {explanationRef && <span>{explanationRef}</span>}
            <Link to={reviewHref} aria-label={`Revisar ${question.originalLabel} en la revisión del examen`}>
              Revisar
            </Link>
          </p>
        </section>
        {note && (
          <AiGenerated label={noteLabel}>
            <AiText>{note}</AiText>
          </AiGenerated>
        )}
      </div>
    </details>
  );
}
