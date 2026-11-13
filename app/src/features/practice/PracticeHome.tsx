import { BookOpenCheck, SearchX } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBank } from '../../bank/BankProvider';
import { groupSections, sectionLabel } from '../../bank/selectors';
import { isScorable } from '../../grading/grade';
import { useMediaQuery, MQ } from '../../hooks/useMediaQuery';
import { es } from '../../i18n/es';
import { useExam } from '../../state/examStore';
import { usePrefs } from '../../state/prefsStore';
import { useProgress } from '../../state/progressStore';
import { filterQuestions, getStudyState } from '../../state/selectors';
import type { PracticeFilter } from '../../storage/schema';
import { Button } from '../../ui/Button/Button';
import { FilterBar, type FilterValue } from '../../ui/FilterBar/FilterBar';
import { ProgressBar } from '../../ui/Progress/Progress';
import { EmptyState } from '../../ui/States/States';
import { PageHeader } from '../app/PageHeader';
import { filterFromQuery, filterToQuery, practiceUrl } from './filterQuery';
import { filterAvailable } from './practiceUtils';
import s from './PracticeHome.module.css';

export function PracticeHome() {
  const bank = useBank();
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const progress = useProgress((st) => st.state);
  const attempts = useExam((st) => st.attempts);
  const prefs = usePrefs((st) => st.prefs);
  const setPrefs = usePrefs((st) => st.set);
  const mobile = useMediaQuery(MQ.mobile);

  // Si no hay filtro en la URL, recuperar el último usado (sin sección ni lista).
  useEffect(() => {
    if (sp.toString() === '' && prefs.lastPracticeFilter) {
      const { doc, state, onlyFavorites, objective } = prefs.lastPracticeFilter;
      const q = filterToQuery({ doc, state, onlyFavorites, objective });
      if (q) setSp(new URLSearchParams(q.slice(1)), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filter = useMemo(() => {
    const f = filterFromQuery(sp);
    delete f.section;
    delete f.list;
    return f;
  }, [sp]);
  const ctx = { questions: bank.questions, progress, attempts };
  const all = useMemo(() => filterQuestions(ctx, filter), [bank, progress, attempts, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (v: FilterValue) => {
    const f: PracticeFilter = { doc: v.doc, objective: v.objective, state: v.state, onlyFavorites: v.onlyFavorites };
    setPrefs({ lastPracticeFilter: f });
    const q = filterToQuery(f);
    setSp(new URLSearchParams(q ? q.slice(1) : ''), { replace: true });
  };

  const start = (sectionFilter: PracticeFilter) => {
    const list = filterQuestions(ctx, sectionFilter);
    if (list.length === 0) return;
    const first = list.find((q) => !progress.questions[q.id]?.last) ?? list[0]!;
    navigate(practiceUrl(first.id, sectionFilter));
  };

  const groups = groupSections(bank.manifest.sections).filter((g) => (!filter.doc || g.sections.some((x) => x.doc === filter.doc)) && (!filter.objective || g.key === 'messerfull'));

  return (
    <div className="page">
      <PageHeader title={es.nav.practice} docTitle={es.nav.practice} description="Elegí qué practicar. Las preguntas se muestran en el orden del PDF." />
      <FilterBar
        value={filter}
        onChange={setFilter}
        countFor={(patch) => filterQuestions(ctx, { ...filter, ...patch, section: undefined }).length}
        total={all.length}
        available={filterAvailable(bank, false)}
        mobile={mobile}
      />
      {all.length === 0 ? (
        <EmptyState
          icon={<SearchX aria-hidden="true" />}
          title={es.filter.empty}
          action={
            <Button variant="primary" onClick={() => setFilter({})}>
              {es.filter.clear}
            </Button>
          }
        />
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.key} className="section" aria-labelledby={`grp-${g.key}`}>
              <h2 id={`grp-${g.key}`}>{g.label}</h2>
              <div className="grid-2">
                {g.sections.map((sec) => {
                  const sf: PracticeFilter = { ...filter, section: sec.section, doc: sec.doc };
                  const list = all.filter((q) => q.section === sec.section);
                  const secQs = bank.indexes.bySection.get(sec.section) ?? [];
                  const pending = list.filter((q) => q.review.status === 'pending').length;
                  const multiple = list.filter((q) => q.selectionType === 'multiple').length;
                  const scorableQs = secQs.filter(isScorable);
                  let answered = 0;
                  let correct = 0;
                  for (const q of scorableQs) {
                    const st = getStudyState(progress.questions[q.id]);
                    if (st === 'correct') correct++;
                    if (st === 'correct' || st === 'incorrect') answered++;
                  }
                  const empty = list.length === 0;
                  return (
                    <article key={sec.section} className={`card ${s.card} ${empty ? 'dim' : ''}`} aria-labelledby={`sec-${sec.section}`}>
                      <h3 id={`sec-${sec.section}`} className="card-title" lang="en">
                        {sec.topic}
                      </h3>
                      {empty ? (
                        <p className="small muted">Ninguna coincide con el filtro</p>
                      ) : (
                        <p className="small muted num">
                          {es.filter.count(list.length)}
                          {pending > 0 && ` · ${pending} ${pending === 1 ? 'pendiente' : 'pendientes'} de revisión`}
                          {multiple > 0 && ` · ${multiple} de selección múltiple`}
                        </p>
                      )}
                      {answered > 0 ? (
                        <div className="stack-sm">
                          <ProgressBar
                            value={answered}
                            max={scorableQs.length}
                            label={`${answered} de ${scorableQs.length} respondidas, ${correct} acertadas`}
                            segments={[
                              { value: correct, tone: 'success', label: 'acertadas' },
                              { value: answered - correct, tone: 'danger', label: 'falladas' },
                            ]}
                          />
                          <span className="small muted num">
                            {answered} respondidas · {correct} acertadas · {answered - correct} falladas
                          </span>
                        </div>
                      ) : (
                        <p className="small subtle">Sin empezar</p>
                      )}
                      <div className={s.cardAction}>
                        <Button
                          variant="secondary"
                          onClick={() => start(sf)}
                          disabled={empty}
                          aria-label={`Practicar ${sectionLabel(sec)}`}
                          icon={<BookOpenCheck size={18} aria-hidden="true" />}
                        >
                          Practicar
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
          <div className={s.bottom}>
            <Button variant="primary" size="lg" wrap onClick={() => start(filter)}>
              Practicar las {all.length} que coinciden con el filtro
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
