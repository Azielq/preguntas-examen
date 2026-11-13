import { BookOpenCheck, Network, Play, Timer } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBank } from '../../bank/BankProvider';
import { docShort, objectivesOf } from '../../bank/selectors';
import type { DocId } from '../../bank/types';
import { es, formatDuration, relTime } from '../../i18n/es';
import { useAnalysis } from '../../state/analysisStore';
import { useExam } from '../../state/examStore';
import { useProgress } from '../../state/progressStore';
import { filterQuestions, progressStats } from '../../state/selectors';
import { ButtonLink } from '../../ui/Button/Button';
import { ProgressBar, ProgressRing } from '../../ui/Progress/Progress';
import { PageHeader } from '../app/PageHeader';
import { filterToQuery, practiceUrl } from '../practice/filterQuery';
import { listTitle } from '../practice/practiceUtils';
import { ImportTable } from '../settings/ImportTable';
import s from './Dashboard.module.css';

export function Dashboard() {
  const bank = useBank();
  const progress = useProgress((st) => st.state);
  const exam = useExam((st) => st.active);
  const attempts = useExam((st) => st.attempts);
  const report = bank.manifest.importReport;
  const stats = useMemo(() => progressStats(bank.questions, progress), [bank, progress]);
  const units = bank.indexes.units.size;

  return (
    <div className="page">
      <PageHeader title={es.nav.home} docTitle={es.nav.home} />

      <ContinueCard />

      <section className="section" aria-labelledby="dash-progress">
        <h2 id="dash-progress">Tu progreso</h2>
        {stats.answered === 0 && stats.flagged === 0 ? (
          <p className="muted">Todavía no hay progreso. Los números aparecen cuando respondas tu primera pregunta.</p>
        ) : (
          <div className="grid-4">
            <div className={`card ${s.stat}`}>
              <ProgressRing value={stats.answered} max={stats.scorable} label={`${stats.answered} de ${stats.scorable} respondidas`} size={104}>
                <span className={s.ringNum}>{stats.answered}</span>
                <span className="small muted">de {stats.scorable}</span>
              </ProgressRing>
              <span className="small muted">respondidas</span>
            </div>
            <div className={`card ${s.stat}`}>
              <span className="small muted">Acertadas</span>
              <span className={s.num}>{stats.correct}</span>
            </div>
            <div className={`card ${s.stat}`}>
              <span className="small muted">Falladas</span>
              <span className={s.num}>{stats.incorrect}</span>
              {stats.incorrect > 0 && (
                <ButtonLink to="/repaso?tab=falladas" size="sm">
                  Repasar
                </ButtonLink>
              )}
            </div>
            <div className={`card ${s.stat}`}>
              <span className="small muted">Marcadas</span>
              <span className={s.num}>{stats.flagged}</span>
              {stats.flagged > 0 && (
                <ButtonLink to="/repaso?tab=marcadas" size="sm">
                  Repasar
                </ButtonLink>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="dash-docs">
        <h2 id="dash-docs">Documentos</h2>
        <div className="grid-2">
          {bank.manifest.documents.map((d) => (
            <DocCard key={d.id} doc={d.id} />
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="dash-import">
        <div className="section-head">
          <h2 id="dash-import">Resumen de importación</h2>
          <Link to="/ajustes#importacion">Ver detalle</Link>
        </div>
        <div className="card">
          <ImportTable report={report} />
          <p className="small muted" style={{ marginTop: 12 }}>
            {report.identicalDuplicateGroups} grupos de preguntas repetidas · {units} preguntas distintas
          </p>
          <p className="small muted">Las preguntas con contradicciones se pueden leer en Práctica, pero no se corrigen ni cuentan para la nota.</p>
        </div>
      </section>
      {attempts.attempts.length > 0 && exam === null && (
        <p className="small muted">
          Último examen: {relTime(attempts.attempts[0]!.finishedAt)} · <Link to={`/examen/resultado/${attempts.attempts[0]!.id}`}>ver resultado</Link>
        </p>
      )}
    </div>
  );
}

function ContinueCard() {
  const bank = useBank();
  const progress = useProgress((st) => st.state);
  const exam = useExam((st) => st.active);
  const attempts = useExam((st) => st.attempts);
  const analyses = useAnalysis((st) => st.analyses);
  if (exam) {
    const answered = exam.items.filter((i) => i.selected.length > 0).length;
    return (
      <section className={`card ${s.continue}`} aria-labelledby="dash-continue">
        <div className="stack-sm">
          <h2 id="dash-continue" className="card-title">
            Continuar estudiando
          </h2>
          <p>
            Tenés un examen en curso: {answered} de {exam.items.length} respondidas
            {exam.remainingMs !== null && ` · quedan ${formatDuration(exam.remainingMs)}`}.
          </p>
        </div>
        <ButtonLink to="/examen/en-curso" variant="primary" icon={<Play size={18} aria-hidden="true" />}>
          Reanudar examen
        </ButtonLink>
      </section>
    );
  }
  const lp = progress.lastPractice;
  const q = lp ? bank.indexes.byId.get(lp.questionId) : undefined;
  if (lp && q) {
    const list = filterQuestions({ questions: bank.questions, progress, attempts, analyses }, lp.filter);
    const pos = list.findIndex((x) => x.id === q.id);
    const title = lp.filter.list || !lp.filter.section ? listTitle(lp.filter, bank) : q.topic;
    return (
      <section className={`card ${s.continue}`} aria-labelledby="dash-continue">
        <div className="stack-sm">
          <h2 id="dash-continue" className="card-title">
            Continuar estudiando
          </h2>
          <p lang={lp.filter.section ? 'en' : undefined}>{title}</p>
          <p className="small muted">
            {pos >= 0 ? `Pregunta ${pos + 1} de ${list.length}` : q.originalLabel} · última vez {relTime(lp.at)}
          </p>
        </div>
        <ButtonLink to={practiceUrl(q.id, lp.filter)} variant="primary" icon={<Play size={18} aria-hidden="true" />}>
          Continuar práctica
        </ButtonLink>
      </section>
    );
  }
  return (
    <section className={`card ${s.continue}`} aria-labelledby="dash-continue">
      <div className="stack-sm">
        <h2 id="dash-continue" className="card-title">
          Continuar estudiando
        </h2>
        <p>Todavía no empezaste.</p>
      </div>
      <ButtonLink to="/practica" variant="primary" icon={<BookOpenCheck size={18} aria-hidden="true" />}>
        Empezar a practicar
      </ButtonLink>
    </section>
  );
}

function DocCard({ doc }: { doc: DocId }) {
  const bank = useBank();
  const progress = useProgress((st) => st.state);
  const d = bank.manifest.documents.find((x) => x.id === doc)!;
  const qs = useMemo(() => bank.indexes.byDoc.get(doc) ?? [], [bank, doc]);
  const st = useMemo(() => progressStats(qs, progress), [qs, progress]);
  const report = bank.manifest.importReport.stats[doc];
  const sections = bank.manifest.sections.filter((x) => x.doc === doc);
  const caps = sections.filter((x) => x.group === 'cap').length;
  const sims = sections.filter((x) => x.group === 'sim').length;
  const pbqN = bank.manifest.pbqCounts?.[doc] ?? 0;
  const objectives = doc === 'messerfull' ? objectivesOf(qs).length : 0;
  const multiple = qs.filter((q) => q.selectionType === 'multiple').length;
  const otherDocIds = new Set<DocId>();
  const inOther = qs.filter((q) => {
    let hit = false;
    for (const id of q.duplicates) {
      const o = bank.indexes.byId.get(id);
      if (o && o.doc !== doc) {
        otherDocIds.add(o.doc);
        hit = true;
      }
    }
    return hit;
  }).length;
  const otherDocs = [...otherDocIds].map(docShort).join(' y ');
  const describe = (): string => {
    if (caps + sims > 0) return `${caps} capítulos · ${sims} simulacros`;
    const exams = sections.map((x) => x.topic).join(', ');
    const range = qs.length > 0 ? `${qs[0]!.originalLabel}–${qs[qs.length - 1]!.originalLabel}` : '';
    const parts = [sections.length > 1 ? exams : `${exams} (${range})`];
    if (pbqN > 0) parts.push(`${pbqN} PBQ (solo referencia)`);
    if (multiple > 0) parts.push(`${multiple} de selección múltiple`);
    if (objectives > 0) parts.push(`${objectives} objetivos SY0-701`);
    return parts.join(' · ');
  };
  return (
    <article className={`card ${s.doc}`} aria-labelledby={`doc-${doc}`}>
      <h3 id={`doc-${doc}`} className="card-title">
        {docShort(doc)}
      </h3>
      <p className="small" lang="en">
        {d.title}
      </p>
      <p className="small muted num">
        {qs.length} preguntas · {d.pages} pág.
      </p>
      <p className="small muted">{describe()}</p>
      {inOther > 0 && (
        <p className="small muted">
          {inOther === qs.length ? 'Todas sus preguntas' : `${inOther} de sus preguntas`} también {inOther === 1 ? 'está' : 'están'} en {otherDocs}: en un examen con
          ambos documentos cuentan una vez.
        </p>
      )}
      {st.scorable > 0 && (
        <div className="stack-sm">
          <ProgressBar value={st.answered} max={st.scorable} label={`${st.answered} de ${st.scorable} respondidas`} />
          <span className="small muted num">
            {st.answered} de {st.scorable} respondidas
          </span>
        </div>
      )}
      <div className="row">
        {report.pending > 0 && <span className="chip warning">{report.pending} pendientes de revisión</span>}
        {report.explanationAi > 0 && <span className="chip warning">explicaciones de IA</span>}
        {report.explanationFromPdf > 0 && report.explanationAi === 0 && <span className="chip info">explicaciones del PDF</span>}
      </div>
      <div className="row">
        <ButtonLink to={`/practica${filterToQuery({ doc })}`} variant="primary" icon={<BookOpenCheck size={18} aria-hidden="true" />}>
          Practicar
        </ButtonLink>
        <ButtonLink to={`/examen?origen=${doc}`} icon={<Timer size={18} aria-hidden="true" />}>
          Examen
        </ButtonLink>
        {pbqN > 0 && (
          <ButtonLink to={`/pbq?doc=${doc}`} icon={<Network size={18} aria-hidden="true" />} aria-label={`PBQ de ${docShort(doc)}`}>
            PBQ
          </ButtonLink>
        )}
      </div>
    </article>
  );
}
