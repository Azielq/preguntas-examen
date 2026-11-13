import { ArrowLeft, ArrowRight, Flag, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useBank } from '../../bank/BankProvider';
import { useCountdown } from '../../hooks/useCountdown';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useQuestionChrome } from '../../hooks/useLayoutMode';
import { useMediaQuery, MQ } from '../../hooks/useMediaQuery';
import { useShortcuts } from '../../hooks/useShortcuts';
import { es } from '../../i18n/es';
import { useExam } from '../../state/examStore';
import { usePrefs } from '../../state/prefsStore';
import { Button } from '../../ui/Button/Button';
import { Dialog } from '../../ui/Dialog/Dialog';
import { ProgressBar } from '../../ui/Progress/Progress';
import { QuestionCard } from '../../ui/QuestionCard/QuestionCard';
import { QuestionNavigator, type NavItemData } from '../../ui/QuestionNavigator/QuestionNavigator';
import { focusQuestionHeading, NavigatorSheet } from '../common/NavigatorSheet';
import { ShortcutsDialog } from '../../ui/ShortcutsDialog/ShortcutsDialog';
import { Timer } from '../../ui/Timer/Timer';
import L from '../common/QuestionLayout.module.css';

function itemState(selected: string[], required: number): NavItemData['state'] {
  if (selected.length === 0) return 'unanswered';
  return selected.length < required ? 'partial' : 'answered';
}

/** Reloj aislado: solo este componente se re-renderiza en cada tic. */
function ExamClock({ onTimeout }: { onTimeout(): void }) {
  const active = useExam((st) => st.active);
  const tick = useExam((st) => st.tick);
  const persist = useExam((st) => st.persistActive);
  const hidden = usePrefs((st) => st.prefs.timerHidden);
  const setPrefs = usePrefs((st) => st.set);
  const timedOut = useRef(false);
  useCountdown({
    running: !!active,
    onTick: (d) => {
      const a = useExam.getState().active;
      if (!a) return;
      const remaining = a.remainingMs === null ? null : Math.max(0, a.remainingMs - d);
      tick(remaining, a.elapsedMs + d, false);
      if (remaining === 0 && !timedOut.current) {
        timedOut.current = true;
        onTimeout();
      }
    },
    onPersist: persist,
  });
  if (!active || active.remainingMs === null) return null;
  return (
    <Timer
      remainingMs={active.remainingMs}
      totalMs={(active.config.timerMinutes ?? 0) * 60_000}
      hidden={hidden}
      onToggleHidden={() => setPrefs({ timerHidden: !hidden })}
    />
  );
}

