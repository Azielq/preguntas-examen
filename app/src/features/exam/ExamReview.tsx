import { ArrowLeft, ArrowRight, TriangleAlert, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBank } from '../../bank/BankProvider';
import { questionOriginLabel } from '../../bank/selectors';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useQuestionChrome } from '../../hooks/useLayoutMode';
import { useShortcuts } from '../../hooks/useShortcuts';
import { es, joinLetters } from '../../i18n/es';
import { useAnalysis } from '../../state/analysisStore';
import { useExam } from '../../state/examStore';
import { usePrefs } from '../../state/prefsStore';
import { useProgress } from '../../state/progressStore';
import { toast } from '../../state/toastStore';
import { AiGenerated, AiText } from '../../ui/AiGenerated/AiGenerated';
import { Button, ButtonLink } from '../../ui/Button/Button';
import { QuestionNavigator, type NavItemData } from '../../ui/QuestionNavigator/QuestionNavigator';
import { ShortcutsDialog } from '../../ui/ShortcutsDialog/ShortcutsDialog';
import { NotFound } from '../app/NotFound';
import { focusQuestionHeading, NavigatorSheet } from '../common/NavigatorSheet';
import { QuestionPanel } from '../common/QuestionPanel';
import L from '../common/QuestionLayout.module.css';
import { analysisPlanPath } from './analysisPaths';
import { ResultIcon } from './ExamResult';

