export const STORAGE_PREFIX = 'secplus:v1:';

export const KEYS = {
  prefs: `${STORAGE_PREFIX}prefs`,
  progress: `${STORAGE_PREFIX}progress`,
  attempts: `${STORAGE_PREFIX}attempts`,
  examActive: `${STORAGE_PREFIX}exam-active`,
} as const;

export type StorageKey = (typeof KEYS)[keyof typeof KEYS];
