import { CircleCheck, CircleDashed, CircleX, Copy, ExternalLink, FileSearch, FileText, Flag, Info, Keyboard, ListChecks, MoreHorizontal, RotateCcw, Sparkles, Star, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Explanation, Letter, Objective, Question } from '../../bank/types';
import { optionStates, type GradeResult, type OptionState } from '../../grading/grade';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { MQ, useMediaQuery } from '../../hooks/useMediaQuery';
import { es, joinLetters } from '../../i18n/es';
import { AnswerStatusBadge, type BadgeStatus } from '../AnswerStatusBadge/AnswerStatusBadge';
import { Button, ToggleIconButton } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { ExplanationPanel } from '../ExplanationPanel/ExplanationPanel';
import { OptionItem } from '../OptionItem/OptionItem';
import { QuestionScreen, useQuestionFit, type ActionBarSlots } from '../QuestionScreen/QuestionScreen';
import type { FitState } from '../QuestionScreen/fit';
import { StemRenderer } from '../StemRenderer/StemRenderer';
import s from './QuestionCard.module.css';

export interface QuestionCardProps {
  question: Question;
  mode: 'practice' | 'exam' | 'review';
  position: { index: number; total: number };
  /** rótulo h2 de la pregunta ("Question 37 · pág. 122"; en revisión, el origen literal; en examen "Pregunta 3") */
  headerLabel: string;
  selected: Letter[];
  onSelect(letters: Letter[]): void;
  /** presente cuando está comprobada o en revisión */
  result?: GradeResult;
  /** clave a mostrar (en revisión, la guardada en el intento) */
  correctLetters?: Letter[];
  answerState: BadgeStatus;
  /** pendiente: el usuario pidió ver lo que dice el PDF */
  revealUnreliable?: boolean;
  explanation?: Explanation | 'loading' | 'error';
  explanationSourceLabel?: string;
  onRetryExplanation?(): void;
  flags: { favorite: boolean; flagged: boolean };
  onToggleFavorite?(): void;
  onToggleFlag(): void;
  onOpenFragment?(): void;
  duplicatesInfo?: { id: string; label: string; to: string }[];
  notes?: string[];
  /** avisos que no pueden esperar, al principio del área (examen: otra pestaña; revisión: contenido cambiado) */
  notices?: ReactNode;
  feedbackExtra?: ReactNode;
  onPositionClick?(): void;
  showShortcutHints?: boolean;

  // ---- marco (PLAN-LAYOUT) ----
  /** fila A del encabezado (navegación propia de la pantalla); la posición se agrega al final */
  headerTop?: ReactNode;
  /** después de la posición en la fila A (p. ej. "Finalizar" del examen) */
  headerTopEnd?: ReactNode;
  /** examen: barra de progreso y "N respondidas" en la fila B */
  examProgress?: ReactNode;
  actions?: ActionBarSlots;
  aside?: ReactNode;
  asideLabel?: string;
  full?: boolean;
  onToggleFull?(): void;
  /** texto de ayuda antes de comprobar (id para aria-describedby de "Comprobar") */
  statusHint?: string;
  statusHintId?: string;
  /** "Última vez: incorrecta · hace 2 días" */
  lastTime?: string | null;
  /** contenido de "Ver detalle" */
  listTitle?: string;
  listTitleLang?: string;
  contentChanged?: boolean;
  planNote?: string;
  /** hojas controladas desde la pantalla (atajos X e I); sin control, estado interno */
  explanationOpen?: boolean;
  onExplanationOpenChange?(open: boolean): void;
  detailOpen?: boolean;
  onDetailOpenChange?(open: boolean): void;
  /** pie de la hoja de explicación: cierra y avanza */
  onExplanationNext?(): void;
  explanationNextLabel?: string;
  /** "Ver análisis de IA" (solo revisión con análisis guardado que incluye la pregunta) */
  analysisContent?: ReactNode;
  /** examen: borrar la respuesta (en la franja) */
  onClear?(): void;
  onOpenShortcuts?(): void;
  /** solo tests: fuerza el estado de ajuste del área */
  forceFit?: FitState;
}

/** Solo https: el enlace externo del objetivo nunca puede ser `javascript:` ni otro esquema. */
function safeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