export function ExamRunning() {
  const bank = useBank();
  const navigate = useNavigate();
  const active = useExam((st) => st.active);
  const externalChangeAt = useExam((st) => st.externalChangeAt);
  const setAnswer = useExam((st) => st.setAnswer);
  const toggleFlag = useExam((st) => st.toggleFlag);
  const go = useExam((st) => st.go);
  const finish = useExam((st) => st.finish);
  const singleKey = usePrefs((st) => st.prefs.singleKeyShortcuts);
  const fine = useMediaQuery(MQ.finePointer);
  const [full, setFull] = useState(false);
  const chrome = useQuestionChrome(full);
  const [confirm, setConfirm] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const finishing = useRef(false);
  const mountedAt = useRef(Date.now());
  useDocumentTitle(active ? `Examen · Pregunta ${active.currentIndex + 1} de ${active.items.length}` : 'Examen');

  const doFinish = (endedBy: 'user' | 'timeout') => {
    if (finishing.current) return;
    finishing.current = true;
    const attempt = finish(bank.indexes.byId, endedBy);
    if (attempt) navigate(`/examen/resultado/${attempt.id}`, { replace: true });
  };

  const idx = active?.currentIndex ?? 0;
  const item = active?.items[idx];
  const q = item ? bank.indexes.byId.get(item.questionId) : undefined;
  const required = q?.selectionType === 'multiple' ? q.correct.length : 1;

  useShortcuts(
    {
      option: (i) => {
        if (!q || !item) return;
        const o = q.options[i];
        if (!o) return;
        if (q.selectionType === 'single') setAnswer(idx, [o.letter]);
        else if (item.selected.includes(o.letter)) setAnswer(idx, item.selected.filter((l) => l !== o.letter));
        else if (item.selected.length < required) setAnswer(idx, [...item.selected, o.letter]);
      },
      enter: () => active && idx < active.items.length - 1 && go(idx + 1),
      prev: () => idx > 0 && go(idx - 1),
      next: () => active && idx < active.items.length - 1 && go(idx + 1),
      flag: () => toggleFlag(idx),
      navigator: () => setNavOpen(true),
      help: () => setHelpOpen(true),
      full: () => setFull((f) => !f),
    },
    { enabled: !!active, singleKey, optionLetters: q?.options.map((o) => o.letter) ?? [] },
  );

  // al finalizar, la navegación al resultado ya está en curso
  if (!active) return finishing.current ? null : <Navigate to="/examen" replace />;
  if (!q || !item) {
    return (
      <div className="notice danger" role="alert">
        <TriangleAlert size={18} aria-hidden="true" />
        <span>Una pregunta de este examen ya no existe en el banco. Finalizá o descartá el examen.</span>
      </div>
    );
  }

  const answered = active.items.filter((i) => i.selected.length > 0).length;
  const partial = active.items.filter((i) => {
    const qq = bank.indexes.byId.get(i.questionId);
    const req = qq?.selectionType === 'multiple' ? qq.correct.length : 1;
    return i.selected.length > 0 && i.selected.length < req;
  }).length;
  const unanswered = active.items.length - answered;
  const navItems: NavItemData[] = active.items.map((it, i) => {
    const qq = bank.indexes.byId.get(it.questionId);
    return { index: i, state: itemState(it.selected, qq?.selectionType === 'multiple' ? qq.correct.length : 1), flagged: it.flagged, current: i === idx };
  });
  const total = active.items.length;
  const otherTab = externalChangeAt !== null && externalChangeAt > mountedAt.current;
  const isLast = idx >= total - 1;

  return (
    <>
      <QuestionCard
        question={q}
        mode="exam"
        position={{ index: idx + 1, total }}
        headerLabel={es.question.examLabel(idx + 1)}
        selected={item.selected}
        onSelect={(l) => setAnswer(idx, l)}
        answerState="pdf"
        flags={{ favorite: false, flagged: item.flagged }}
        onToggleFlag={() => toggleFlag(idx)}
        showShortcutHints={singleKey && fine}
        onPositionClick={chrome.asideShown ? undefined : () => setNavOpen(true)}
        onClear={() => setAnswer(idx, [])}
        full={full}
        onToggleFull={() => setFull((f) => !f)}
        notices={
          otherTab ? (
            <p className="notice warning" role="status">
              <TriangleAlert size={18} aria-hidden="true" />
              <span>{es.storage.otherTab}</span>
            </p>
          ) : undefined
        }
        headerTop={
          <>
            <h1 tabIndex={-1} className={chrome.narrow || chrome.mode === 'fit-wide' || full ? 'sr-only' : L.title}>
              Examen · {es.question.positionLong(idx + 1, total)}
            </h1>
            {/* el reloj nunca se desmonta al abrir hojas o la vista completa */}
            <ExamClock onTimeout={() => doFinish('timeout')} />
          </>
        }
        headerTopEnd={
          <Button variant="primary" size="sm" icon={<Flag size={16} aria-hidden="true" />} onClick={() => setConfirm(true)} data-action="finish">
            Finalizar
          </Button>
        }
        examProgress={
          <span className={L.progress}>
            <ProgressBar value={answered} max={total} label={`${answered} de ${total} respondidas`} />
            <span className="small muted num">
              {es.layout.answered(answered)}
            </span>
          </span>
        }
        actions={{
          left: (
            <Button onClick={() => go(idx - 1)} disabled={idx === 0} icon={<ArrowLeft size={18} aria-hidden="true" />} data-action="prev">
              {es.common.previous}
            </Button>
          ),
          right: isLast ? (
            <Button variant="primary" onClick={() => setConfirm(true)} iconRight={<Flag size={18} aria-hidden="true" />} data-action="finish">
              Finalizar
            </Button>
          ) : (
            <Button variant="primary" onClick={() => go(idx + 1)} iconRight={<ArrowRight size={18} aria-hidden="true" />} data-action="next">
              {es.common.next}
            </Button>
          ),
        }}
        asideLabel="Navegador del examen"
        aside={
          <>
            <h2 className={L.asideTitle}>Navegador · {es.layout.answered(answered)}</h2>
            <QuestionNavigator items={navItems} onGo={(i) => go(i)} mode="exam" />
          </>
        }
      />
      <NavigatorSheet
        open={navOpen}
        onClose={() => setNavOpen(false)}
        title={`Preguntas · ${es.question.position(idx + 1, total)} · ${es.layout.answered(answered)}`}
        items={navItems}
        onGo={(i) => {
          go(i);
          focusQuestionHeading();
        }}
        mode="exam"
      />
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="¿Finalizar el examen?"
        role="alertdialog"
        actions={
          <>
            <Button onClick={() => setConfirm(false)}>Seguir respondiendo</Button>
            <Button variant="primary" onClick={() => doFinish('user')}>
              Finalizar examen
            </Button>
          </>
        }
      >
        <p>
          Respondiste {answered} de {total}.{' '}
          {unanswered > 0 || partial > 0
            ? `Quedan ${unanswered} sin responder${partial > 0 ? ` y ${partial} ${partial === 1 ? 'incompleta' : 'incompletas'}` : ''}. `
            : ''}
          No vas a poder cambiar las respuestas.
        </p>
      </Dialog>
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} singleKeyEnabled={singleKey} />
    </>
  );
}
