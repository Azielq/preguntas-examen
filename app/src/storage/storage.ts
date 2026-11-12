import { migrate } from './migrate';

export type WriteStatus = 'ok' | 'quota' | 'unavailable';

let memoryOnly: boolean | null = null;

export function storageAvailable(): boolean {
  if (memoryOnly !== null) return !memoryOnly;
  try {
    const k = '__secplus_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
  return !memoryOnly;
}

/** Solo para tests. */
export function __resetStorageAvailability(): void {
  memoryOnly = null;
}

export interface ReadResult<T> {
  value: T | null;
  corrupt: boolean;
  backupKey?: string;
}

/**
 * Lee una clave con validación de forma. Si el JSON está corrupto o no tiene la forma esperada,
 * se renombra a `<clave>:corrupt:<timestamp>` y se devuelve `corrupt: true` para arrancar limpio.
 */
export function readKey<T>(key: string, guard: (x: unknown) => x is T, useMigrations = true): ReadResult<T> {
  if (!storageAvailable()) return { value: null, corrupt: false };
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return { value: null, corrupt: false };
  }
  if (raw === null) return { value: null, corrupt: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    const migrated = useMigrations ? migrate(parsed) : parsed;
    if (guard(migrated)) return { value: migrated, corrupt: false };
  } catch {
    /* cae al manejo de corrupto */
  }
  const backupKey = `${key}:corrupt:${Date.now()}`;
  try {
    window.localStorage.setItem(backupKey, raw);
    window.localStorage.removeItem(key);
  } catch {
    /* sin espacio para la copia: igual se arranca limpio */
  }
  return { value: null, corrupt: true, backupKey };
}

export function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014)
  );
}

export function writeKey(key: string, value: unknown): WriteStatus {
  if (!storageAvailable()) return 'unavailable';
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return 'ok';
  } catch (e) {
    return isQuotaError(e) ? 'quota' : 'unavailable';
  }
}

export function removeKey(key: string): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nada */
  }
}

// ---- Escritura con debounce (inmediata en pagehide) ----

type Pending = { value: unknown; timer: ReturnType<typeof setTimeout> | null };
const pending = new Map<string, Pending>();
let onStatus: (key: string, s: WriteStatus) => void = () => {};

export function setWriteStatusListener(fn: (key: string, s: WriteStatus) => void): void {
  onStatus = fn;
}

export function writeDebounced(key: string, value: unknown, delay = 300): void {
  const p = pending.get(key);
  if (p?.timer) clearTimeout(p.timer);
  const entry: Pending = { value, timer: null };
  entry.timer = setTimeout(() => flushKey(key), delay);
  pending.set(key, entry);
}

export function flushKey(key: string): void {
  const p = pending.get(key);
  if (!p) return;
  if (p.timer) clearTimeout(p.timer);
  pending.delete(key);
  onStatus(key, writeKey(key, p.value));
}

export function flushAll(): void {
  for (const k of [...pending.keys()]) flushKey(k);
}

export function cancelPending(key: string): void {
  const p = pending.get(key);
  if (p?.timer) clearTimeout(p.timer);
  pending.delete(key);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll();
  });
}
