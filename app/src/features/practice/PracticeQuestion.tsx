import { ArrowLeft, ArrowRight, CheckCheck, CircleCheck, CircleX, Eye, Flag as FlagIcon, Keyboard, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useBank } from '../../bank/BankProvider';
import { docShort } from '../../bank/selectors';
import type { Letter } from '../../bank/types';
import { grade, isScorable } from '../../grading/grade';
import { useMediaQuery, MQ } from '../../hooks/useMediaQuery';
import { useShortcuts } from '../../hooks/useShortcuts';
import { es } from '../../i18n/es';
import { useExam } from '../../state/examStore';
import { usePracticeSession } from '../../state/practiceSession';
import { usePrefs } from '../../state/prefsStore';
import { useProgress } from '../../state/progressStore';
import { filterQuestions, getStudyState } from '../../state/selectors';
import { toast } from '../../state/toastStore';
import type { PracticeFilter } from '../../storage/schema';
import { Button, ButtonLink } from '../../ui/Button/Button';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FilterBar, type FilterValue } from '../../ui/FilterBar/FilterBar';
import { ProgressBar } from '../../ui/Progress/Progress';
import { QuestionNavigator, type NavItemData } from '../../ui/QuestionNavigator/QuestionNavigator';
import { ShortcutsDialog } from '../../ui/ShortcutsDialog/ShortcutsDialog';
import { EmptyState } from '../../ui/States/States';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { NotFound } from '../app/NotFound';
import { QuestionPanel } from '../common/QuestionPanel';
import L from '../common/QuestionLayout.module.css';
import { filterFromQuery, filterKey, practiceUrl } from './filterQuery';
import { listTitle } from './practiceUtils';

