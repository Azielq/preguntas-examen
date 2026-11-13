# Sec+ Práctica (SY0-701)

App web local (sin backend propio, salvo una función opcional de análisis con IA) para practicar con el banco extraído de tres documentos de estudio de CompTIA Security+ SY0-701 (Gorgotsias, un extracto de Professor Messer y el libro completo de Professor Messer). La interfaz está en español; el contenido de los PDF se muestra en inglés, literal. Diseño y reglas: `PLAN.md`, `PLAN-IA.md` (análisis con IA) y `PLAN-LAYOUT.md` (pantalla de pregunta ajustada a la ventana), cada uno con su sección final "Ajustes al plan".

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
npm run e2e:layout   # matriz de 21 ventanas de PLAN-LAYOUT 15 contra `npm run preview` (capturas en e2e-output/layout/)
npm run e2e:ai       # flujo del análisis con IA contra `npm run dev` (proveedor simulado)
```

`e2e:layout` corre con `vite-node` (importa los fixtures sintéticos de `src/test/layoutFixtures.ts` y los inyecta interceptando la red; nada de eso entra al build). Variables: `E2E_LAYOUT_ONLY=M4,D2` limita las ventanas; `E2E_LAYOUT_BANK=1` mide además, con el banco real, cuántas preguntas entran completas a 1366 × 650 y 390 × 844 (`e2e-output/layout/bank-fit.json`).

`predev`, `prebuild` y `pretest` ejecutan `scripts/prepare-bank.mjs`, que reparte `data/bank.json` en `public/bank/` (manifest, core, explicaciones, un archivo de fragmentos por sección, PBQ y copia de `data/pages/`). Ese script **no modifica ningún texto**; un test recompone el banco desde `public/bank/` y verifica igualdad estricta con `data/bank.json`. `public/bank/` es generado y no se versiona. El build usa `base: './'` y `HashRouter`, así que `dist/` funciona en cualquier hosting estático o carpeta.

El progreso se guarda solo en el `localStorage` del navegador (`secplus:v1:*`). Se puede exportar/importar desde Ajustes.

## Regenerar el banco

```bash
python -I -X utf8 scripts/build_bank.py     # importa y fusiona desde los PDF → data/bank.json, data/import-report.json
python -I -X utf8 scripts/verify_bank.py    # verificación independiente → data/verification-report.json
npm run prepare-bank                        # reparte el banco nuevo en public/bank/
```

Si cambia `bankVersion` o el `contentHash` de alguna pregunta, al abrir la app se reconcilia el progreso guardado (PLAN 6.4): las preguntas cambiadas reinician su historial (conservando favorita y marca), las que ya no existen pasan a `orphans`, y los exámenes históricos no se tocan (se muestran con "Banco anterior"). `prepare-bank` falla si `import-report.json` y `bank.json` tienen distinto `bankVersion`.

## Resumen de importación (banco `758483f7ae`, según `data/import-report.json`)

| | Gorgotsias | Messer (extracto) | Messer (libro completo) | Total |
|---|---|---|---|---|
| Preguntas encontradas | 1140 | 45 | 255 | 1440 |
| Puntuables (respuesta del PDF) | 1132 | 45 | 255 | 1432 |
| Respuestas propuestas por IA | 0 | 0 | 0 | 0 |
| Pendientes de revisión (no se corrigen ni puntúan) | 8 | 0 | 0 | 8 |
| Explicaciones del PDF / generadas por IA | 1140 / 0 | 0 / 45 | 255 / 0 | 1395 / 45 |
| Selección múltiple | 0 | 1 (`msr-a080`) | 9 (una "Select THREE": `msf-a014`) | 10 |
| Con notas de extracción | 11 | 0 | 10 | 21 |
| Soluciones PBQ (solo referencia, imágenes) | 0 | 5 | 15 | 20 |

La app lee estas cifras de `import-report.json` (tabla de Inicio y de Ajustes → Importación del banco); este cuadro es una copia para leer sin abrir la app.

- 579 grupos de preguntas idénticas (1223 preguntas en esos grupos) → **796 preguntas distintas**; 793 con al menos una copia puntuable (máximo de un examen con los tres documentos). Por documento: Gorgotsias 538, Messer extracto 45, Messer libro completo 255. Las 45 del extracto (A46–A90) son copias del libro completo (msf-a046…a090): un examen con ambos libros de Messer tiene 255 distintas y usa la copia del libro completo (explicación del PDF).
- Un par duplicado con claves distintas: `gor-cap4-0414` (B) / `gor-sim6-0514` (A, pendiente).
- Verificación (`data/verification-report.json`): los 1541 bloques de enunciado y 5780 opciones aparecen literalmente en una segunda extracción del PDF (0 diferencias, 0 problemas estructurales). Esto **no** equivale a una revisión visual de cada pregunta; ver `docs/EXTRACTION_SUMMARY.md` (y su adenda) para el alcance y las limitaciones.
- Las 45 explicaciones del extracto de Messer son texto generado por IA y la app las rotula así; las claves sí provienen del PDF. Las 255 del libro completo traen explicación del PDF (en inglés, con explicación por opción).
- Solo el libro completo indica el objetivo SY0-701 de cada pregunta (`objective`): se muestra como metadato con enlace externo y sirve de filtro "Objetivo SY0-701" en Práctica. Ningún otro documento tiene clasificación por objetivo y la app no la inventa.
- Imágenes de página: extracto de Messer 1200 × 1800 px; PBQ del libro completo, 31 páginas JPG (150 dpi). Las preguntas de opción del libro completo no tienen imagen de página: su fragmento es texto literal.
- El cambio de banco `3efc5f1a3b` → `758483f7ae` no altera ids ni `contentHash` de las 1185 preguntas anteriores: el progreso, las favoritas, los intentos y los análisis de IA guardados se conservan (test `src/storage/bankUpgrade.test.ts`).

## Pantalla de pregunta (PLAN-LAYOUT)

Práctica, examen en curso, revisión y detalle de PBQ usan un marco de cuatro filas: encabezado compacto / área de la pregunta (la única región que se desplaza) / franja de estado / barra de acciones. Según el tamaño de la ventana y el zoom hay tres modos: `fit` (la página no se desplaza), `fit-wide` (apaisado de poca altura: enunciado y opciones en dos columnas) y `flow` (zoom alto o ventanas muy chicas: scroll normal de página). El texto del PDF nunca se corta ni se resume: si el enunciado no entra, se acota su altura visible con indicador "El enunciado continúa" y scroll propio, o se desplaza el área entera; las opciones nunca se acotan. "Ver pregunta completa" (tecla `L`) muestra todo sin salir de la pantalla. La explicación, el detalle, el motivo de las pendientes y el análisis de IA se abren bajo demanda en hojas (`X`, `I`).

### Verificación de la pantalla de pregunta (estado al cierre)

- **Comprobado:** `tsc`, build con `check-dist`, 361 tests de Vitest y `verify_bank.py` (0 diferencias). La matriz `e2e:layout` (21 ventanas, Chromium headless) llegó a 659/660 y, tras corregir el último fallo, a 657 verificaciones sin FAIL; esa última corrida se interrumpió por un cierre inesperado del navegador (`Target crashed`), así que **conviene repetir `npm run e2e:layout`** antes de dar la pantalla por cerrada.
- **Con el banco real** (`E2E_LAYOUT_BANK=1`): a 1366 × 650 solo 201 de 1440 preguntas (14 %) entran completas sin desplazar nada; a 390 × 844 entran 1066 (74 %). El resto se resuelve con scroll propio del enunciado o del área, sin tapar nunca la barra de acciones. Detalle y cifras por documento: `PLAN-LAYOUT.md`, "Ajustes al plan", puntos 19–22.
- **No verificado:** Safari iOS y Chrome Android reales (barras del navegador, muesca), zoom real del navegador, lector de pantalla, Firefox y WebKit.

## Estructura

```
scripts/      prepare-bank.mjs (+ test), e2e.mjs, e2e-layout.mjs, e2e-ai.mjs, lib/e2e-utils.mjs, scripts Python de extracción
src/bank/     tipos, carga, validación, índices, selectores puros, BankProvider
src/grading/  grade, buildExam, scoreAttempt, units (funciones puras)
src/storage/  claves, lectura/escritura segura, esquema, migraciones, reconciliación, export/import
src/state/    stores zustand (prefs, progreso, examen, sesión de práctica, contenido, toasts) y selectores
src/ui/       componentes de presentación (solo props)
src/features/ pantallas (dashboard, práctica, examen, plan de estudio con IA, repaso, PBQ, ajustes)
shared/       contrato y lógica pura del análisis con IA (cliente y servidor)
server/       núcleo de la función de análisis (solo Node; nunca entra al bundle)
api/          funciones de Vercel (analyze, ai-status)
```

## Análisis con IA ("Tu plan de estudio")

Función opcional, especificada en `PLAN-IA.md`. Desde el resultado de un examen, "Analizar mis resultados con IA" agrupa los errores por concepto y arma un plan por prioridad. La nota y la revisión convencional no cambian; el análisis se guarda por intento (`secplus:v1:analyses`) y se reabre sin volver a pedirlo.

**Arquitectura.** La IA solo se llama desde el servidor: `api/analyze.ts` y `api/ai-status.ts` (funciones de Vercel) y, en `npm run dev`, un middleware de Vite (`server/devMiddleware.ts`); ambos usan el mismo núcleo puro de `server/`. El navegador envía solo ids, hashes, letras elegidas y contadores; el servidor reconstruye el texto desde su copia del banco (`server/_generated/bank-lite.js`, la genera `prepare-bank`), vuelve a corregir y verifica la salida del modelo antes de devolverla. `vite preview`, `file://` u otro hosting estático no tienen API: la app muestra "no disponible" y todo lo demás funciona igual.

