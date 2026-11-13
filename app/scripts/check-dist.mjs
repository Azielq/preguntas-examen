// Verifica que el bundle del cliente (dist/) no contenga secretos ni código del servidor (PLAN-IA 2.3, 12.1).
// Se ejecuta en `postbuild`; también lo usa scripts/check-dist.test.mjs.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Cadenas prohibidas. La centinela sale de server/prompt.ts; el fragmento del system prompt, también. */
export const FORBIDDEN = [
  'sk-ant-',
  'ANTHROPIC_API_KEY',
  'AI_ACCESS_TOKEN',
  'secplus-server-only::c41b7e2d',
  'Datos no confiables',
  '@anthropic-ai/sdk',
  'server-side-fallback',
];

const TEXT_EXT = new Set(['.js', '.mjs', '.css', '.html', '.json', '.map', '.txt', '.svg', '.webmanifest']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

export function checkDist(dist = join(ROOT, 'dist')) {
  if (!existsSync(dist)) throw new Error(`check-dist: no existe ${dist}. Ejecutá npm run build.`);
  const hits = [];
  let files = 0;
  for (const f of walk(dist)) {
    if (!TEXT_EXT.has(extname(f))) continue;
    // el banco (public/bank) no tiene código; igual se revisa
    const txt = readFileSync(f, 'utf8');
    files += 1;
    for (const s of FORBIDDEN) if (txt.includes(s)) hits.push(`${f.slice(dist.length + 1)}: contiene "${s}"`);
  }
  return { files, hits };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files, hits } = checkDist();
  if (hits.length) {
    console.error(`check-dist: ${hits.length} problema(s):\n${hits.join('\n')}`);
    process.exit(1);
  }
  console.log(`check-dist: ${files} archivos revisados en dist/, sin secretos ni código del servidor.`);
}
