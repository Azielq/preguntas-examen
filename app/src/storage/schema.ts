import type { DocId, Letter } from '../bank/types';
import type { ExamConfig, ExamItem, ExamTotals, GradedExamItem } from '../grading/types';
import type { Coverage, ModelOutput, ProviderName } from '../../shared/analysis/contract';
import type { Derived } from '../../shared/analysis/derive';

export type { ExamConfig, ExamItem, ExamTotals, GradedExamItem };

export type ThemePref = 'system' | 'light' | 'dark';

export interface PracticeFilter {
  doc?: DocId;
  section?: string;
  /** código de objetivo SY0-701 ("4.6"); solo existe en messerfull */
  objective?: string;
  state?: 'all' | 'unanswered' | 'failed' | 'flagged' | 'pending_review';
  onlyFavorites?: boolean;
  list?: 'falladas' | 'marcadas' | 'favoritas' | `attempt:${string}` | `plan:${string}`;
}

export interface Prefs {
  theme: ThemePref;
  textSize: 'normal' | 'large';
  singleKeyShortcuts: boolean;
  timerHidden: boolean;
  lastPracticeFilter?: PracticeFilter;
  lastExamConfig?: ExamConfig;
}

export const DEFAULT_PREFS: Prefs = { theme: 'system', textSize: 'normal', singleKeyShortcuts: true, timerHidden: false };

export type Outcome = 'correct' | 'incorrect' | 'ungraded';
export type AttemptMode = 'practice' | 'review' | 'exam';

export interface QuestionProgress {
  contentHash: string;
  seenAt?: number;
  lastSeenAt?: number;
  attempts: number; // intentos corregidos
  correctCount: number;
  incorrectCount: number;
  last?: { selected: Letter[]; outcome: Outcome; at: number; mode: AttemptMode };
  lastGraded?: { outcome: 'correct' | 'incorrect'; at: number };
  favorite?: boolean;
  flagged?: boolean;
  contentChanged?: boolean;
}

export interface ProgressState {
  schemaVersion: 1;
  bankVersion: string;
  questions: Record<string, QuestionProgress>;
  orphans?: Record<string, QuestionProgress>;
  lastPractice?: { filter: PracticeFilter; questionId: string; at: number };
}

export interface ExamActive {
  schemaVersion: 1;
  id: string;
  bankVersion: string;
  config: ExamConfig;
  startedAt: number;
  items: ExamItem[];
  currentIndex: number;
  remainingMs: number | null;
  elapsedMs: number;
}

export interface ExamAttempt {
  id: string;
  bankVersion: string;
  config: ExamConfig;
  startedAt: number;
  finishedAt: number;
  elapsedMs: number;
  endedBy: 'user' | 'timeout';
  items: GradedExamItem[];
  totals: ExamTotals;
  /** Ítems excluidos del denominador por no ser puntuables al corregir. */
  notScored?: ExamItem[];
}

export interface AttemptsState {
  schemaVersion: 1;
  attempts: ExamAttempt[]; // más nuevo primero
}

export const MAX_ATTEMPTS = 100;

// ---- Análisis con IA (PLAN-IA 8.1) ----

export interface StoredAnalysis {
  attemptId: string;
  createdAt: number;
  bankVersion: string;
  promptVersion: string;
  analysisSchemaVersion: 1;
  provider: ProviderName;
  model: string;
  coverage: Coverage;
  /** ya verificado */
  output: ModelOutput;
  derived: Derived;
}

export interface AnalysesState {
  schemaVersion: 1;
  byAttempt: Record<string, StoredAnalysis>;
}

export function emptyAnalyses(): AnalysesState {
  return { schemaVersion: 1, byAttempt: {} };
}

/** Solo la forma exterior: cada entrada se valida aparte y se descarta individualmente (storage/analyses.ts). */
export function isAnalysesState(x: unknown): x is AnalysesState {
  return isObj(x) && x.schemaVersion === 1 && isObj(x.byAttempt);
}

export function emptyProgress(bankVersion: string): ProgressState {
  return { schemaVersion: 1, bankVersion, questions: {} };
}

export function emptyAttempts(): AttemptsState {
  return { schemaVersion: 1, attempts: [] };
}

// ---- Validadores de forma (a mano, tolerantes con campos opcionales) ----

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStrArr = (x: unknown): x is string[] => Array.isArray(x) && x.every((s) => typeof s === 'string');

export function isPrefs(x: unknown): x is Prefs {
  return (
    isObj(x) &&
    (x.theme === 'system' || x.theme === 'light' || x.theme === 'dark') &&
    (x.textSize === 'normal' || x.textSize === 'large') &&
    typeof x.singleKeyShortcuts === 'boolean' &&
    typeof x.timerHidden === 'boolean'
  );
}

function isQuestionProgress(x: unknown): x is QuestionProgress {
  return (
    isObj(x) &&
    typeof x.contentHash === 'string' &&
    typeof x.attempts === 'number' &&
    typeof x.correctCount === 'number' &&
    typeof x.incorrectCount === 'number' &&
    (x.last === undefined || (isObj(x.last) && isStrArr(x.last.selected) && typeof x.last.outcome === 'string'))
  );
}

export function isProgressState(x: unknown): x is ProgressState {
  if (!isObj(x) || x.schemaVersion !== 1 || typeof x.bankVersion !== 'string' || !isObj(x.questions)) return false;
  return Object.values(x.questions).every(isQuestionProgress) && (x.orphans === undefined || isObj(x.orphans));
}

function isExamItem(x: unknown): x is ExamItem {
  return isObj(x) && typeof x.questionId === 'string' && typeof x.contentHash === 'string' && isStrArr(x.selected) && typeof x.flagged === 'boolean';
}

function isExamConfig(x: unknown): x is ExamConfig {
  return isObj(x) && typeof x.source === 'string' && typeof x.count === 'number' && (x.timerMinutes === null || typeof x.timerMinutes === 'number');
}

export function isExamActive(x: unknown): x is ExamActive {
  return (
    isObj(x) &&
    x.schemaVersion === 1 &&
    typeof x.id === 'string' &&
    typeof x.bankVersion === 'string' &&
    isExamConfig(x.config) &&
    Array.isArray(x.items) &&
    x.items.every(isExamItem) &&
    typeof x.currentIndex === 'number' &&
    (x.remainingMs === null || typeof x.remainingMs === 'number') &&
    typeof x.elapsedMs === 'number'
  );
}

function isExamAttempt(x: unknown): x is ExamAttempt {
  return (
    isObj(x) &&
    typeof x.id === 'string' &&
    typeof x.bankVersion === 'string' &&
    isExamConfig(x.config) &&
    Array.isArray(x.items) &&
    x.items.every((i) => isExamItem(i) && isStrArr((i as GradedExamItem).correct) && typeof (i as GradedExamItem).result === 'string') &&
    isObj(x.totals)
  );
}

export function isAttemptsState(x: unknown): x is AttemptsState {
  return isObj(x) && x.schemaVersion === 1 && Array.isArray(x.attempts) && x.attempts.every(isExamAttempt);
}