export function ExamReview() {
  const { attemptId = '', n = '1' } = useParams();
  const navigate = useNavigate();
  const bank = useBank();
  const attempts = useExam((st) => st.attempts);
  const attempt = attempts.attempts.find((a) => a.id === attemptId);
  const analysis = useAnalysis((st) => st.analyses.byAttempt[attemptId]);
  const pos = Number(n);
  const item = attempt?.items[pos - 1];
  const q = item ? bank.indexes.byId.get(item.questionId) : undefined;
  const singleKey = usePrefs((st) => st.prefs.singleKeyShortcuts);
  const toggleFlag = useProgress((st) => st.toggleFlag);
  const toggleFavorite = useProgress((st) => st.toggleFavorite);
  const [fragmentOpen, setFragmentOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [explOpen, setExplOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [full, setFull] = useState(false);
  const chrome = useQuestionChrome(full);
  useDocumentTitle(`Revisión · Pregunta ${pos}`);
  useEffect(() => {
    setFragmentOpen(false);
    setNavOpen(false);
    setExplOpen(false);
    setDetailOpen(false);
  }, [pos]);
  const total = attempt?.items.length ?? 0;
  const go = (p: number) => p >= 1 && p <= total && navigate(`/examen/resultado/${attemptId}/revision/${p}`);
  const toResult = () => navigate(`/examen/resultado/${attemptId}`);
  const next = () => (pos < total ? go(pos + 1) : toResult());
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
      full: () => setFull((f) => !f),
      explanation: () => setExplOpen(true),
      detail: () => setDetailOpen(true),
    },
    { enabled: !!item, singleKey, optionLetters: [] },
  );

  // "Ver análisis de IA" (PLAN-LAYOUT 9.4): solo con un análisis guardado que incluye esta pregunta; no llama a la API
  const analysisContent = useMemo(() => {
    if (!analysis || !item) return undefined;
    const id = item.questionId;
    const concept = analysis.output.concepts.find((k) => k.questionIds.includes(id));
    const flag = analysis.output.keyFlags.find((f) => f.questionId === id);
    if (!concept && !flag) return undefined;
    const note = concept?.questionNotes.find((x) => x.questionId === id)?.note;
    return (
      <div className="stack">
        {concept && (
          <AiGenerated heading={<h3 className="h3">{concept.name}</h3>}>
            {note ? <AiText>{note}</AiText> : <AiText>{concept.reinforce}</AiText>}
          </AiGenerated>
        )}
        {flag && (
          <AiGenerated label={es.ai.chip}>
            <AiText>{flag.note}</AiText>
            <p className="small muted">{es.ai.keyFlagsNote}</p>
          </AiGenerated>
        )}
        <p>
          <ButtonLink to={analysisPlanPath(attemptId)} variant="ghost">
            Abrir tu plan de estudio
          </ButtonLink>
        </p>
      </div>
    );
  }, [analysis, item, attemptId]);

  if (!attempt || !item) return <NotFound title="No encontramos esa pregunta del intento" />;

  const changed = !q || q.contentHash !== item.contentHash;
  const navItems: NavItemData[] = attempt.items.map((it, i) => ({ index: i, state: it.result, flagged: it.flagged, current: i === pos - 1 }));
  const backLink = (
    <ButtonLink to={`/examen/resultado/${attempt.id}`} variant="ghost" icon={<Undo2 size={18} aria-hidden="true" />} aria-label={chrome.narrow ? 'Volver al resultado' : undefined}>
      {!chrome.narrow && 'Volver al resultado'}
    </ButtonLink>
  );
  const h1 = (
    <h1 tabIndex={-1} className={chrome.narrow || chrome.mode === 'fit-wide' || full ? 'sr-only' : L.title}>
      Revisión · {es.question.positionLong(pos, total)}
    </h1>
  );
  const actions = {
    left: (
      <Button onClick={() => go(pos - 1)} disabled={pos <= 1} icon={<ArrowLeft size={18} aria-hidden="true" />} data-action="prev">
        {es.common.previous}
      </Button>
    ),
    right: (
      <Button variant="primary" onClick={next} iconRight={<ArrowRight size={18} aria-hidden="true" />} data-action={pos < total ? 'next' : 'back-to-result'}>
        {pos < total ? es.common.next : 'Volver al resultado'}
      </Button>
    ),
  };

  if (changed) {
    // contenido cambiado: se muestra el resultado guardado, sin volver a corregir (sin marco de pregunta)
    return (
      <div className="page" style={{ gap: 'var(--sp-5)' }}>
        <header className="stack-sm">
          <div>{backLink}</div>
          {h1}
        </header>
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
        <div className="row-between">
          {actions.left}
          {actions.right}
        </div>
      </div>
    );
  }

  return (
    <>
      <QuestionPanel
        question={q!}
        mode="review"
        position={{ index: pos, total }}
        selected={item.selected}
        onSelect={() => {}}
        result={{ kind: item.result }}
        correctLetters={item.correct}
        revealed={false}
        fragmentOpen={fragmentOpen}
        onFragmentOpenChange={setFragmentOpen}
        onPositionClick={chrome.asideShown ? undefined : () => setNavOpen(true)}
        headerLabel={questionOriginLabel(q!)}
        headerTop={
          <>
            {!full && backLink}
            {h1}
          </>
        }
        full={full}
        onToggleFull={() => setFull((f) => !f)}
        explanationOpen={explOpen}
        onExplanationOpenChange={setExplOpen}
        detailOpen={detailOpen}
        onDetailOpenChange={setDetailOpen}
        onExplanationNext={() => {
          setExplOpen(false);
          next();
          if (pos < total) focusQuestionHeading();
        }}
        explanationNextLabel={pos < total ? es.common.next : 'Volver al resultado'}
        analysisContent={analysisContent}
        onOpenShortcuts={() => setHelpOpen(true)}
        actions={actions}
        asideLabel="Navegador de la revisión"
        aside={
          <>
            <h2 className={L.asideTitle}>Navegador</h2>
            <QuestionNavigator
              items={navItems}
              onGo={(i) => {
                go(i + 1);
              }}
              mode="review"
            />
          </>
        }
      />
      <NavigatorSheet
        open={navOpen}
        onClose={() => setNavOpen(false)}
        title={`Preguntas · ${es.question.position(pos, total)}`}
        items={navItems}
        onGo={(i) => {
          go(i + 1);
          focusQuestionHeading();
        }}
        mode="review"
      />
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} singleKeyEnabled={singleKey} />
    </>
  );
}
