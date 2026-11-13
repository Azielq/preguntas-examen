/**
 * Constantes de tamaño y umbrales del análisis con IA (PLAN-IA 3, 4, 7, 8).
 * Son decisiones de producto: no tienen fuente externa.
 */
export const SCHEMA_VERSION = 1 as const;
export const ANALYSIS_SCHEMA_VERSION = 1 as const;

// ---- Pedido ----
export const MAX_BODY_BYTES = 65_536;
export const MAX_ITEMS = 600;
export const MAX_SELECTED = 8;
export const MAX_NOT_SCORED = 600;
export const MAX_HISTORY_QUESTIONS = 120;
export const MAX_HISTORY_CHAPTERS = 12;
export const MAX_HISTORY_COUNT = 999;
export const MAX_CHAPTER_COUNT = 2000;

// ---- Entrada del modelo ----
export const MAX_FAILED_DETAILED = 60;
export const MAX_CORRECT_DETAILED = 120;
export const MAX_MODEL_CHARS = 150_000;

// ---- Salida del modelo ----
export const OUT = {
  summary: 700,
  conceptName: 80,
  reinforce: 600,
  questionNote: 400,
  confusionNote: 300,
  confusionTerm: 80,
  learnPoint: 240,
  explanation: 600,
  example: 500,
  activity: 400,
  strengthName: 80,
  keyFlagNote: 400,
  conceptId: 16,
  maxConcepts: 8,
  maxConfusions: 3,
  minLearnPoints: 2,
  maxLearnPoints: 5,
  minMinutes: 5,
  maxMinutes: 60,
  maxStrengths: 5,
  maxKeyFlags: 5,
  maxQuestionIds: 60,
  maxUnassigned: 60,
} as const;

// ---- Prioridad y fortalezas (7.2, 7.3) ----
export const RECURRENT_MIN_INCORRECT = 2;
export const CHAPTER_FRACTION_MIN_ITEMS = 4;
export const CHAPTER_STRENGTH_MIN_ITEMS = 5;
export const CHAPTER_STRENGTH_MIN_RATIO = 0.8;

// ---- Práctica (10) ----
export const PRACTICE_PER_CONCEPT = 8;
export const PRACTICE_TOTAL = 20;

// ---- Persistencia (8.1) ----
export const MAX_STORED_ANALYSES = 30;

// ---- Servidor ----
export const MIN_ACCESS_TOKEN_LENGTH = 24;
export const MODEL_MAX_TOKENS = 16_000;
