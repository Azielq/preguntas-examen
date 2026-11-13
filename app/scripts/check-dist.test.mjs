// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SERVER_SENTINEL } from '../server/prompt';
import { checkDist, FORBIDDEN } from './check-dist.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('check-dist (secretos y código del servidor fuera del bundle)', () => {
  it('la centinela del servidor está en la lista de cadenas prohibidas', () => {
    expect(FORBIDDEN).toContain(SERVER_SENTINEL);
  });

  it('detecta una clave o la centinela en un archivo del bundle', () => {
    const d = mkdtempSync(join(tmpdir(), 'secplus-dist-'));
    mkdirSync(join(d, 'assets'));
    writeFileSync(join(d, 'assets', 'ok.js'), 'console.log("hola")');
    writeFileSync(join(d, 'assets', 'bad.js'), `const k="sk-ant-123"; const s="${SERVER_SENTINEL}";`);
    const r = checkDist(d);
    expect(r.files).toBe(2);
    expect(r.hits.length).toBe(2);
  });

  it.skipIf(!existsSync(join(ROOT, 'dist', 'index.html')))('dist/ actual (último build) está limpio', () => {
    const r = checkDist(join(ROOT, 'dist'));
    expect(r.files).toBeGreaterThan(0);
    expect(r.hits).toEqual([]);
  });
});
