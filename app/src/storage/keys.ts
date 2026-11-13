export const STORAGE_PREFIX = 'secplus:v1:';

export const KEYS = {
  prefs: `${STORAGE_PREFIX}prefs`,
  progress: `${STORAGE_PREFIX}progress`,
  attempts: `${STORAGE_PREFIX}attempts`,
  examActive: `${STORAGE_PREFIX}exam-active`,
  /** análisis con IA por intento (PLAN-IA 8.1); aparte de attempts, que son inmutables */
  analyses: `${STORAGE_PREFIX}analyses`,
  /** token de acceso al análisis con IA: nunca se exporta */
  aiAccess: `${STORAGE_PREFIX}ai-access`,
} as const;

export type StorageKey = (typeof KEYS)[keyof typeof KEYS];
