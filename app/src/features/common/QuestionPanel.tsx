import { Info, RotateCcw } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { useBank } from '../../bank/BankProvider';
import { assetUrl } from '../../bank/loadBank';
import { answerSourceLabel, getAnswerState, questionHeaderLabel } from '../../bank/selectors';
import type { Letter, Question } from '../../bank/types';
import type { GradeResult } from '../../grading/grade';
import { useMediaQuery, MQ } from '../../hooks/useMediaQuery';
import { es } from '../../i18n/es';
import { usePrefs } from '../../state/prefsStore';
import { useProgress } from '../../state/progressStore';
import { toast } from '../../state/toastStore';
import { PdfFragmentModal } from '../../ui/PdfFragmentModal/PdfFragmentModal';
import { QuestionCard } from '../../ui/QuestionCard/QuestionCard';
import { duplicatesInfo, lastTimeText } from '../practice/practiceUtils';
import { useExplanation, useFragment } from './useQuestionContent';

export interface QuestionPanelProps {
  question: Question;
  mode: 'practice' | 'review';
  position: { index: number; total: number };
  selected: Letter[];
  onSelect(l: Letter[]): void;
  result?: GradeResult;
  correctLetters?: Letter[];
  revealed: boolean;
  fragmentOpen: boolean;
  onFragmentOpenChange(open: boolean): void;
  onPositionClick?(): void;
  showLastTime?: boolean;
  feedbackExtra?: ReactNode;
  extraNotices?: ReactNode;
}

/** Conecta QuestionCard con el progreso (favorita, marca), explicaciones y fragmentos. */
export function QuestionPanel(p: QuestionPanelProps) {
  const bank = useBank();
  const q = p.question;
  const prog = useProgress((s) => s.state.questions[q.id]);
  const toggleFavorite = useProgress((s) => s.toggleFavorite);
  const toggleFlag = useProgress((s) => s.toggleFlag);
  const singleKey = usePrefs((s) => s.prefs.singleKeyShortcuts);
  const fine = useMediaQuery(MQ.finePointer);
  const fragBtn = useRef<HTMLButtonElement>(null);
  const answerState = getAnswerState(q);
  const showExplanation = !!p.result || p.revealed;
  const expl = useExplanation(q, showExplanation);
  const frag = useFragment(q, p.fragmentOpen);
  const answered = !!p.result || p.revealed || p.mode === 'review';

  const notices: ReactNode[] = [];
  if (prog?.contentChanged) {
    notices.push(
      <p key="changed" className="notice warning">
        <RotateCcw size={18} aria-hidden="true" />
        <span>{es.question.contentChanged}</span>
      </p>,
    );
  }
  const lt = p.showLastTime && !answered ? lastTimeText(prog) : null;
  if (lt) {
    notices.push(
      <p key="last" className="chip" style={{ width: 'fit-content' }}>
        <Info size={14} aria-hidden="true" />
        {lt}
      </p>,
    );
  }
  if (p.extraNotices) notices.push(<div key="extra">{p.extraNotices}</div>);

  return (
    <>
      <QuestionCard
        ref={fragBtn}
        question={q}
        mode={p.mode}
        position={p.position}
        headerLabel={questionHeaderLabel(q)}
        selected={p.selected}
        onSelect={p.onSelect}
        result={p.result}
        correctLetters={p.correctLetters}
        answerState={answerState}
        revealUnreliable={p.revealed}
        explanation={showExplanation ? expl.value : undefined}
        explanationSourceLabel={answerSourceLabel(q.answerSource)}
        onRetryExplanation={expl.retry}
        flags={{ favorite: !!prog?.favorite, flagged: !!prog?.flagged }}
        onToggleFavorite={() => toast(toggleFavorite(q) ? 'Agregada a favoritas' : 'Quitada de favoritas')}
        onToggleFlag={() => toast(toggleFlag(q) ? 'Marcada para repasar' : 'Marca de repaso quitada')}
        onOpenFragment={() => p.onFragmentOpenChange(true)}
        duplicatesInfo={duplicatesInfo(q, bank)}
        notes={q.review.notes}
        notices={notices.length > 0 ? <div className="stack-sm">{notices}</div> : undefined}
        feedbackExtra={p.feedbackExtra}
        onPositionClick={p.onPositionClick}
        showShortcutHints={singleKey && fine && !answered}
      />
      <PdfFragmentModal
        open={p.fragmentOpen}
        onClose={() => p.onFragmentOpenChange(false)}
        question={q}
        fragment={frag.value}
        allowAnswer={answered}
        onRetry={frag.retry}
        resolveImage={assetUrl}
      />
    </>
  );
}
