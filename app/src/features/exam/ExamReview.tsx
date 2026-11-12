import { ArrowLeft, ArrowRight, TriangleAlert, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBank } from '../../bank/BankProvider';
import { questionOriginLabel } from '../../bank/selectors';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useMediaQuery, MQ } from '../../hooks/useMediaQuery';
import { useShortcuts } from '../../hooks/useShortcuts';
import { es, joinLetters } from '../../i18n/es';
import { useExam } from '../../state/examStore';
import { usePrefs } from '../../state/prefsStore';
import { useProgress } from '../../state/progressStore';
import { toast } from '../../state/toastStore';
import { Button, ButtonLink } from '../../ui/Button/Button';
import { Dialog } from '../../ui/Dialog/Dialog';
import { QuestionNavigator, type NavItemData } from '../../ui/QuestionNavigator/QuestionNavigator';
import { ShortcutsDialog } from '../../ui/ShortcutsDialog/ShortcutsDialog';
import { NotFound } from '../app/NotFound';
import { QuestionPanel } from '../common/QuestionPanel';
import L from '../common/QuestionLayout.module.css';
import { ResultIcon } from './ExamResult';

export function ExamReview() {
  const { attemptId = '', n = '1' } = useParams();
  const navigate = useNavigate();
  const bank = useBank();
  const attempts = useExam((st) => st.attempts);
  const attempt = attempts.attempts.find((a) => a.id === attemptId);
  const pos = Number(n);
  const item = attempt?.items[pos - 1];
  const q = item ? bank.indexes.byId.get(item.questionId) : undefined;
  const wide = useMediaQuery(MQ.wide);
  const mobile = useMediaQuery(MQ.mobile);
  const singleKey = usePrefs((st) => st.prefs.singleKeyShortcuts);
  const toggleFlag = useProgress((st) => st.toggleFlag);
  const toggleFavorite = useProgress((st) => st.toggleFavorite);
  const [fragmentOpen, setFragmentOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  useDocumentTitle(`Revisión · Pregunta ${pos}`);
  useEffect(() => {
    setFragmentOpen(false);
    setNavOpen(false);
  }, [pos]);
  const total = attempt?.items.length ?? 0;
  const go = (p: number) => p >= 1 && p <= total && navigate(`/examen/resultado/${attemptId}/revision/${p}`);
  useShortcuts(
    {
      prev: () => go(pos - 1),
      next: () => go(pos + 1),
      enter: () => go(pos + 1),
      flag: () => q && toast(toggleFlag(q) ? 'Marcada para repasar' : 'Marca de repaso quitada'),
      favorite: () => q && toast(toggleFavorite(q) ? 'Agregada a favoritas' : 'Quitada de favoritas'),
      fragment: () => q && setFragmentOpen(true),
      navigator: () => setNavOpen(true),
      help: () => setHelpOpen(true),
    },
    { enabled: !!item, singleKey, optionLetters: [] },
  );
  if (!attempt || !item) return <NotFound title="No encontramos esa pregunta del intento" />;

  const changed = !q || q.contentHash !== item.contentHash;
  const navItems: NavItemData[] = attempt.items.map((it, i) => ({ index: i, state: it.result, flagged: it.flagged, current: i === pos - 1 }));
  const navigator = <QuestionNavigator items={navItems} onGo={(i) => { setNavOpen(false); go(i + 1); }} mode="review" />;

  return (
    <div className="page" style={{ gap: 'var(--sp-5)' }}>
      <header className="stack-sm">
        <div className={L.topRow}>
          <ButtonLink to={`/examen/resultado/${attempt.id}`} variant="ghost" icon={<Undo2 size={18} aria-hidden="true" />}>
            Volver al resultado
          </ButtonLink>
        </div>
        <h1 tabIndex={-1} className={L.title}>
          Revisión · {es.question.positionLong(pos, total)}
        </h1>
        {q && (
          <p className="small muted" lang="en">
            {questionOriginLabel(q)}
          </p>
        )}
      </header>
      <div className={L.layout}>
        <div className={L.main}>
          {changed && (
            <div className="notice warning" role="status">
              <TriangleAlert size={18} aria-hidden="true" />
              <div>
                <p>El contenido de esta pregunta cambió desde este intento. Se muestra el resultado guardado, sin volver a corregir.</p>
                <p className="row" style={{ marginTop: 8 }}>
                  <ResultIcon result={item.result} />
                  <span>
                    Tu respuesta: {item.selected.length ? joinLetters(item.selected) : '—'} · Clave usada: {joinLetters(item.correct)}
                  </span>
                </p>
              </div>
            </div>
          )}
          {q && !changed && (
            <QuestionPanel
              question={q}
              mode="review"
              position={{ index: pos, total }}
              selected={item.selected}
              onSelect={() => {}}
              result={{ kind: item.result }}
              correctLetters={item.correct}
              revealed={false}
              fragmentOpen={fragmentOpen}
              onFragmentOpenChange={setFragmentOpen}
              onPositionClick={wide ? undefined : () => setNavOpen(true)}
            />
          )}
          <div className={L.actions}>
            <Button onClick={() => go(pos - 1)} disabled={pos <= 1} icon={<ArrowLeft size={18} aria-hidden="true" />} aria-label={mobile ? es.common.previous : undefined}>
              <span className={L.btnText}>{es.common.previous}</span>
            </Button>
            <span />
            <Button
              variant="primary"
              onClick={() => (pos < total ? go(pos + 1) : navigate(`/examen/resultado/${attempt.id}`))}
              iconRight={<ArrowRight size={18} aria-hidden="true" />}
              aria-label={mobile ? (pos < total ? es.common.next : 'Volver al resultado') : undefined}
            >
              <span className={L.btnText}>{pos < total ? es.common.next : 'Volver al resultado'}</span>
            </Button>
          </div>
          <div className={L.reserve} aria-hidden="true" />
        </div>
        <aside className={L.aside} aria-label="Navegador de la revisión">
          <h2 className={L.asideTitle}>Navegador</h2>
          {wide && navigator}
        </aside>
      </div>
      <Dialog open={navOpen} onClose={() => setNavOpen(false)} title={`Preguntas · ${es.question.position(pos, total)}`} size="side">
        {navigator}
      </Dialog>
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} singleKeyEnabled={singleKey} />
    </div>
  );
}
