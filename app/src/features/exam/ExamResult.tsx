import { CircleCheck, CircleDashed, CircleX, History, ListChecks, Play, RotateCcw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useBank } from '../../bank/BankProvider';
import { stemPreview } from '../../bank/selectors';
import { formatDate } from '../../i18n/es';
import { useExam } from '../../state/examStore';
import { ButtonLink } from '../../ui/Button/Button';
import { ProgressBar } from '../../ui/Progress/Progress';
import { ResultSummary } from '../../ui/ResultSummary/ResultSummary';
import { NotFound } from '../app/NotFound';
import { PageHeader } from '../app/PageHeader';
import { practiceUrl } from '../practice/filterQuery';
import s from './Exam.module.css';
import { sourceLabel } from './ExamSetup';

type ListFilter = 'all' | 'incorrect' | 'omitted' | 'flagged';

export function ResultIcon({ result }: { result: 'correct' | 'incorrect' | 'omitted' }) {
  if (result === 'correct')
    return (
      <span className={`${s.qres} ${s.ok}`}>
        <CircleCheck size={16} aria-hidden="true" /> Correcta
      </span>
    );
  if (result === 'incorrect')
    return (
      <span className={`${s.qres} ${s.bad}`}>
        <CircleX size={16} aria-hidden="true" /> Incorrecta
      </span>
    );
  return (
    <span className={`${s.qres} ${s.om}`}>
      <CircleDashed size={16} aria-hidden="true" /> Omitida
    </span>
  );
}

export function ExamResult() {
  const { attemptId = '' } = useParams();
  const bank = useBank();
  const attempts = useExam((st) => st.attempts);
  const attempt = attempts.attempts.find((a) => a.id === attemptId);
  const [lf, setLf] = useState<ListFilter>('all');
  if (!attempt) return <NotFound title="No encontramos ese resultado" description="El intento no está en el historial de este navegador." />;

  const oldBank = attempt.bankVersion !== bank.manifest.bankVersion;
  const sections = new Map<string, { label: string; correct: number; total: number }>();
  attempt.items.forEach((it) => {
    const q = bank.indexes.byId.get(it.questionId);
    const key = q?.section ?? '—';
    const label = q?.topic ?? 'Pregunta que ya no existe en el banco';
    const e = sections.get(key) ?? { label, correct: 0, total: 0 };
    e.total += 1;
    if (it.result === 'correct') e.correct += 1;
    sections.set(key, e);
  });
  const rows = attempt.items
    .map((it, i) => ({ it, n: i + 1 }))
    .filter(({ it }) => (lf === 'all' ? true : lf === 'flagged' ? it.flagged : it.result === lf));
  const wrongIds = attempt.items.filter((i) => i.result !== 'correct').map((i) => i.questionId);
  const firstWrong = wrongIds.find((id) => bank.indexes.byId.has(id));

  return (
    <div className="page">
      <PageHeader title="Resultado del examen" docTitle="Resultado del examen">
        <p className={s.meta}>
          {formatDate(attempt.finishedAt)} · {sourceLabel(attempt.config.source)}
          {attempt.config.sections && attempt.config.sections.length > 0 && ` · ${attempt.config.sections.length} secciones`}
          {oldBank && (
            <>
              {' '}
              <span className="chip warning">
                <History size={14} aria-hidden="true" /> Banco anterior
              </span>
            </>
          )}
        </p>
      </PageHeader>
      {attempt.endedBy === 'timeout' && (
        <p className="notice warning" role="status">
          <TriangleAlert size={18} aria-hidden="true" />
          <span>Se terminó el tiempo. El examen se cerró automáticamente con las respuestas que tenías.</span>
        </p>
      )}
      <ResultSummary
        attempt={{ totals: attempt.totals, elapsedMs: attempt.elapsedMs, timerMinutes: attempt.config.timerMinutes, notScoredCount: attempt.notScored?.length ?? 0 }}
      />

      {sections.size > 1 && (
        <section className="section" aria-labelledby="res-sec">
          <h2 id="res-sec">Por sección</h2>
          <div className="card table-wrap">
            <table className={`table ${s.secTable}`}>
              <caption className="sr-only">Aciertos por sección</caption>
              <thead>
                <tr>
                  <th scope="col">Sección</th>
                  <th scope="col" className="n">
                    Aciertos
                  </th>
                  <th scope="col">
                    <span className="sr-only">Gráfico</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...sections.entries()].map(([k, v]) => (
                  <tr key={k}>
                    <th scope="row" lang="en">
                      {v.label}
                    </th>
                    <td className="n">
                      {v.correct} de {v.total}
                    </td>
                    <td>
                      <ProgressBar value={v.correct} max={v.total} label={`${v.correct} de ${v.total} correctas`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="res-list">
        <div className="section-head">
          <h2 id="res-list">Preguntas</h2>
          <div className={s.filters} role="group" aria-label="Filtrar preguntas">
            {(
              [
                ['all', 'Todas'],
                ['incorrect', 'Incorrectas'],
                ['omitted', 'Omitidas'],
                ['flagged', 'Marcadas'],
              ] as [ListFilter, string][]
            ).map(([v, label]) => (
              <button key={v} type="button" className={s.filterBtn} aria-pressed={lf === v} onClick={() => setLf(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          {rows.length === 0 ? (
            <p className="muted">No hay preguntas con este filtro.</p>
          ) : (
            <ol role="list" className={s.qlist}>
              {rows.map(({ it, n }) => {
                const q = bank.indexes.byId.get(it.questionId);
                const pv = q ? stemPreview(q) : null;
                const full = q ? q.stem.find((b) => b.type === 'text')?.text ?? '' : '';
                return (
                  <li key={n} className={s.qrow}>
                    <span className="num muted">{n}</span>
                    <ResultIcon result={it.result} />
                    <span className={s.preview} lang="en" title={pv?.truncated ? full : undefined}>
                      {pv ? pv.text : `(pregunta ${it.questionId} ya no existe en el banco)`}
                    </span>
                    <Link to={`/examen/resultado/${attempt.id}/revision/${n}`} aria-label={`Revisar pregunta ${n}`}>
                      Revisar
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
          {attempt.notScored && attempt.notScored.length > 0 && (
            <p className="small muted" style={{ marginTop: 12 }}>
              No puntuadas: {attempt.notScored.map((i) => i.questionId).join(', ')}
            </p>
          )}
        </div>
      </section>

      <div className="row">
        {attempt.items.length > 0 && (
          <ButtonLink to={`/examen/resultado/${attempt.id}/revision/1`} variant="primary" icon={<ListChecks size={18} aria-hidden="true" />}>
            Revisar todas
          </ButtonLink>
        )}
        {firstWrong && (
          <ButtonLink to={practiceUrl(firstWrong, { list: `attempt:${attempt.id}` })} icon={<RotateCcw size={18} aria-hidden="true" />}>
            Practicar las incorrectas
          </ButtonLink>
        )}
        <ButtonLink to="/examen" icon={<Play size={18} aria-hidden="true" />}>
          Nuevo examen
        </ButtonLink>
      </div>
    </div>
  );
}