**Advertencia de derechos y privacidad.** Al analizar, el contenido de las preguntas del intento (enunciados, opciones y explicaciones de los PDF, material con derechos de autor), tus respuestas y un resumen de tu historial de aciertos y fallos se envían al proveedor de IA (Anthropic). No se envían datos personales, fechas ni ids de intento. La función está apagada por defecto; activarla en un despliegue público es decisión tuya.

### Variables de entorno (solo servidor; nunca con prefijo `VITE_`)

| Variable | Obligatoria | Por defecto | Uso |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | sí, para la IA real | — | Clave de la API de Anthropic. Usá una clave dedicada a esta app |
| `AI_ACCESS_TOKEN` | sí | — | Secreto compartido (≥ 24 caracteres) que cada usuario carga en Ajustes → Análisis con IA |
| `AI_MODEL` | no | `claude-sonnet-5-5` | Modelo (cadena exacta, sin sufijo de fecha) |
| `AI_EFFORT` | no | `medium` | `low` / `medium` / `high` |
| `AI_PROVIDER` | no | `anthropic` (`mock` en `npm run dev` sin clave) | `anthropic`, `mock` (ignorado en producción) u `off` |
| `AI_FALLBACKS` | no | `on` | `off` desactiva el respaldo del lado del servidor ante un rechazo del modelo |
| `AI_RATE_PER_10MIN` / `AI_RATE_PER_DAY` | no | `5` / `30` | Límite por token + IP (en memoria, por instancia: de mejor esfuerzo) |
| `AI_GLOBAL_PER_DAY` | no | `60` | Tope global diario (por instancia) |
| `AI_ALLOWED_ORIGINS` | no | origen del propio despliegue | Orígenes permitidos, separados por comas |

