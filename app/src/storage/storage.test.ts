import { afterEach, describe, expect, it, vi } from 'vitest';
import { KEYS } from './keys';
import { migrate } from './migrate';
import { emptyProgress, isProgressState } from './schema';
import { __resetStorageAvailability, flushKey, readKey, setWriteStatusListener, writeDebounced, writeKey } from './storage';

afterEach(() => {
  vi.restoreAllMocks();
  __resetStorageAvailability();
});

describe('storage', () => {
  it('JSON corrupto: se renombra a :corrupt:<ts> y se arranca limpio', () => {
    localStorage.setItem(KEYS.progress, '{no es json');
    const r = readKey(KEYS.progress, isProgressState);
    expect(r.value).toBeNull();
    expect(r.corrupt).toBe(true);
    expect(localStorage.getItem(KEYS.progress)).toBeNull();
    expect(localStorage.getItem(r.backupKey!)).toBe('{no es json');
    expect(r.backupKey).toMatch(/^secplus:v1:progress:corrupt:\d+$/);
  });

  it('forma inválida también cuenta como corrupto', () => {
    localStorage.setItem(KEYS.progress, JSON.stringify({ schemaVersion: 1, bankVersion: 3, questions: [] }));
    expect(readKey(KEYS.progress, isProgressState).corrupt).toBe(true);
  });

  it('lee un estado válido', () => {
    const p = emptyProgress('abc');
    writeKey(KEYS.progress, p);
    expect(readKey(KEYS.progress, isProgressState).value).toEqual(p);
  });

  it('cuota llena: writeKey devuelve "quota" y el escritor con debounce lo informa', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    // forzar disponibilidad (la prueba de disponibilidad también usa setItem)
    __resetStorageAvailability();
    const statuses: string[] = [];
    setWriteStatusListener((_k, s) => statuses.push(s));
    // con setItem roto, storageAvailable() da false → 'unavailable'; simulamos disponibilidad previa
    vi.restoreAllMocks();
    expect(writeKey('k', 1)).toBe('ok');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(writeKey('k', 2)).toBe('quota');
    writeDebounced('k', 3);
    flushKey('k');
    expect(statuses).toEqual(['quota']);
  });

  it('localStorage no disponible: la app sigue en memoria sin lanzar', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    __resetStorageAvailability();
    expect(writeKey(KEYS.prefs, { a: 1 })).toBe('unavailable');
    expect(readKey(KEYS.progress, isProgressState)).toEqual({ value: null, corrupt: false });
  });
});

describe('migrate', () => {
  it('v1 pasa sin cambios; versiones desconocidas o futuras → null', () => {
    const p = emptyProgress('x');
    expect(migrate(p)).toEqual(p);
    expect(migrate({ schemaVersion: 2 })).toBeNull();
    expect(migrate({})).toBeNull();
    expect(migrate(null)).toBeNull();
  });
  it('encadena migraciones puras', () => {
    const migs = {
      2: (x: Record<string, unknown>) => ({ ...x, schemaVersion: 2, b: 1 }),
      3: (x: Record<string, unknown>) => ({ ...x, schemaVersion: 3, c: 2 }),
    };
    const input = { schemaVersion: 1, a: 0 };
    expect(migrate(input, migs, 3)).toEqual({ schemaVersion: 3, a: 0, b: 1, c: 2 });
    expect(input).toEqual({ schemaVersion: 1, a: 0 });
  });
});
