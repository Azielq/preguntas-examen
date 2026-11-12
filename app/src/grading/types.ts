import type { DocId, Letter } from '../bank/types';

export interface ExamConfig {
  source: 'both' | DocId;
  sections?: string[];
  count: number;
  timerMinutes: number | null;
  includeAiProposed: boolean;
}

export interface ExamItem {
  questionId: string;
  contentHash: string;
  selected: Letter[];
  flagged: boolean;
}

export type ItemResult = 'correct' | 'incorrect' | 'omitted';

export interface GradedExamItem extends ExamItem {
  correct: Letter[];
  result: ItemResult;
}

export interface ExamTotals {
  scorable: number;
  correct: number;
  incorrect: number;
  omitted: number;
}
