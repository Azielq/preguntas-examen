# Sec+ Práctica (SY0-701)

App web local (sin backend) para practicar con el banco extraído de dos PDF de estudio de CompTIA Security+ SY0-701. La interfaz está en español; el contenido de los PDF se muestra en inglés, literal. Diseño y reglas: `PLAN.md` (con la sección final "Ajustes al plan").

## Requisitos

- Node.js ≥ 20 (probado con Node 26.13 y npm 11.20 en Windows).
- Solo para regenerar el banco: Python 3.13 y `pdftotext` (poppler) en el PATH.
- Solo para la verificación en navegador: Chromium de Playwright (`npx playwright install chromium`).

## Instalar, ejecutar y construir

```bash
npm install
npm run dev          # servidor de desarrollo (http://localhost:5173)
npm run build        # tsc estricto + build de producción en dist/
npm run preview      # sirve dist/ (http://localhost:4173)
npm run typecheck    # tsc --noEmit (strict)
npm run lint         # ESLint (incluye reglas de capas y prohibición de dangerouslySetInnerHTML)
npm test             # Vitest (unitarias + componentes + integración con el banco real)
npm run e2e          # Playwright contra `npm run preview` ya levantado (capturas en e2e-output/)
```

`predev`, `prebuild` y `pretest` ejecutan `scripts/prepare-bank.mjs`, que reparte `data/bank.json` en `public/bank/` (manifest, core, explicaciones, un archivo de fragmentos por sección, PBQ y copia de `data/pages/`). Ese script **no modifica ningún texto**; un test recompone el banco desde `public/bank/` y verifica igualdad estricta con `data/bank.json`. `public/bank/` es generado y no se versiona. El build usa `base: './'` y `HashRouter`, así que `dist/` funciona en cualquier hosting estático o carpeta.

El progreso se guarda solo en el `localStorage` del navegador (`secplus:v1:*`). Se puede exportar/importar desde Ajustes.

## Regenerar el banco

```bash
python -I -X utf8 scripts/build_bank.py     # importa y fusiona desde los PDF → data/bank.json, data/import-report.json
python -I -X utf8 scripts/verify_bank.py    # verificación independiente → data/verification-report.json
npm run prepare-bank                        # reparte el banco nuevo en public/bank/
```

Si cambia `bankVersion` o el `contentHash` de alguna pregunta, al abrir la app se reconcilia el progreso guardado (PLAN 6.4): las preguntas cambiadas reinician su historial (conservando favorita y marca), las que ya no existen pasan a `orphans`, y los exámenes históricos no se tocan (se muestran con "Banco anterior"). `prepare-bank` falla si `import-report.json` y `bank.json` tienen distinto `bankVersion`.

## Resumen de importación (banco `3efc5f1a3b`, según `data/import-report.json`)

| | Gorgotsias | Messer | Total |
|---|---|---|---|
| Preguntas encontradas | 1140 | 45 | 1185 |
| Puntuables (respuesta del PDF) | 1132 | 45 | 1177 |
| Respuestas propuestas por IA | 0 | 0 | 0 |
| Pendientes de revisión (no se corrigen ni puntúan) | 8 | 0 | 8 |
| Explicaciones del PDF / generadas por IA | 1140 / 0 | 0 / 45 | |
| Selección múltiple | 0 | 1 (`msr-a080`) | 1 |
| Soluciones PBQ (solo referencia, imágenes) | 0 | 5 | 5 |

- 534 grupos de duplicados → 586 preguntas distintas; 583 con al menos una copia puntuable (máximo de un examen combinado; 538 Gorgotsias, 45 Messer).
- Un par duplicado con claves distintas: `gor-cap4-0414` (B) / `gor-sim6-0514` (A, pendiente).
- Verificación (`data/verification-report.json`): los 1232 bloques de enunciado y 4741 opciones aparecen literalmente en una segunda extracción del PDF (0 diferencias, 0 problemas estructurales). Esto **no** equivale a una revisión visual de cada pregunta; ver `docs/EXTRACTION_SUMMARY.md` para el alcance y las limitaciones.
- Las 45 explicaciones de Messer son texto generado por IA y la app las rotula así; las claves sí provienen del PDF.
- Las imágenes de página de Messer están a 1200 × 1800 px.

## Estructura

```
scripts/      prepare-bank.mjs (+ test), e2e.mjs, scripts Python de extracción
src/bank/     tipos, carga, validación, índices, selectores puros, BankProvider
src/grading/  grade, buildExam, scoreAttempt, units (funciones puras)
src/storage/  claves, lectura/escritura segura, esquema, migraciones, reconciliación, export/import
src/state/    stores zustand (prefs, progreso, examen, sesión de práctica, contenido, toasts) y selectores
src/ui/       componentes de presentación (solo props)
src/features/ pantallas (dashboard, práctica, examen, repaso, PBQ, ajustes)
```

## Uso y derechos

El contenido proviene de libros con derechos de autor. La app está pensada para uso personal y local; no publiques `public/bank/` ni `dist/`.
