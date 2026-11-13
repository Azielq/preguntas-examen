/**
 * Limitador de tasa con almacén inyectable (PLAN-IA 2.5). El almacén en memoria es de mejor esfuerzo:
 * cada instancia serverless tiene el suyo. El techo real de gasto se fija fuera del código.
 */
export interface RateStore {
  /** marcas de tiempo registradas para la clave */
  get(key: string): number[];
  set(key: string, stamps: number[]): void;
}

export function memoryStore(): RateStore {
  const m = new Map<string, number[]>();
  return {
    get: (k) => m.get(k) ?? [],
    set: (k, v) => {
      if (v.length) m.set(k, v);
      else m.delete(k);
    },
  };
}

export interface Window {
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimiter {
  /** Si todas las ventanas tienen lugar, registra un uso en cada una. Si no, devuelve los segundos de espera. */
  consume(windows: Window[], now: number): { ok: true } | { ok: false; retryAfterSec: number };
  /** Cuenta sin registrar. */
  count(key: string, windowMs: number, now: number): number;
  record(key: string, windowMs: number, now: number): void;
}

export function createRateLimiter(store: RateStore = memoryStore()): RateLimiter {
  const live = (key: string, windowMs: number, now: number) => store.get(key).filter((t) => now - t < windowMs);
  return {
    consume(windows, now) {
      let wait = 0;
      for (const w of windows) {
        const stamps = live(w.key, w.windowMs, now);
        if (stamps.length >= w.limit) wait = Math.max(wait, Math.ceil((stamps[0]! + w.windowMs - now) / 1000));
      }
      if (wait > 0) return { ok: false, retryAfterSec: wait };
      for (const w of windows) store.set(w.key, [...live(w.key, w.windowMs, now), now]);
      return { ok: true };
    },
    count(key, windowMs, now) {
      return live(key, windowMs, now).length;
    },
    record(key, windowMs, now) {
      store.set(key, [...live(key, windowMs, now), now]);
    },
  };
}