export function PracticeQuestion() {
  const { questionId = '' } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const bank = useBank();
  const q = bank.indexes.byId.get(questionId);
  const spString = sp.toString();
  const filter = useMemo(() => filterFromQuery(new URLSearchParams(spString)), [spString]);
  const key = filterKey(filter);
  const finished = sp.get('fin') === '1';

  const progress = useProgress((s) => s.state);
  const attempts = useExam((s) => s.attempts);
  const markSeen = useProgress((s) => s.markSeen);
  const recordAttempt = useProgress((s) => s.recordAttempt);
  const setLastPractice = useProgress((s) => s.setLastPractice);
  const toggleFlag = useProgress((s) => s.toggleFlag);
  const toggleFavorite = useProgress((s) => s.toggleFavorite);
  const prefs = usePrefs((s) => s.prefs);
  const setPrefs = usePrefs((s) => s.set);
  const session = usePracticeSession();
  const wide = useMediaQuery(MQ.wide);
  const mobile = useMediaQuery(MQ.mobile);

  // Lista congelada de la sesión.
  const ids = useMemo(() => {
    if (session.key === key && session.ids.length > 0 && (!q || session.ids.includes(q.id))) return session.ids;
    const list = filterQuestions({ questions: bank.questions, progress, attempts }, filter).map((x) => x.id);
    if (q && !list.includes(q.id)) {
      list.push(q.id);
      list.sort((a, b) => bank.indexes.order.get(a)! - bank.indexes.order.get(b)!);
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, session.key, session.ids, q?.id]);
  useEffect(() => {
    if (session.key !== key || session.ids !== ids) session.start(key, ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ids]);

  const index = q ? ids.indexOf(q.id) : -1;
  const checked = q ? session.checked[q.id] : undefined;
  const [selected, setSelected] = useState<Letter[]>(checked?.selected ?? []);
  const [fragmentOpen, setFragmentOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    setSelected(usePracticeSession.getState().checked[questionId]?.selected ?? []);
    setFragmentOpen(false);
    setNavOpen(false);
    if (q) {
      markSeen(q);
      setLastPractice(filter, q.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  const title = listTitle(filter, bank);
  useDocumentTitle(q ? `${title} · ${q.originalLabel}` : 'Práctica');

  const result = checked?.result;
  const revealed = result?.kind === 'ungraded';
  const isChecked = !!result && !revealed;
  const scorable = q ? isScorable(q) : false;
  const required = q?.selectionType === 'multiple' ? q.correct.length : 1;
  const canCheck = selected.length === required;

  const go = (i: number) => {
    const id = ids[i];
    if (id) navigate(practiceUrl(id, filter));
  };
  const check = () => {
    if (!q) return;
    if (!scorable) {
      const r = grade(q, selected);
      session.setChecked(q.id, { selected, result: r });
      if (selected.length > 0) recordAttempt(q, selected, 'ungraded', filter.list ? 'review' : 'practice');
      return;
    }
    if (!canCheck) return;
    const r = grade(q, selected);
    session.setChecked(q.id, { selected, result: r });
    if (r.kind === 'correct' || r.kind === 'incorrect') recordAttempt(q, selected, r.kind, filter.list ? 'review' : 'practice');
  };
  const retry = () => {
    if (!q) return;
    session.clearChecked(q.id);
    setSelected([]);
  };
  const finish = () => navigate(practiceUrl(q!.id, filter, 'fin=1'));
  const isLast = index === ids.length - 1;
  const next = () => (isLast ? finish() : go(index + 1));

  useShortcuts(
    {
      option: (i) => {
        if (!q || result) return;
        const o = q.options[i];
        if (!o) return;
        if (q.selectionType === 'single') setSelected([o.letter]);
        else if (selected.includes(o.letter)) setSelected(selected.filter((l) => l !== o.letter));
        else if (selected.length < required) setSelected([...selected, o.letter]);
        else toast(es.question.tooMany(required));
      },
      enter: () => {
        if (result) next();
        else if (!scorable || canCheck) check();
      },
      prev: () => index > 0 && go(index - 1),
      next: () => index >= 0 && index < ids.length - 1 && go(index + 1),
      retry: () => result && retry(),
      favorite: () => q && toast(toggleFavorite(q) ? 'Agregada a favoritas' : 'Quitada de favoritas'),
      flag: () => q && toast(toggleFlag(q) ? 'Marcada para repasar' : 'Marca de repaso quitada'),
      fragment: () => setFragmentOpen(true),
      navigator: () => setNavOpen(true),
      help: () => setHelpOpen(true),
    },
    { enabled: !!q && !finished, singleKey: prefs.singleKeyShortcuts, optionLetters: q?.options.map((o) => o.letter) ?? [] },
  );

  const navItems: NavItemData[] = useMemo(
    () =>
      ids.map((id, i) => {
        const p = progress.questions[id];
        const st = getStudyState(p);
        return { index: i, state: st, flagged: !!p?.flagged, current: id === questionId };
      }),
    [ids, progress, questionId],
  );

  const changeFilter = (v: FilterValue) => {
    const nf: PracticeFilter = { ...v, list: filter.list };
    setPrefs({ lastPracticeFilter: nf });
    const list = filterQuestions({ questions: bank.questions, progress, attempts }, nf);
    const target = q && list.some((x) => x.id === q.id) ? q.id : list[0]?.id;
    if (target) navigate(practiceUrl(target, nf));
    else navigate(`/practica${practiceUrlQuery(nf)}`);
  };

  if (!q) return <NotFound title={es.notFound.question} description="Puede que el banco se haya actualizado. Volvé a la lista de práctica." />;

  const answeredInList = navItems.filter((n) => n.state === 'correct' || n.state === 'incorrect').length;

  if (finished) return <SessionSummary title={title} filter={filter} ids={ids} />;

  const navigatorEl = <QuestionNavigator items={navItems} onGo={(i) => go(i)} mode="practice" />;
  const filterBar = (
    <FilterBar
      value={filter}
      onChange={changeFilter}
      countFor={(patch) => filterQuestions({ questions: bank.questions, progress, attempts }, { ...filter, ...patch }).length}
      total={ids.length}
      available={{
        docs: bank.manifest.documents.map((d) => ({ id: d.id, label: docShort(d.id) })),
        sections: bank.manifest.sections.map((x) => ({ section: x.section, doc: x.doc, label: x.topic, group: x.doc === 'messer' ? 'messer' : x.group === 'sim' ? 'sim' : 'cap' })),
      }}
      showSection
      mobile={mobile}
    />
  );
  const centerBtn = result ? (
    <Button onClick={retry} icon={<RotateCcw size={18} aria-hidden="true" />}>
      {es.question.retry}
    </Button>
  ) : scorable ? (
    <Button variant="primary" onClick={check} disabled={!canCheck} aria-describedby={!canCheck ? 'check-help' : undefined} icon={<CheckCheck size={18} aria-hidden="true" />}>
      {es.question.check}
    </Button>
  ) : (
    <Button variant="primary" onClick={check} icon={<Eye size={18} aria-hidden="true" />}>
      {es.question.revealPdf}
    </Button>
  );

  return (
    <div className="page" style={{ gap: 'var(--sp-5)' }}>
      <header className="stack-sm">
        <div className={L.topRow}>
          <Link to="/practica" className={L.back}>
            <ArrowLeft size={18} aria-hidden="true" /> {es.nav.practice}
          </Link>
        </div>
        <h1 tabIndex={-1} className={L.title} lang={filter.section && !filter.list ? 'en' : undefined}>
          {title}
        </h1>
        {filterBar}
      </header>
      <div className={L.layout}>
        <div className={L.main}>
          <QuestionPanel
            question={q}
            mode="practice"
            position={{ index: index + 1, total: ids.length }}
            selected={selected}
            onSelect={(l) => !result && setSelected(l)}
            result={isChecked ? result : undefined}
            revealed={revealed}
            fragmentOpen={fragmentOpen}
            onFragmentOpenChange={setFragmentOpen}
            onPositionClick={wide ? undefined : () => setNavOpen(true)}
            showLastTime
            feedbackExtra={
              filter.list === 'falladas' && result?.kind === 'correct' ? <p className="small muted">{es.question.leavesFailed}</p> : undefined
            }
          />
          {!result && scorable && !canCheck && (
            <p id="check-help" className="small muted">
              {q.selectionType === 'multiple' ? es.question.multipleHelp(required, selected.length) : es.question.chooseOne}
            </p>
          )}
          <div className={L.actions}>
            <Button onClick={() => go(index - 1)} disabled={index <= 0} icon={<ArrowLeft size={18} aria-hidden="true" />} aria-label={mobile ? es.common.previous : undefined}>
              <span className={L.btnText}>{es.common.previous}</span>
            </Button>
            {centerBtn}
            <Button
              variant={result ? 'primary' : 'secondary'}
              onClick={next}
              iconRight={isLast ? <FlagIcon size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
              aria-label={mobile ? (isLast ? es.common.finish : es.common.next) : undefined}
            >
              <span className={L.btnText}>{isLast ? es.common.finish : es.common.next}</span>
            </Button>
          </div>
          <div className={L.reserve} aria-hidden="true" />
        </div>
        <aside className={L.aside} aria-label="Datos de la sesión">
          <h2 className={L.asideTitle}>Esta lista</h2>
          <p className="small muted num">{es.filter.count(ids.length)}</p>
          {ids.length > 0 && (
            <div className="stack-sm">
              <ProgressBar value={answeredInList} max={ids.length} label={`${answeredInList} de ${ids.length} respondidas`} />
              <span className="small muted num">{answeredInList} respondidas</span>
            </div>
          )}
          <h2 className={L.asideTitle}>Navegador</h2>
          {wide && navigatorEl}
          <Button variant="ghost" size="sm" icon={<Keyboard size={16} aria-hidden="true" />} onClick={() => setHelpOpen(true)}>
            Atajos de teclado
          </Button>
        </aside>
      </div>
      <Dialog open={navOpen} onClose={() => setNavOpen(false)} title={`Preguntas · ${es.question.position(index + 1, ids.length)}`} size="side">
        {!wide && navOpen && (
          <QuestionNavigator
            items={navItems}
            onGo={(i) => {
              setNavOpen(false);
              go(i);
            }}
            mode="practice"
          />
        )}
        {wide && navOpen && navigatorEl}
      </Dialog>
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} singleKeyEnabled={prefs.singleKeyShortcuts} />
    </div>
  );
}

function practiceUrlQuery(f: PracticeFilter): string {
  const u = practiceUrl('x', f);
  return u.slice('/practica/x'.length);
}

function SessionSummary({ title, filter, ids }: { title: string; filter: PracticeFilter; ids: string[] }) {
  const checked = usePracticeSession((s) => s.checked);
  useDocumentTitle(`Resumen · ${title}`);
  const entries = ids.map((id) => checked[id]).filter(Boolean);
  const correct = entries.filter((e) => e!.result.kind === 'correct').length;
  const incorrect = entries.filter((e) => e!.result.kind === 'incorrect').length;
  const ungraded = entries.filter((e) => e!.result.kind === 'ungraded').length;
  const answered = correct + incorrect;
  return (
    <div className="page">
      <header className="page-head">
        <h1 tabIndex={-1}>Resumen de la sesión</h1>
        <p lang={filter.section && !filter.list ? 'en' : undefined}>{title}</p>
      </header>
      {entries.length === 0 ? (
        <EmptyState title="No respondiste preguntas en esta sesión." action={<ButtonLink to="/practica">Volver a Práctica</ButtonLink>} />
      ) : (
        <section className="card stack" aria-label="Resultados de la sesión">
          <p className="h3 num">
            {answered} {answered === 1 ? 'respondida' : 'respondidas'}
          </p>
          <ul role="list" className="row">
            <li className="chip">
              <CircleCheck size={16} aria-hidden="true" /> {correct} acertadas
            </li>
            <li className="chip">
              <CircleX size={16} aria-hidden="true" /> {incorrect} falladas
            </li>
            {ungraded > 0 && <li className="chip warning">{ungraded} sin corregir (pendientes de revisión)</li>}
          </ul>
          <div className="row">
            {incorrect > 0 && (
              <ButtonLink to="/repaso?tab=falladas" variant="primary">
                Repasar falladas
              </ButtonLink>
            )}
            <ButtonLink to="/practica">Volver a Práctica</ButtonLink>
          </div>
        </section>
      )}
      <p className="small muted">Las preguntas pendientes de revisión no se corrigen ni cuentan en estos números.</p>
    </div>
  );
}
