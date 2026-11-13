import { ChevronDown, ChevronRight, Repeat } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import type { Concept } from '../../../shared/analysis/contract';
import { AiGenerated, AiText } from '../AiGenerated/AiGenerated';
import { PriorityBadge, type Level } from '../PriorityBadge/PriorityBadge';
import s from './ConceptCard.module.css';

export interface ConceptCardProps {
  concept: Concept;
  level: Level;
  /** topic literal del capítulo dominante, o "Sin capítulo asignado en el banco" */
  chapterLabel: string;
  chapterIsBank: boolean;
  /** "2 incorrectas · 1 omitida" (calculado) */
  countsText: string;
  recurrent: boolean;
  limitedEvidence: boolean;
  /** "Por qué esta prioridad" con números reales (calculado) */
  whyText: string;
  expanded: boolean;
  onToggle(): void;
  evidence: ReactNode;
  practice?: ReactNode;
}

/**
 * Tarjeta desplegable de un concepto (PLAN-IA 9.3, 9.6): h3 con un botón aria-expanded/aria-controls;
 * el panel es role="region" con `hidden` cuando está cerrado. Lo de la IA va dentro de AiGenerated.
 */
export function ConceptCard({ concept, level, chapterLabel, chapterIsBank, countsText, recurrent, limitedEvidence, whyText, expanded, onToggle, evidence, practice }: ConceptCardProps) {
  const base = useId();
  const btnId = `${base}-btn`;
  const panelId = `${base}-panel`;
  const confusionTitle = (evidence: 'hipotesis' | 'respaldada') => (evidence === 'respaldada' ? 'Confusión observada — RESPALDADA' : 'Posible confusión — HIPÓTESIS');
  return (
    <article className={s.card} data-concept-id={concept.id} data-priority={level}>
      <h3 className={s.h}>
        <button id={btnId} type="button" className={s.toggle} aria-expanded={expanded} aria-controls={panelId} onClick={onToggle}>
          {expanded ? <ChevronDown size={20} aria-hidden="true" className={s.chev} /> : <ChevronRight size={20} aria-hidden="true" className={s.chev} />}
          <span className={s.titleWrap}>
            <span className={s.name} lang="es" data-origin="ai">
              {concept.name}
            </span>
            <span className={s.meta}>
              <AiGenerated variant="chip" label="Generado por IA" />
              <PriorityBadge level={level} />
              {recurrent && (
                <span className="chip">
                  <Repeat size={14} aria-hidden="true" /> Recurrente
                </span>
              )}
              {limitedEvidence && <span className="chip">Evidencia limitada: 1 pregunta</span>}
            </span>
            <span className={s.sub}>
              <span lang={chapterIsBank ? 'en' : undefined}>{chapterLabel}</span>
              <span aria-hidden="true"> · </span>
              <span>{countsText}</span>
            </span>
          </span>
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={btnId} hidden={!expanded} className={s.panel}>
        <div className={s.computed}>
          <h4 className={s.h4}>Por qué esta prioridad <span className="small muted">(calculado)</span></h4>
          <p className="small">{whyText}</p>
        </div>
        <AiGenerated heading={<h4>Qué reforzar</h4>}>
          <AiText>{concept.reinforce}</AiText>
        </AiGenerated>
        <AiGenerated heading={<h4>Qué aprender</h4>}>
          <ul className={s.points}>
            {concept.learnPoints.map((p, i) => (
              <li key={i} className={s.point}>
                {p}
              </li>
            ))}
          </ul>
        </AiGenerated>
        <AiGenerated heading={<h4>Explicación y ejemplo</h4>}>
          <AiText>{concept.explanation}</AiText>
          <p className={s.example}>
            <strong>Ejemplo: </strong>
            <span>{concept.example}</span>
          </p>
        </AiGenerated>
        {concept.confusions.map((cf, i) => (
          <AiGenerated key={i} heading={<h4>{confusionTitle(cf.evidence)}</h4>}>
            <p className={s.example}>
              «{cf.between[0]}» y «{cf.between[1]}»: {cf.note}
            </p>
            <p className="small muted">
              Se apoya en {cf.questionIds.length} {cf.questionIds.length === 1 ? 'pregunta' : 'preguntas'} incorrecta{cf.questionIds.length === 1 ? '' : 's'}.
            </p>
          </AiGenerated>
        ))}
        <AiGenerated heading={<h4>Actividad de repaso · {concept.activity.minutes} min (tiempo orientativo)</h4>}>
          <AiText>{concept.activity.text}</AiText>
        </AiGenerated>
        <div className={s.evidence}>
          <h4 className={s.h4}>Preguntas en las que se basa ({concept.questionIds.length})</h4>
          {evidence}
        </div>
        {practice && <div className={s.practice}>{practice}</div>}
      </div>
    </article>
  );
}
