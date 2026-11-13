import { CircleCheck, Play, RotateCcw } from 'lucide-react';
import type { LoadedBank } from '../../bank/types';
import { isScorable } from '../../grading/grade';
import type { ExamAttempt, ProgressState } from '../../storage/schema';
import { ButtonLink } from '../../ui/Button/Button';
import { practiceUrl } from '../practice/filterQuery';
import { attemptCounts, chaptersOf, deriveBank } from './analysisData';
import { unitIncorrect } from '../../../shared/analysis/derive';
import { sectionTopic } from './studyPlanModel';
import s from './StudyPlan.module.css';

/** Datos calculados para "Para consolidar" (sin IA, sin debilidades inventadas). */
export function consolidation(attempt: ExamAttempt, bank: LoadedBank, progress: ProgressState) {
  const chapters = chaptersOf(bank);
  const rows = new Map<string, { section: string; scorable: number; answered: number; firstUnanswered?: string }>();
  for (const q of bank.questions) {
    // solo preguntas de capítulo (los simulacros repiten sus enunciados)
    if (q.group !== 'cap' || !isScorable(q)) continue;
    const ch = chapters.get(q.id);
    if (!ch) continue;
    const r = rows.get(ch) ?? { section: ch, scorable: 0, answered: 0 };
    r.scorable += 1;
    const p = progress.questions[q.id];
    if (p?.last) r.answered += 1;
    else r.firstUnanswered ??= q.id;
    rows.set(ch, r);
  }
  const chapterRows = [...rows.values()]
    .filter((r) => r.answered < r.scorable && r.firstUnanswered)
    .sort((a, b) => a.answered / a.scorable - b.answered / b.scorable || (a.section < b.section ? -1 : 1))
    .slice(0, 3);
  const db = deriveBank(bank);
  const improved = attempt.items.filter((i) => i.result === 'correct' && unitIncorrect(db, progress.questions, i.questionId) >= 1).length;
  return { chapterRows, improved };
}

export function NoErrorsPanel({ attempt, bank, progress }: { attempt: ExamAttempt; bank: LoadedBank; progress: ProgressState }) {
  const c = attemptCounts(attempt);
  const { chapterRows, improved } = consolidation(attempt, bank, progress);
  return (
    <section className={`card ${s.neutral}`} aria-labelledby="noerr-h">
      <h2 id="noerr-h" className={s.withIcon}>
        <CircleCheck size={22} aria-hidden="true" className={s.okIcon} />
        Sin errores en este intento: {c.correct} de {c.total} correctas.
      </h2>
      <p className="small muted">No hace falta un análisis con IA. Lo que sigue se calcula con tu progreso en esta app.</p>
      {(chapterRows.length > 0 || improved > 0) && (
        <div className="stack">
          <h3>Para consolidar</h3>
          {chapterRows.length > 0 && (
            <ul role="list" className={s.plainList}>
              {chapterRows.map((r) => (
                <li key={r.section} className={s.consRow}>
                  <span>
                    <span lang="en">{sectionTopic(bank, r.section)}</span>: respondiste {r.answered} de {r.scorable}
                  </span>
                  <ButtonLink size="sm" to={practiceUrl(r.firstUnanswered!, { section: r.section, state: 'unanswered' })} icon={<Play size={16} aria-hidden="true" />}>
                    Practicar
                  </ButtonLink>
                </li>
              ))}
            </ul>
          )}
          {improved > 0 && <p>Preguntas que fallaste antes y hoy acertaste ({improved}).</p>}
        </div>
      )}
      <div className="row">
        <ButtonLink to="/examen" icon={<RotateCcw size={18} aria-hidden="true" />}>
          Nuevo examen
        </ButtonLink>
      </div>
    </section>
  );
}
