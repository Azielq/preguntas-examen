import { CircleCheck, CircleDashed, CircleX } from 'lucide-react';
import { formatDuration } from '../../i18n/es';
import { ProgressRing } from '../Progress/Progress';
import s from './ResultSummary.module.css';

export interface ResultSummaryData {
  totals: { scorable: number; correct: number; incorrect: number; omitted: number };
  elapsedMs: number;
  timerMinutes: number | null;
  notScoredCount: number;
}

export function formatPct(correct: number, scorable: number): string | null {
  if (scorable === 0) return null;
  return `${((correct / scorable) * 100).toFixed(1).replace('.', ',')} %`;
}

export function ResultSummary({ attempt }: { attempt: ResultSummaryData }) {
  const t = attempt.totals;
  const pct = formatPct(t.correct, t.scorable);
  return (
    <section className={`card ${s.wrap}`} aria-label="Resumen del resultado">
      {pct && (
        <ProgressRing value={t.correct} max={t.scorable} label={`${t.correct} de ${t.scorable} correctas`} size={132} tone="accent">
          <span className={s.pct}>{pct}</span>
        </ProgressRing>
      )}
      <div className={s.body}>
        <p className={s.main}>
          <span className={s.big}>{t.correct}</span> de {t.scorable} correctas
        </p>
        <ul role="list" className={s.counts}>
          <li className={s.ok}>
            <CircleCheck size={18} aria-hidden="true" /> <span className="num">{t.correct}</span> correctas
          </li>
          <li className={s.bad}>
            <CircleX size={18} aria-hidden="true" /> <span className="num">{t.incorrect}</span> incorrectas
          </li>
          <li className={s.om}>
            <CircleDashed size={18} aria-hidden="true" /> <span className="num">{t.omitted}</span> omitidas
          </li>
        </ul>
        {attempt.timerMinutes !== null && (
          <p className="muted num">
            Tiempo usado: {formatDuration(attempt.elapsedMs)} de {formatDuration(attempt.timerMinutes * 60_000)}
          </p>
        )}
        {attempt.timerMinutes === null && attempt.elapsedMs > 0 && <p className="muted num">Tiempo usado: {formatDuration(attempt.elapsedMs)}</p>}
        <p className="small muted">
          La nota se calcula sobre las {t.scorable} preguntas puntuables. Las omitidas cuentan como no acertadas.
          {attempt.notScoredCount > 0 && ` ${attempt.notScoredCount} no se puntuaron porque dejaron de ser puntuables.`}
        </p>
      </div>
    </section>
  );
}
