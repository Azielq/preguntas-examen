import { CircleCheck, CircleDashed, CircleX, Flag, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { es } from '../../i18n/es';
import s from './QuestionNavigator.module.css';

export type NavState = 'unseen' | 'seen' | 'correct' | 'incorrect' | 'ungraded' | 'answered' | 'unanswered' | 'partial' | 'omitted';

export interface NavItemData {
  index: number; // 0-based
  state: NavState;
  flagged: boolean;
  current: boolean;
}

const STATE_TEXT: Record<NavState, string> = {
  unseen: es.navigator.unseen,
  seen: es.navigator.seen,
  correct: es.navigator.correct,
  incorrect: es.navigator.incorrect,
  ungraded: es.navigator.ungraded,
  answered: es.navigator.answered,
  unanswered: es.navigator.unanswered,
  partial: es.navigator.partial,
  omitted: es.navigator.omitted,
};

function StateIcon({ st }: { st: NavState }) {
  const p = { size: 12, strokeWidth: 2.25, 'aria-hidden': true as const };
  if (st === 'correct') return <CircleCheck {...p} className={s.iOk} />;
  if (st === 'incorrect') return <CircleX {...p} className={s.iBad} />;
  if (st === 'ungraded') return <TriangleAlert {...p} className={s.iWarn} />;
  if (st === 'omitted') return <CircleDashed {...p} />;
  if (st === 'answered') return <span className={s.dotFull} aria-hidden="true" />;
  if (st === 'partial') return <span className={s.dotHalf} aria-hidden="true" />;
  if (st === 'seen') return <span className={s.dotSeen} aria-hidden="true" />;
  return null;
}

const PAGE = 100;

function legendStates(mode: 'practice' | 'exam' | 'review'): NavState[] {
  return mode === 'exam' ? ['answered', 'unanswered', 'partial'] : mode === 'review' ? ['correct', 'incorrect', 'omitted'] : ['unseen', 'seen', 'correct', 'incorrect', 'ungraded'];
}

/** Leyenda de estados (texto siempre visible). En las hojas va como pie fijo (PLAN-LAYOUT 10). */
export function NavigatorLegend({ mode }: { mode: 'practice' | 'exam' | 'review' }) {
  return (
    <ul role="list" className={s.legend} aria-label={es.navigator.legend}>
      {legendStates(mode).map((st) => (
        <li key={st}>
          <span className={`${s.sample} ${s[st]}`} aria-hidden="true">
            <StateIcon st={st} />
          </span>
          {STATE_TEXT[st]}
        </li>
      ))}
      <li>
        <span className={s.sample} aria-hidden="true">
          <Flag size={10} strokeWidth={2.5} fill="currentColor" className={s.flagLegend} />
        </span>
        {es.navigator.flagged}
      </li>
    </ul>
  );
}

export function QuestionNavigator({
  items,
  onGo,
  mode,
  legend: showLegend = true,
  focusCurrent = false,
}: {
  items: NavItemData[];
  onGo(index: number): void;
  mode: 'practice' | 'exam' | 'review';
  /** sin leyenda propia (la hoja la muestra en su pie) */
  legend?: boolean;
  /** al montar, la pregunta actual queda a la vista y recibe el foco */
  focusCurrent?: boolean;
}) {
  const gridRef = useRef<HTMLOListElement>(null);
  const paged = items.length > 150;
  const currentIdx = items.findIndex((i) => i.current);
  const [page, setPage] = useState(() => (paged && currentIdx >= 0 ? Math.floor(currentIdx / PAGE) : 0));
  useEffect(() => {
    if (paged && currentIdx >= 0) setPage(Math.floor(currentIdx / PAGE));
  }, [paged, currentIdx]);
  const pages = paged ? Math.ceil(items.length / PAGE) : 1;
  const visible = paged ? items.slice(page * PAGE, page * PAGE + PAGE) : items;
  useEffect(() => {
    if (!focusCurrent) return;
    const b = gridRef.current?.querySelector<HTMLButtonElement>('button[aria-current="true"]');
    if (b) {
      b.scrollIntoView?.({ block: 'center', behavior: 'auto' });
      b.focus({ preventScroll: true });
    }
    // solo al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <nav aria-label={es.navigator.label} className={s.nav}>
      {paged && (
        <div className="field">
          <label htmlFor="nav-range">{es.navigator.range}</label>
          <select id="nav-range" className="select" value={page} onChange={(e) => setPage(Number(e.target.value))}>
            {Array.from({ length: pages }, (_, p) => (
              <option key={p} value={p}>
                {p * PAGE + 1}–{Math.min(items.length, (p + 1) * PAGE)}
              </option>
            ))}
          </select>
        </div>
      )}
      <ol role="list" className={s.grid} ref={gridRef}>
        {visible.map((it) => {
          const label = [`${es.question.examLabel(it.index + 1)}`, STATE_TEXT[it.state], it.flagged ? es.navigator.flagged : '', it.current ? es.navigator.current : '']
            .filter(Boolean)
            .join(', ');
          return (
            <li key={it.index}>
              <button
                type="button"
                className={`${s.btn} ${s[it.state]}`}
                aria-label={label}
                title={label}
                aria-current={it.current ? 'true' : undefined}
                onClick={() => onGo(it.index)}
              >
                <span className={s.n}>{it.index + 1}</span>
                <span className={s.icon}>
                  <StateIcon st={it.state} />
                </span>
                {it.flagged && <Flag size={10} strokeWidth={2.5} aria-hidden="true" className={s.flag} fill="currentColor" />}
              </button>
            </li>
          );
        })}
      </ol>
      {showLegend && <NavigatorLegend mode={mode} />}
    </nav>
  );
}
