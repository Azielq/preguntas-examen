import { CircleCheck, CircleX, Eye, EyeOff, Flag, History, Star, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useBank } from '../../bank/BankProvider';
import { docShort, duplicateLabel, sectionLabel, stemPreview } from '../../bank/selectors';
import type { DocId } from '../../bank/types';
import { es, formatDate, formatDuration, relTime } from '../../i18n/es';
import { useAnalysis } from '../../state/analysisStore';
import { useExam } from '../../state/examStore';
import { analysisPlanPath } from '../exam/analysisPaths';
import { useProgress } from '../../state/progressStore';
import { groupByUnit, reviewListIds, STUDY_STATE_LABEL, type ReviewList, type StudyState } from '../../state/selectors';
import { formatPercent } from '../../grading/scoreAttempt';
import { ButtonLink } from '../../ui/Button/Button';
import { EmptyState } from '../../ui/States/States';
import { TabPanel, Tabs } from '../../ui/Tabs/Tabs';
import { PageHeader } from '../app/PageHeader';
import { configSourceLabel } from '../exam/ExamSetup';
import { practiceUrl } from '../practice/filterQuery';
import s from './Review.module.css';

type Tab = 'falladas' | 'marcadas' | 'favoritas' | 'historial';
const TABS: Tab[] = ['falladas', 'marcadas', 'favoritas', 'historial'];

function StateTag({ st }: { st: StudyState }) {
  const icon =
    st === 'correct' ? (
      <CircleCheck size={16} aria-hidden="true" />
    ) : st === 'incorrect' ? (
      <CircleX size={16} aria-hidden="true" />
    ) : st === 'ungraded' ? (
      <TriangleAlert size={16} aria-hidden="true" />
    ) : st === 'seen' ? (
      <Eye size={16} aria-hidden="true" />
    ) : (
      <EyeOff size={16} aria-hidden="true" />
    );
  return (
    <span className={`${s.tag} ${s[st]}`}>
      {icon}
      {STUDY_STATE_LABEL[st]}
    </span>
  );
}

export function ReviewPage() {
  const bank = useBank();
  const [sp, setSp] = useSearchParams();
  const tabParam = sp.get('tab') as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'falladas';
  const progress = useProgress((st) => st.state);
  const attempts = useExam((st) => st.attempts);
  const [doc, setDoc] = useState<DocId | ''>('');
  const [section, setSection] = useState('');

  const lists = useMemo(() => {
    const out = {} as Record<ReviewList, ReturnType<typeof groupByUnit>>;
    for (const l of ['falladas', 'marcadas', 'favoritas'] as ReviewList[]) out[l] = groupByUnit(reviewListIds(bank.questions, progress, l), bank.indexes, progress);
    return out;
  }, [bank, progress]);

  const label: Record<Tab, string> = {
    falladas: `Falladas (${lists.falladas.length})`,
    marcadas: `Marcadas (${lists.marcadas.length})`,
    favoritas: `Favoritas (${lists.favoritas.length})`,
    historial: `Historial (${attempts.attempts.length})`,
  };

  return (
    <div className="page">
      <PageHeader title={es.nav.review} docTitle={es.nav.review} />
      <div>
        <Tabs
          tabs={TABS.map((t) => ({ id: t, label: label[t] }))}
          value={tab}
          onChange={(t) => setSp(new URLSearchParams({ tab: t }), { replace: true })}
          idPrefix="repaso"
          label="Listas de repaso"
        />
        <TabPanel idPrefix="repaso" id={tab}>
          {tab === 'historial' ? (
            <HistoryTab />
          ) : (
            <ListTab list={tab} rows={lists[tab]} doc={doc} setDoc={setDoc} section={section} setSection={setSection} />
          )}
        </TabPanel>
      </div>
      <p className="small muted">Las listas agrupan las copias repetidas de una misma pregunta en una sola fila.</p>
    </div>
  );
}

const DESCRIPTIONS: Record<ReviewList, string> = {
  falladas: 'Preguntas cuya última respuesta corregida fue incorrecta.',
  marcadas: 'Preguntas que marcaste con la bandera para repasar.',
  favoritas: 'Preguntas que guardaste como favoritas.',
};

const EMPTY: Record<ReviewList, { title: string; action: { to: string; label: string }; icon: JSX.Element }> = {
  falladas: { title: 'No tenés preguntas falladas.', action: { to: '/practica', label: 'Ir a Práctica' }, icon: <CircleX aria-hidden="true" /> },
  marcadas: {
    title: 'No marcaste preguntas para repasar. Usá la bandera en cualquier pregunta.',
    action: { to: '/practica', label: 'Ir a Práctica' },
    icon: <Flag aria-hidden="true" />,
  },
  favoritas: { title: 'No tenés preguntas favoritas. Usá la estrella en cualquier pregunta.', action: { to: '/practica', label: 'Ir a Práctica' }, icon: <Star aria-hidden="true" /> },
};