Sin `ANTHROPIC_API_KEY` **o** sin `AI_ACCESS_TOKEN`, `/api/ai-status` responde `available: false` y `/api/analyze` responde 503; la interfaz lo explica. Ver `.env.example`.

**En local.** Sin configurar nada, `npm run dev` usa el **proveedor simulado** (determinista, sin red, rotulado "Análisis simulado para pruebas — no lo generó una IA") y no exige token. Para probar la IA real, creá `.env.local` (está en `.gitignore` y `.vercelignore`) con `ANTHROPIC_API_KEY=…` y `AI_ACCESS_TOKEN=…`, reiniciá `npm run dev` y cargá el mismo token en Ajustes → Análisis con IA. Generar un token: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`.

**En Vercel.** Project → Settings → Environment Variables: cargá `ANTHROPIC_API_KEY` y `AI_ACCESS_TOKEN` (y las opcionales) para *Production* y, si querés, *Preview*; volvé a desplegar. `vercel.json` fija `maxDuration` 300 s para `api/analyze.ts` (si tu plan permite menos, bajá `AI_EFFORT`) y `Cache-Control: no-store` en `/api/*`. El build ejecuta `prepare-bank` (genera la copia del banco de la función) y `check-dist` (falla si `dist/` contiene `sk-ant-`, nombres de variables secretas o código del servidor).

**Límites de gasto recomendados (pasos manuales, obligatorios en un despliegue público).**
- En la consola de Anthropic: workspace y clave dedicados a esta app, con un **límite de gasto mensual** bajo (p. ej. el equivalente a unos pocos dólares) y alertas.
- En Vercel: una regla de rate limit del Firewall sobre `/api/analyze` y, si tu plan lo permite, Deployment Protection. El limitador del código vive en memoria de cada instancia y no reemplaza estos topes.
- Repartí el token solo a quien deba usar el análisis; para revocar el acceso, cambiá `AI_ACCESS_TOKEN` y redesplegá.

**Pruebas.** `npm test` cubre contrato, servidor (con proveedor simulado y SDK simulado), persistencia y componentes, sin red ni clave. `npm run e2e:ai` recorre el flujo en Chromium contra `npm run dev` (variables `E2E_AI_URL`, y opcionales `E2E_NOKEY_URL` para un dev con `AI_PROVIDER=anthropic` sin clave y `E2E_PREVIEW_URL` para `vite preview`). `npm run ai:smoke -- --yes` llama a la **API real** con dos intentos de fixture (gasta dinero; requiere `ANTHROPIC_API_KEY`).

## Uso y derechos

El contenido proviene de libros con derechos de autor. La app está pensada para uso personal y local; no publiques `public/bank/` ni `dist/`.
