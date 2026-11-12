import { CircleCheck, CircleDashed, CircleX, Copy, FileSearch, Flag, Info, Star, TriangleAlert } from 'lucide-react';
import { forwardRef, useEffect, useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Explanation, Letter, Question } from '../../bank/types';
import { optionStates, type GradeResult, type OptionState } from '../../grading/grade';
import { es, joinLetters } from '../../i18n/es';
import { AnswerStatusBadge, type BadgeStatus } from '../AnswerStatusBadge/AnswerStatusBadge';
import { Button, ToggleIconButton } from '../Button/Button';
import { ExplanationPanel } from '../ExplanationPanel/ExplanationPanel';
import { OptionItem } from '../OptionItem/OptionItem';
import { StemRenderer } from '../StemRenderer/StemRenderer';
import s from './QuestionCard.module.css';

export interface QuestionCardProps {
  question: Question;
  mode: 'practice' | 'exam' | 'review';
  position: { index: number; total: number };
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
  notices?: ReactNode;
  feedbackExtra?: ReactNode;
  onPositionClick?(): void;
  showShortcutHints?: boolean;
}

export const QuestionCard = forwardRef<HTMLButtonElement, QuestionCardProps>(function QuestionCard(props, fragmentRef) {
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
  const [tooMany, setTooMany] = useState(false);
  useEffect(() => setTooMany(false), [q.id]);
  const isExam = mode === 'exam';
  const ungradable = answerState === 'pending' || answerState === 'unknown';
  const locked = !!result || !!revealUnreliable || mode === 'review';
  const required = q.selectionType === 'multiple' ? Math.max(1, q.correct.length) : 1;

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

  const feedback = renderFeedback(mode, result, selected, correct, !!revealUnreliable && ungradable);
  const posText = es.question.position(position.index, position.total);
  return (
    <article className={`${s.card} fade-in`} aria-labelledby={headingId} key={q.id} data-question-id={q.id}>
      <header className={s.head}>
        <h2 id={headingId} className={s.label}>
          {headerLabel}
        </h2>
        <div className={s.headRight}>
          {onPositionClick ? (
            <button type="button" className={s.pos} onClick={onPositionClick} aria-label={`${es.question.positionLong(position.index, position.total)}. ${es.navigator.open}`}>
              {posText}
            </button>
          ) : (
            <span className={s.posStatic} aria-label={es.question.positionLong(position.index, position.total)}>
              {posText}
            </span>
          )}
          {!isExam && onToggleFavorite && (
            <ToggleIconButton pressed={flags.favorite} labelOn={es.question.favoriteOn} labelOff={es.question.favoriteOff} onClick={onToggleFavorite}>
              <Star size={20} strokeWidth={1.75} aria-hidden="true" fill={flags.favorite ? 'currentColor' : 'none'} />
            </ToggleIconButton>
          )}
          <ToggleIconButton
            pressed={flags.flagged}
            labelOn={isExam ? 'Marcada' : es.question.flagOn}
            labelOff={isExam ? es.question.flagShort : es.question.flagOff}
            onClick={onToggleFlag}
            showLabel={isExam}
          >
            <Flag size={20} strokeWidth={1.75} aria-hidden="true" fill={flags.flagged ? 'currentColor' : 'none'} />
          </ToggleIconButton>
        </div>
      </header>

      {!isExam && (
        <div className={s.badgeRow}>
          <AnswerStatusBadge
            status={answerState}
            reasons={ungradable ? q.review.reasons : undefined}
            extra={ungradable ? es.question.pendingNotGraded : undefined}
          />
        </div>
      )}
      {notices}

      <StemRenderer blocks={q.stem} />

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
            onChange={(c) => change(o.letter, c)}
            shortcutHint={showShortcutHints ? String(i + 1) : undefined}
          />
        ))}
      </fieldset>

      {q.selectionType === 'multiple' && (
        <div id={`${headingId}-help`} className={s.help}>
          {locked ? (
            <p>{es.question.multipleRuleReview}</p>
          ) : (
            <>
              <p className={s.helpMain}>{es.question.multipleHelp(required, selected.length)}</p>
              <p>{es.question.multipleRule}</p>
            </>
          )}
        </div>
      )}
      <p className={tooMany ? s.tooMany : 'sr-only'} aria-live="polite">
        {tooMany ? es.question.tooMany(required) : ''}
      </p>
      {isExam && selected.length > 0 && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => onSelect([])}>
            {es.question.clearAnswer}
          </Button>
        </div>
      )}

      <div aria-live="polite" className={s.live}>
        {feedback}
      </div>
      {feedbackExtra}

      {!isExam && revealUnreliable && ungradable && explanation && (
        <ExplanationPanel
          explanation={explanation}
          sourceLabel={explanationSourceLabel ?? ''}
          options={q.options}
          selected={selected}
          variant="unreliable"
          onRetry={onRetryExplanation}
        />
      )}
      {!isExam && result && result.kind !== 'ungraded' && explanation && (
        <ExplanationPanel
          explanation={explanation}
          sourceLabel={explanationSourceLabel ?? ''}
          options={q.options}
          selected={selected}
          correct={correct}
          onRetry={onRetryExplanation}
        />
      )}

      {!isExam && (onOpenFragment || (duplicatesInfo && duplicatesInfo.length > 0) || (notes && notes.length > 0)) && (
        <footer className={s.foot}>
          {onOpenFragment && (
            <div>
              <Button ref={fragmentRef} variant="secondary" icon={<FileSearch size={20} strokeWidth={1.75} aria-hidden="true" />} onClick={onOpenFragment}>
                {es.question.viewFragment}
              </Button>
            </div>
          )}
          {duplicatesInfo && duplicatesInfo.length > 0 && (
            <p className={s.dups}>
              <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>
                {es.question.alsoIn}{' '}
                {duplicatesInfo.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 && ', '}
                    <Link to={d.to}>{d.label}</Link>
                  </span>
                ))}
              </span>
            </p>
          )}
          {notes && notes.length > 0 && (
            <div className="notice info">
              <Info size={18} aria-hidden="true" />
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
        </footer>
      )}
    </article>
  );
});

function renderFeedback(mode: QuestionCardProps['mode'], result: GradeResult | undefined, selected: Letter[], correct: Letter[], revealed: boolean) {
  if (revealed) {
    return (
      <div className={`notice warning rise-in`} data-feedback="unreliable">
        <TriangleAlert size={20} aria-hidden="true" />
        <p>{es.question.pendingReveal(joinLetters(correct))}</p>
      </div>
    );
  }
  if (!result || result.kind === 'ungraded') return null;
  const sel = joinLetters(selected);
  const cor = joinLetters(correct);
  const review = mode === 'review';
  if (result.kind === 'correct') {
    return (
      <div className="notice success rise-in" data-feedback="correct">
        <CircleCheck size={20} aria-hidden="true" />
        <div>
          <p className="notice-title">{review ? 'Correcta' : es.question.correct}</p>
          <p>{es.question.resultCorrect(sel)}</p>
        </div>
      </div>
    );
  }
  if (result.kind === 'incorrect') {
    return (
      <div className="notice danger rise-in" data-feedback="incorrect">
        <CircleX size={20} aria-hidden="true" />
        <div>
          <p className="notice-title">{review ? 'Incorrecta' : es.question.incorrect}</p>
          <p>{es.question.resultIncorrect(sel, cor)}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="notice rise-in" data-feedback="omitted">
      <CircleDashed size={20} aria-hidden="true" />
      <div>
        <p className="notice-title">{es.question.omitted}</p>
        <p>{es.question.resultOmitted(cor)}</p>
      </div>
    </div>
  );
}