function ListTab({
  list,
  rows,
  doc,
  setDoc,
  section,
  setSection,
}: {
  list: ReviewList;
  rows: ReturnType<typeof groupByUnit>;
  doc: DocId | '';
  setDoc(d: DocId | ''): void;
  section: string;
  setSection(s: string): void;
}) {
  const bank = useBank();
  const filtered = rows.filter((r) => (!doc || r.question.doc === doc) && (!section || r.copies.some((c) => c.section === section)));
  const questionCount = filtered.reduce((n, r) => n + r.copies.filter((c) => !section || c.section === section).length, 0);
  if (rows.length === 0) {
    const e = EMPTY[list];
    return <EmptyState icon={e.icon} title={e.title} action={<ButtonLink to={e.action.to} variant="primary">{e.action.label}</ButtonLink>} />;
  }
  const firstId = filtered[0]?.copies.find((c) => !section || c.section === section)?.id;
  const f = { list, doc: doc || undefined, section: section || undefined };
  const sections = bank.manifest.sections.filter((x) => !doc || x.doc === doc);
  return (
    <div className="stack">
      <p className="muted">{DESCRIPTIONS[list]}</p>
      <div className={s.toolbar}>
        <div className="field">
          <label htmlFor="rv-doc">{es.filter.doc}</label>
          <select
            id="rv-doc"
            className="select"
            value={doc}
            onChange={(e) => {
              setDoc(e.target.value as DocId | '');
              setSection('');
            }}
          >
            <option value="">{es.filter.all}</option>
            {bank.manifest.documents.map((d) => (
              <option key={d.id} value={d.id}>
                {docShort(d.id)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rv-sec">{es.filter.section}</label>
          <select id="rv-sec" className="select" value={section} onChange={(e) => setSection(e.target.value)}>
            <option value="">{es.filter.allF}</option>
            {sections.map((x) => (
              <option key={x.section} value={x.section}>
                {sectionLabel(x)}
              </option>
            ))}
          </select>
        </div>
        <span className={s.spacer} />
        {firstId && (
          <ButtonLink to={practiceUrl(firstId, f)} variant="primary">
            Repasar las {questionCount}
          </ButtonLink>
        )}
      </div>
      {filtered.length === 0 ? (
        <p className="muted">Ninguna pregunta de esta lista coincide con el filtro.</p>
      ) : (
        <ul role="list" className={`card ${s.rows}`}>
          {filtered.map((r) => {
            const q = r.question;
            const p = r.progress;
            const pv = stemPreview(q, 90);
            const full = q.stem.find((b) => b.type === 'text')?.text ?? '';
            return (
              <li key={r.unitId} className={s.row}>
                <StateTag st={r.state} />
                <Link to={practiceUrl(q.id, f)} className={s.origin}>
                  <span lang="en">{duplicateLabel(q)}</span>
                </Link>
                <span className={s.preview} lang="en" title={pv.truncated ? full : undefined}>
                  {pv.text}
                </span>
                <span className={`small muted ${s.meta}`}>
                  {p && p.attempts > 0 && (list === 'falladas' ? `fallada ${p.incorrectCount} de ${p.attempts}` : `${p.attempts} ${p.attempts === 1 ? 'intento' : 'intentos'}`)}
                  {p?.last && ` · ${relTime(p.last.at)}`}
                  {r.copies.length > 1 && ` · ${r.copies.length} copias`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function HistoryTab() {
  const bank = useBank();
  const attempts = useExam((st) => st.attempts.attempts);
  const analyses = useAnalysis((st) => st.analyses);
  if (attempts.length === 0) {
    return (
      <EmptyState
        icon={<History aria-hidden="true" />}
        title="Todavía no hiciste ningún examen."
        action={
          <ButtonLink to="/examen" variant="primary">
            Hacer un examen
          </ButtonLink>
        }
      />
    );
  }
  return (
    <div className="card table-wrap">
      <table className="table">
        <caption className="sr-only">Historial de exámenes</caption>
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Origen</th>
            <th scope="col" className="n">
              Preguntas
            </th>
            <th scope="col" className="n">
              Nota
            </th>
            <th scope="col" className="n">
              Tiempo
            </th>
            <th scope="col">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => (
            <tr key={a.id}>
              <td>
                {formatDate(a.finishedAt)}
                {a.bankVersion !== bank.manifest.bankVersion && (
                  <>
                    {' '}
                    <span className="chip warning">Banco anterior</span>
                  </>
                )}
              </td>
              <td>{configSourceLabel(a.config)}</td>
              <td className="n">{a.totals.scorable}</td>
              <td className="n">{formatPercent(a.totals.correct, a.totals.scorable) ?? '—'}</td>
              <td className="n">{a.config.timerMinutes !== null ? formatDuration(a.elapsedMs) : '—'}</td>
              <td>
                <span className={s.actions}>
                  <Link to={`/examen/resultado/${a.id}`} aria-label={`Ver resultado del ${formatDate(a.finishedAt)}`}>
                    Ver
                  </Link>
                  {analyses.byAttempt[a.id] && (
                    <Link to={analysisPlanPath(a.id)} aria-label={`Ver plan de estudio del ${formatDate(a.finishedAt)}`}>
                      Ver plan
                    </Link>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
