import { FileText, Sparkles, TriangleAlert } from 'lucide-react';
import type { Explanation, Letter, Option } from '../../bank/types';
import { es } from '../../i18n/es';
import { Button } from '../Button/Button';
import { LoadingRegion, Skeleton } from '../States/States';
import s from './ExplanationPanel.module.css';

export interface ExplanationPanelProps {
  explanation: Explanation | 'loading' | 'error';
  /** Referencia ya formateada: "Gorgotsias · pág. 51" */
  sourceLabel: string;
  options: Option[];
  selected: Letter[];
  /** letras correctas (para marcar "Tu elección" solo en elecciones erróneas) */
  correct?: Letter[];
  variant?: 'normal' | 'unreliable';
  onRetry?(): void;
}

export function ExplanationPanel({ explanation, sourceLabel, options, selected, correct = [], variant = 'normal', onRetry }: ExplanationPanelProps) {
  if (explanation === 'loading') {
    return (
      <section className={`${s.panel} ${s.pdf}`} aria-label="Explicación">
        <LoadingRegion>
          <Skeleton lines={3} />
        </LoadingRegion>
      </section>
    );
  }
  if (explanation === 'error') {
    return (
      <section className={`${s.panel} ${s.pdf}`} aria-label="Explicación">
        <p>{es.explanation.loadError}</p>
        {onRetry && (
          <div>
            <Button onClick={onRetry}>{es.common.retry}</Button>
          </div>
        )}
      </section>
    );
  }
  const isAi = explanation.origin === 'ai';
  const unreliable = variant === 'unreliable';
  const label = unreliable ? es.explanation.unreliable : isAi ? es.explanation.ai : es.explanation.pdf;
  const Icon = unreliable ? TriangleAlert : isAi ? Sparkles : FileText;
  const letters = options.map((o) => o.letter).filter((l) => explanation.perOption[l] !== undefined);
  const cls = unreliable ? s.unreliable : isAi ? s.ai : s.pdf;
  return (
    <section className={`${s.panel} ${cls}`} aria-label={label} data-origin={explanation.origin} data-variant={variant}>
      <header className={s.head}>
        <span className={s.label}>
          <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
          {label}
        </span>
        <span className={s.ref}>{sourceLabel}</span>
      </header>
      {isAi && <p className={s.aiWarn}>{es.explanation.aiWarning}</p>}
      <p className={`${s.text} pdf-text`} lang={explanation.language}>
        {explanation.text}
      </p>
      {letters.length > 0 && (
        <div className={s.perOption}>
          <h3 className={s.sub}>{es.explanation.perOption}</h3>
          <ul role="list" className={s.list}>
            {letters.map((l) => {
              const wrongPick = !unreliable && selected.includes(l) && !correct.includes(l);
              return (
                <li key={l} className={s.item}>
                  <span className={s.chip} aria-hidden="true">
                    {l}
                  </span>
                  <span className="sr-only">{l}. </span>
                  <span className={`${s.itemText} pdf-text`} lang={explanation.language}>
                    {explanation.perOption[l]}
                  </span>
                  {wrongPick && <span className={s.yours}>← {es.explanation.yourChoice}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
