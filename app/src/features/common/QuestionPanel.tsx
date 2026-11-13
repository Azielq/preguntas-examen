import { type ReactNode } from 'react';
import { useBank } from '../../bank/BankProvider';
import { assetUrl } from '../../bank/loadBank';
import { answerSourceLabel, docShort, getAnswerState, questionHeaderLabel } from '../../bank/selectors';
import type { Letter, Question } from '../../bank/types';
import type { GradeResult } from '../../grading/grade';
import { useMediaQuery, MQ } from '../../hooks/useMediaQuery';
import { usePrefs } from '../../state/prefsStore';
import { useProgress } from '../../state/progressStore';
import { toast } from '../../state/toastStore';
import { PdfFragmentModal } from '../../ui/PdfFragmentModal/PdfFragmentModal';
import { QuestionCard, type QuestionCardProps } from '../../ui/QuestionCard/QuestionCard';
import type { ActionBarSlots } from '../../ui/QuestionScreen/QuestionScreen';
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
  /** rótulo h2 (por defecto "Question 37 · pág. 122") */
  headerLabel?: string;
  headerTop?: ReactNode;
  actions: ActionBarSlots;
  aside?: ReactNode;
  asideLabel?: string;
  full: boolean;
  onToggleFull(): void;
  statusHint?: string;
  statusHintId?: string;
  listTitle?: string;
  listTitleLang?: string;
  planNote?: string;
  explanationOpen: boolean;
  onExplanationOpenChange(open: boolean): void;
  detailOpen: boolean;
  onDetailOpenChange(open: boolean): void;
  onExplanationNext?(): void;
  explanationNextLabel?: string;
  analysisContent?: ReactNode;
  onOpenShortcuts?(): void;
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
  const answerState = getAnswerState(q);
  const showExplanation = !!p.result || p.revealed;
  // se pide en segundo plano al comprobar: la hoja abre con el contenido listo
  const expl = useExplanation(q, showExplanation);
  const frag = useFragment(q, p.fragmentOpen);
  const answered = !!p.result || p.revealed || p.mode === 'review';
  const lastTime = p.showLastTime && !answered ? lastTimeText(prog) : null;

  const cardProps: QuestionCardProps = {
    question: q,
    mode: p.mode,
    position: p.position,
    headerLabel: p.headerLabel ?? questionHeaderLabel(q),
    selected: p.selected,
    onSelect: p.onSelect,
    result: p.result,
    correctLetters: p.correctLetters,
    answerState,
    revealUnreliable: p.revealed,
    explanation: showExplanation ? expl.value : undefined,
    explanationSourceLabel: answerSourceLabel(q.answerSource),
    onRetryExplanation: expl.retry,
    flags: { favorite: !!prog?.favorite, flagged: !!prog?.flagged },
    onToggleFavorite: () => toast(toggleFavorite(q) ? 'Agregada a favoritas' : 'Quitada de favoritas'),
    onToggleFlag: () => toast(toggleFlag(q) ? 'Marcada para repasar' : 'Marca de repaso quitada'),
    onOpenFragment: () => p.onFragmentOpenChange(true),
    duplicatesInfo: duplicatesInfo(q, bank),
    notes: q.review.notes,
    notices: p.extraNotices,
    feedbackExtra: p.feedbackExtra,
    onPositionClick: p.onPositionClick,
    showShortcutHints: singleKey && fine && !answered,
    headerTop: p.headerTop,
    actions: p.actions,
    aside: p.aside,
    asideLabel: p.asideLabel,
    full: p.full,
    onToggleFull: p.onToggleFull,
    statusHint: p.statusHint,
    statusHintId: p.statusHintId,
    lastTime,
    listTitle: p.listTitle,
    listTitleLang: p.listTitleLang,
    contentChanged: !!prog?.contentChanged,
    planNote: p.planNote,
    explanationOpen: p.explanationOpen,
    onExplanationOpenChange: p.onExplanationOpenChange,
    detailOpen: p.detailOpen,
    onDetailOpenChange: p.onDetailOpenChange,
    onExplanationNext: p.onExplanationNext,
    explanationNextLabel: p.explanationNextLabel,
    analysisContent: p.analysisContent,
    onOpenShortcuts: p.onOpenShortcuts,
  };

  return (
    <>
      <QuestionCard {...cardProps} />
      <PdfFragmentModal
        open={p.fragmentOpen}
        onClose={() => p.onFragmentOpenChange(false)}
        question={q}
        fragment={frag.value}
        allowAnswer={answered}
        onRetry={frag.retry}
        resolveImage={assetUrl}
        docLabel={docShort(q.doc)}
      />
    </>
  );
}