function ObjectiveMeta({ objective }: { objective: Objective }) {
  if ('raw' in objective) {
    return (
      <span className={s.objective}>
        <span className="sr-only">{es.layout.objectiveRaw}: </span>
        <span lang="en">{objective.raw}</span>
      </span>
    );
  }
  const href = safeUrl(objective.url);
  const text = (
    <>
      {es.layout.objectiveLink(objective.code)} · <span lang="en">{objective.title}</span>
    </>
  );
  return href ? (
    <a className={s.objective} href={href} target="_blank" rel="noopener noreferrer" title={`${es.layout.objective}. ${es.layout.openExternal}`}>
      {text}
      <ExternalLink size={14} aria-hidden="true" />
      <span className="sr-only"> {es.layout.openExternal}</span>
    </a>
  ) : (
    <span className={s.objective}>{text}</span>
  );
}

export function QuestionCard(props: QuestionCardProps) {
  const {
    question: q,
    mode,
    position,
    headerLabel,
    selected,
    onSelect,
    result,
    answerState,
    revealUnreliable,
    explanation,
    explanationSourceLabel,
    onRetryExplanation,
    flags,
    onToggleFavorite,
    onToggleFlag,
    onOpenFragment,
    duplicatesInfo,
    notes,
    notices,
    feedbackExtra,
    onPositionClick,
    showShortcutHints,
  } = props;
  const correct = props.correctLetters ?? q.correct;
  const headingId = useId();
  const narrow = useMediaQuery(MQ.narrow);
  const tiny = useMediaQuery(MQ.tiny);
  const layoutMode = useLayoutMode(false);
  const [tooMany, setTooMany] = useState(false);
  const [explOpenInner, setExplOpenInner] = useState(false);
  const [detailOpenInner, setDetailOpenInner] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    setTooMany(false);
    setAnalysisOpen(false);
    setMoreOpen(false);
  }, [q.id]);
  const explOpen = props.explanationOpen ?? explOpenInner;
  const setExplOpen = (o: boolean) => (props.onExplanationOpenChange ? props.onExplanationOpenChange(o) : setExplOpenInner(o));
  const detailOpen = props.detailOpen ?? detailOpenInner;
  const setDetailOpen = (o: boolean) => (props.onDetailOpenChange ? props.onDetailOpenChange(o) : setDetailOpenInner(o));

  const isExam = mode === 'exam';
  const ungradable = answerState === 'pending' || answerState === 'unknown';
  const locked = !!result || !!revealUnreliable || mode === 'review';
  const required = q.selectionType === 'multiple' ? Math.max(1, q.correct.length) : 1;
  const full = !!props.full;

  let states: Record<Letter, OptionState>;
  if (result) states = optionStates(q, correct, selected, result);
  else if (revealUnreliable) states = optionStates(q, correct, selected, { kind: 'ungraded', reason: 'pending_review' });
  else states = Object.fromEntries(q.options.map((o) => [o.letter, selected.includes(o.letter) ? 'selected' : 'idle'])) as Record<Letter, OptionState>;

  const change = (letter: Letter, checked: boolean) => {
    if (locked) return;
    if (q.selectionType === 'single') {
      setTooMany(false);
      onSelect(checked ? [letter] : []);
      return;
    }
    if (checked) {
      if (selected.length >= required) {
        setTooMany(true);
        return;
      }
      setTooMany(false);
      onSelect([...selected, letter]);
    } else {
      setTooMany(false);
      onSelect(selected.filter((l) => l !== letter));
    }
  };

  // ---- explicación bajo demanda ----
  const revealed = !!revealUnreliable && ungradable;
  const graded = !!result && result.kind !== 'ungraded';
  const hasExplanation = !isExam && !!explanation && (graded || revealed);
  const explKind: 'pdf' | 'ai' | 'unreliable' = revealed ? 'unreliable' : typeof explanation === 'object' && explanation.origin === 'ai' ? 'ai' : 'pdf';
  const explLabel = { pdf: es.layout.explanationPdf, ai: es.layout.explanationAi, unreliable: es.layout.explanationUnreliable }[explKind];
  const explShort = { pdf: es.layout.explanationPdfShort, ai: es.layout.explanationAiShort, unreliable: es.layout.explanationUnreliableShort }[explKind];
  const ExplIcon = explKind === 'ai' ? Sparkles : explKind === 'unreliable' ? TriangleAlert : FileText;
  const explBtn = hasExplanation && (
    <Button
      size="sm"
      wrap
      className={`${s.explBtn} ${s[`expl_${explKind}`]}`}
      onClick={() => setExplOpen(true)}
      aria-label={tiny ? `${explShort}: ${explLabel}` : explLabel}
      data-action="explanation"
      data-origin={explKind}
      icon={<ExplIcon size={16} aria-hidden="true" />}
    >
      {tiny ? explShort : explLabel}
    </Button>
  );

  // ---- detalle / motivo ----
  const pendingHidden = ungradable && !revealed && !isExam;
  const dups = duplicatesInfo ?? [];
  const noteList = notes ?? [];
  const detailCount = (props.contentChanged ? 1 : 0) + (dups.length > 0 ? 1 : 0) + (noteList.length > 0 ? 1 : 0) + (ungradable ? 1 : 0) + (props.planNote ? 1 : 0);
  const detailLabel = ungradable ? es.layout.reason : detailCount > 0 ? es.layout.detailN(detailCount) : es.layout.detail;
  const detailBtn = (
    <Button size="sm" wrap variant="ghost" onClick={() => setDetailOpen(true)} data-action="detail" icon={<Info size={16} aria-hidden="true" />}>
      {detailLabel}
    </Button>
  );
  const fragmentBtn = onOpenFragment && (
    <Button size="sm" wrap variant="ghost" onClick={onOpenFragment} data-action="fragment" icon={<FileSearch size={16} aria-hidden="true" />}>
      {es.question.viewFragment}
    </Button>
  );
  const analysisBtn = props.analysisContent && (
    <Button size="sm" wrap variant="ghost" onClick={() => setAnalysisOpen(true)} data-action="analysis" icon={<Sparkles size={16} aria-hidden="true" />}>
      {es.layout.analysis}
    </Button>
  );
  const favBtn = !isExam && onToggleFavorite && (
    <ToggleIconButton pressed={flags.favorite} labelOn={es.question.favoriteOn} labelOff={es.question.favoriteOff} onClick={onToggleFavorite}>
      <Star size={20} strokeWidth={1.75} aria-hidden="true" fill={flags.favorite ? 'currentColor' : 'none'} />
    </ToggleIconButton>
  );
  const flagBtn = (
    <ToggleIconButton
      pressed={flags.flagged}
      labelOn={isExam ? 'Marcada' : es.question.flagOn}
      labelOff={isExam ? es.question.flagShort : es.question.flagOff}
      onClick={onToggleFlag}
      showLabel={isExam}
    >
      <Flag size={20} strokeWidth={1.75} aria-hidden="true" fill={flags.flagged ? 'currentColor' : 'none'} />
    </ToggleIconButton>
  );

  const posText = es.question.position(position.index, position.total);
  const posEl = onPositionClick ? (
    <button
      type="button"
      className={s.pos}
      onClick={onPositionClick}
      data-action="navigator"
      aria-label={`${posText} · ${es.question.positionLong(position.index, position.total)}. ${es.navigator.open}`}
    >
      {posText}
    </button>
  ) : (
    <span className={s.posStatic} aria-label={es.question.positionLong(position.index, position.total)}>
      {posText}
    </span>
  );

  // ---- fila B del encabezado ----
  // < 480 px o fit-wide: Favorita, fragmento, detalle, análisis y atajos se agrupan en "Más"
  const compact = narrow || layoutMode === 'fit-wide';
  const h2 = (
    <h2 id={headingId} className={s.label} tabIndex={-1} data-focus-fallback="" lang={mode === 'review' ? 'en' : undefined}>
      {headerLabel}
    </h2>
  );
  const objective = !isExam && q.objective ? q.objective : undefined;
  let rowB: ReactNode;
  if (isExam) {
    rowB = (
      <>
        {h2}
        {!full && props.examProgress}
        <span className={s.push}>{flagBtn}</span>
      </>
    );
  } else if (full) {
    rowB = (
      <>
        {h2}
        <span className={s.push}>{flagBtn}</span>
      </>
    );
  } else {
    rowB = (
      <>
        {h2}
        <AnswerStatusBadge status={answerState} size="sm" />
        <span className={s.toggles}>
          {!compact && favBtn}
          {flagBtn}
          {!compact && fragmentBtn}
          {!compact && !pendingHidden && detailBtn}
          {!compact && analysisBtn}
          {compact && (
            <Button size="sm" variant="ghost" onClick={() => setMoreOpen(true)} data-action="more" icon={<MoreHorizontal size={18} aria-hidden="true" />}>
              {es.layout.more}
            </Button>
          )}
        </span>
      </>
    );
  }

  // ---- franja de estado ----
  const status = (
    <StatusStrip
      mode={mode}
      result={result}
      revealed={revealed}
      pendingHidden={pendingHidden}
      selected={selected}
      correct={correct}
      required={required}
      multiple={q.selectionType === 'multiple'}
      hint={props.statusHint}
      hintId={props.statusHintId}
      lastTime={props.lastTime}
      feedbackExtra={feedbackExtra}
      explBtn={explBtn}
      reasonBtn={
        pendingHidden ? (
          <Button size="sm" wrap onClick={() => setDetailOpen(true)} data-action="detail" icon={<Info size={16} aria-hidden="true" />}>
            {es.layout.reason}
          </Button>
        ) : null
      }
      onClear={props.onClear}
    />
  );

  const body = (
    <QuestionBody
      q={q}
      headingId={headingId}
      selected={selected}
      locked={locked}
      states={states}
      required={required}
      tooMany={tooMany}
      onChange={change}
      notices={notices}
      showShortcutHints={showShortcutHints}
    />
  );

  const verdictText = recapText(mode, result, selected, correct, revealed);
  const detailTitle = ungradable ? es.layout.reasonTitle(q.originalLabel) : es.layout.detailTitle(q.originalLabel);

  return (
    <>
      <QuestionScreen
        kind={mode}
        questionKey={q.id}
        headerTop={
          <>
            {props.headerTop}
            {/* el objetivo va en la fila A (espacio libre entre "Volver" y la posición): no suma una fila */}
            {objective && !compact && !full && (
              <span className={s.objectiveRow}>
                <ObjectiveMeta objective={objective} />
              </span>
            )}
            <span className={s.pushPos}>{posEl}</span>
            {props.headerTopEnd}
          </>
        }
        headerQuestion={<div className={s.rowB}>{rowB}</div>}
        status={status}
        actions={props.actions ?? { left: null, right: null }}
        aside={props.aside}
        asideLabel={props.asideLabel}
        full={full}
        onToggleFull={props.onToggleFull}
        articleProps={{ 'data-question-id': q.id, 'aria-labelledby': headingId }}
        forceFit={props.forceFit}
      >
        {body}
      </QuestionScreen>

      {hasExplanation && (
        <Dialog
          open={explOpen}
          onClose={() => setExplOpen(false)}
          title={es.layout.explanationTitle(q.originalLabel)}
          size="reading"
          sheet="explanation"
          focusTitle
          subheader={verdictText ? <p className={s.recap}>{verdictText}</p> : undefined}
          actions={
            <>
              <Button onClick={() => setExplOpen(false)}>{es.common.close}</Button>
              {props.onExplanationNext && (
                <Button variant="primary" onClick={() => props.onExplanationNext?.()} data-action="next">
                  {props.explanationNextLabel ?? es.common.next}
                </Button>
              )}
            </>
          }
        >
          {explOpen && explanation && (
            <ExplanationPanel
              explanation={explanation}
              sourceLabel={explanationSourceLabel ?? ''}
              options={q.options}
              selected={selected}
              correct={revealed ? undefined : correct}
              variant={revealed ? 'unreliable' : 'normal'}
              onRetry={onRetryExplanation}
            />
          )}
        </Dialog>
      )}

      {!isExam && (
        <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} title={detailTitle} size="reading" sheet="detail" focusTitle>
          {detailOpen && (
            <DetailBody
              q={q}
              listTitle={props.listTitle}
              listTitleLang={props.listTitleLang}
              lastTime={props.lastTime}
              contentChanged={props.contentChanged}
              duplicates={dups}
              notes={noteList}
              ungradable={ungradable}
              objective={objective}
              planNote={props.planNote}
            />
          )}
        </Dialog>
      )}

      {props.analysisContent && (
        <Dialog open={analysisOpen} onClose={() => setAnalysisOpen(false)} title={es.layout.analysisTitle(q.originalLabel)} size="reading" sheet="analysis" focusTitle>
          {analysisOpen && props.analysisContent}
        </Dialog>
      )}

      {!isExam && compact && (
        <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title={es.layout.moreTitle} size="sheet" sheet="more">
          {moreOpen && (
            <ul role="list" className={s.moreList}>
              {onToggleFavorite && (
                <li>
                  <Button
                    wrap
                    variant="ghost"
                    className={s.moreItem}
                    aria-pressed={flags.favorite}
                    onClick={onToggleFavorite}
                    icon={<Star size={18} aria-hidden="true" fill={flags.favorite ? 'currentColor' : 'none'} />}
                  >
                    {flags.favorite ? es.question.favoriteOn : es.question.favoriteOff}
                  </Button>
                </li>
              )}
              {onOpenFragment && (
                <li>
                  <Button
                    wrap
                    variant="ghost"
                    className={s.moreItem}
                    onClick={() => {
                      setMoreOpen(false);
                      onOpenFragment();
                    }}
                    icon={<FileSearch size={18} aria-hidden="true" />}
                  >
                    {es.question.viewFragment}
                  </Button>
                </li>
              )}
              <li>
                <Button
                  wrap
                  variant="ghost"
                  className={s.moreItem}
                  onClick={() => {
                    setMoreOpen(false);
                    setDetailOpen(true);
                  }}
                  icon={<Info size={18} aria-hidden="true" />}
                >
                  {detailLabel}
                </Button>
              </li>
              {props.analysisContent && (
                <li>
                  <Button
                    wrap
                    variant="ghost"
                    className={s.moreItem}
                    onClick={() => {
                      setMoreOpen(false);
                      setAnalysisOpen(true);
                    }}
                    icon={<Sparkles size={18} aria-hidden="true" />}
                  >
                    {es.layout.analysis}
                  </Button>
                </li>
              )}
              {props.onOpenShortcuts && (
                <li>
                  <Button
                    wrap
                    variant="ghost"
                    className={s.moreItem}
                    onClick={() => {
                      setMoreOpen(false);
                      props.onOpenShortcuts?.();
                    }}
                    icon={<Keyboard size={18} aria-hidden="true" />}
                  >
                    {es.layout.shortcuts}
                  </Button>
                </li>
              )}
              {objective && (
                <li className={s.moreObjective}>
                  <ObjectiveMeta objective={objective} />
                </li>
              )}
            </ul>
          )}
        </Dialog>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------

function QuestionBody({
  q,
  headingId,
  selected,
  locked,
  states,
  required,
  tooMany,
  onChange,
  notices,
  showShortcutHints,
}: {
  q: Question;
  headingId: string;
  selected: Letter[];
  locked: boolean;
  states: Record<Letter, OptionState>;
  required: number;
  tooMany: boolean;
  onChange(letter: Letter, checked: boolean): void;
  notices?: ReactNode;
  showShortcutHints?: boolean;
}) {
  const { fit, stemMax, stemAtEnd } = useQuestionFit();
  const bounded = fit === 'stem-scroll' && stemMax !== null;
  return (
    <div className={s.body} data-qbody="">
      {notices && <div className={s.notices}>{notices}</div>}
      <div className={s.stemWrap} data-at-end={bounded ? (stemAtEnd ? 'true' : 'false') : undefined}>
        <div
          className={`${s.stemViewport} ${bounded ? s.bounded : ''}`}
          data-stem-viewport=""
          style={bounded ? { maxHeight: `${stemMax}px` } : undefined}
          tabIndex={bounded ? 0 : undefined}
          role={bounded ? 'group' : undefined}
          aria-label={bounded ? es.layout.stemViewport : undefined}
        >
          <StemRenderer blocks={q.stem} />
        </div>
      </div>
      <div className={s.optionsCol}>
        <fieldset className={s.options} aria-describedby={q.selectionType === 'multiple' ? `${headingId}-help` : undefined}>
          <legend className="sr-only">
            {es.question.optionsLegend}
            {q.selectionType === 'multiple' ? `. ${es.question.chooseN(required)}` : ''}
          </legend>
          {q.options.map((o, i) => (
            <OptionItem
              key={o.id}
              option={o}
              type={q.selectionType}
              name={`q-${q.id}`}
              checked={selected.includes(o.letter)}
              disabled={locked}
              state={states[o.letter] ?? 'idle'}
              onChange={(c) => onChange(o.letter, c)}
              shortcutHint={showShortcutHints ? String(i + 1) : undefined}
            />
          ))}
        </fieldset>
        {q.selectionType === 'multiple' && (
          <div id={`${headingId}-help`} className={s.help}>
            <p>{locked ? es.question.multipleRuleReview : es.question.multipleRule}</p>
          </div>
        )}
        <p className={tooMany ? s.tooMany : 'sr-only'} aria-live="polite">
          {tooMany ? es.question.tooMany(required) : ''}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------

/** Veredicto en una línea (texto de la app): recapitulación en la subcabecera de la hoja de explicación. */
function recapText(mode: QuestionCardProps['mode'], result: GradeResult | undefined, selected: Letter[], correct: Letter[], revealed: boolean): string {
  if (revealed) return es.question.pendingReveal(joinLetters(correct));
  if (!result || result.kind === 'ungraded') return '';
  const sel = joinLetters(selected);
  const cor = joinLetters(correct);
  if (result.kind === 'correct') return `${mode === 'review' ? 'Correcta' : es.question.correct}. ${es.question.resultCorrect(sel)}`;
  if (result.kind === 'incorrect') return `${mode === 'review' ? 'Incorrecta' : es.question.incorrect}. ${es.question.resultIncorrect(sel, cor)}`;
  return `${es.question.omitted}. ${es.question.resultOmitted(cor)}`;
}

function StatusStrip({
  mode,
  result,
  revealed,
  pendingHidden,
  selected,
  correct,
  required,
  multiple,
  hint,
  hintId,
  lastTime,
  feedbackExtra,
  explBtn,
  reasonBtn,
  onClear,
}: {
  mode: QuestionCardProps['mode'];
  result?: GradeResult;
  revealed: boolean;
  pendingHidden: boolean;
  selected: Letter[];
  correct: Letter[];
  required: number;
  multiple: boolean;
  hint?: string;
  hintId?: string;
  lastTime?: string | null;
  feedbackExtra?: ReactNode;
  explBtn: ReactNode;
  reasonBtn: ReactNode;
  onClear?(): void;
}) {
  const verdict = renderVerdict(mode, result, selected, correct, revealed);
  let left: ReactNode = null;
  if (mode === 'exam') {
    const t = selected.length === 0 ? 'Sin responder' : multiple && selected.length < required ? es.question.multipleHelp(required, selected.length) : 'Respuesta guardada';
    left = <p className={s.stripText}>{t}</p>;
  } else if (!verdict) {
    left = (
      <div className={s.stripText}>
        {pendingHidden ? (
          <p className={s.pendingLine}>
            <TriangleAlert size={16} aria-hidden="true" /> {es.question.pendingNotGraded}
          </p>
        ) : (
          hint && <p id={hintId}>{hint}</p>
        )}
        {lastTime && (
          <p className={s.lastTime}>
            <RotateCcw size={14} aria-hidden="true" /> {lastTime}
          </p>
        )}
      </div>
    );
  }
  const right =
    mode === 'exam'
      ? onClear &&
        selected.length > 0 && (
          <Button size="sm" variant="ghost" wrap onClick={onClear} data-action="clear">
            {es.question.clearAnswer}
          </Button>
        )
      : (explBtn || reasonBtn) ?? null;
  return (
    <div className={s.strip}>
      <div className={s.stripLeft}>
        {left}
        <div aria-live="polite" className={s.live}>
          {verdict}
        </div>
        {verdict && feedbackExtra && <div className={s.extra}>{feedbackExtra}</div>}
      </div>
      {right && <div className={s.stripRight}>{right}</div>}
    </div>
  );
}

function renderVerdict(mode: QuestionCardProps['mode'], result: GradeResult | undefined, selected: Letter[], correct: Letter[], revealed: boolean) {
  if (mode === 'exam') return null;
  if (revealed) {
    return (
      <p className={`${s.verdict} ${s.vWarn}`} data-feedback="unreliable">
        <TriangleAlert size={18} aria-hidden="true" />
        <span>{es.question.pendingReveal(joinLetters(correct))}</span>
      </p>
    );
  }
  if (!result || result.kind === 'ungraded') return null;
  const sel = joinLetters(selected);
  const cor = joinLetters(correct);
  const review = mode === 'review';
  if (result.kind === 'correct') {
    return (
      <p className={`${s.verdict} ${s.vOk}`} data-feedback="correct">
        <CircleCheck size={18} aria-hidden="true" />
        <span>
          <span className={s.vTitle}>{review ? 'Correcta' : es.question.correct}</span> <span>{es.question.resultCorrect(sel)}</span>
        </span>
      </p>
    );
  }
  if (result.kind === 'incorrect') {
    return (
      <p className={`${s.verdict} ${s.vBad}`} data-feedback="incorrect">
        <CircleX size={18} aria-hidden="true" />
        <span>
          <span className={s.vTitle}>{review ? 'Incorrecta' : es.question.incorrect}</span> <span>{es.question.resultIncorrect(sel, cor)}</span>
        </span>
      </p>
    );
  }
  return (
    <p className={`${s.verdict} ${s.vOmit}`} data-feedback="omitted">
      <CircleDashed size={18} aria-hidden="true" />
      <span>
        <span className={s.vTitle}>{es.question.omitted}</span> <span>{es.question.resultOmitted(cor)}</span>
      </span>
    </p>
  );
}

// ---------------------------------------------------------------------------------------------------------------

function DetailBody({
  q,
  listTitle,
  listTitleLang,
  lastTime,
  contentChanged,
  duplicates,
  notes,
  ungradable,
  objective,
  planNote,
}: {
  q: Question;
  listTitle?: string;
  listTitleLang?: string;
  lastTime?: string | null;
  contentChanged?: boolean;
  duplicates: { id: string; label: string; to: string }[];
  notes: string[];
  ungradable: boolean;
  objective?: Objective;
  planNote?: string;
}) {
  return (
    <div className={s.detail}>
      {ungradable && (
        <section className="notice warning" aria-label={es.badge.pending}>
          <TriangleAlert size={18} aria-hidden="true" />
          <div>
            <p className="notice-title">{es.badge.pending}</p>
            <p>{es.question.pendingNotGraded}</p>
            {q.review.reasons.length > 0 && (
              <>
                <p className={s.detailLabel}>{es.question.pendingReason}</p>
                <ul className={s.notes}>
                  {q.review.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
      )}
      {listTitle && (
        <div>
          <p className={s.detailLabel}>{es.layout.listTitle}</p>
          <p lang={listTitleLang}>{listTitle}</p>
          {planNote && <p className="small muted">{planNote}</p>}
        </div>
      )}
      {objective && (
        <div>
          <p className={s.detailLabel}>{es.layout.objective}</p>
          <p>
            <ObjectiveMeta objective={objective} />
          </p>
        </div>
      )}
      {lastTime && <p>{lastTime}</p>}
      {contentChanged && (
        <p className="notice warning">
          <RotateCcw size={18} aria-hidden="true" />
          <span>{es.question.contentChanged}</span>
        </p>
      )}
      {duplicates.length > 0 && (
        <div className={s.dups}>
          <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>
            {es.question.alsoIn}{' '}
            {duplicates.map((d, i) => (
              <span key={d.id}>
                {i > 0 && ', '}
                <Link to={d.to}>{d.label}</Link>
              </span>
            ))}
          </span>
        </div>
      )}
      {notes.length > 0 && (
        <div className="notice info">
          <ListChecks size={18} aria-hidden="true" />
          <div>
            <p className="notice-title">{es.question.extractionNote}</p>
            <ul className={s.notes}>
              {notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
