# Resumen de extracción (traspaso a diseño / implementación)

Etapa 1 ejecutada por **Claude Sonnet 5.5** (el modelo de esta sesión; no se usó Opus ni Fable en esta etapa).
Banco: `data/bank.json` (versión `bankVersion`, ~5,3 MB). Scripts reproducibles en `scripts/`:
`build_bank.py` (importa + fusiona), `verify_bank.py` (verificación independiente).

> Este documento describe **contenido y necesidades de presentación**. Quien diseñe no necesita abrir los PDF.

## Documentos fuente

| id | Documento | Páginas | Contenido |
|---|---|---|---|
| `gorgotsias` | CompTIA Security+ SY0-701 Practice Tests & PBQs (ExamsDigest) | 1620 | 1140 preguntas (5 capítulos = 540, 6 simulacros = 600) con clave y explicación en el propio PDF (inglés) |
| `messer` | Professor Messer SY0-701 Practice Exams v18 (extracto, 25 págs.) | 25 | 45 preguntas (A46–A90) + clave rápida + 5 soluciones PBQ (A1–A5, imágenes) |

Total: **1185 preguntas de opción** + **5 soluciones PBQ** (no puntuables).

## Estados de respuesta

- `answerStatus: "pdf"` → respuesta explícita en el PDF: **1177** (1132 Gorgotsias + 45 Messer). Son las puntuables (`scorable: true`).
- `answerStatus: "ai_proposed"` → **0** (no hizo falta deducir ninguna respuesta). El tipo debe existir en la UI de todos modos.
- `review.status: "pending"` → **8** preguntas de Gorgotsias, excluidas de la puntuación, con `review.reasons` visibles:
  `gor-cap1-0023, gor-cap1-0024, gor-cap1-0026, gor-sim1-0064, gor-sim1-0075, gor-sim3-0254, gor-sim6-0514, gor-sim6-0592` (son 4 enunciados distintos, varios repetidos en capítulo y simulacro).
  Causa: el PDF muestra, bajo ese número, una explicación/opciones que corresponden a otra pregunta (contradicción interna del libro). No se resolvió.
- `review.notes` (11 casos, no bloquean): diferencias tipográficas entre las dos copias de la pregunta que contiene el PDF, o numeración de la explicación distinta.
- `duplicates`: 534 grupos de preguntas idénticas (capítulos y simulacros reutilizan enunciados) → **586 preguntas únicas por texto**. Un examen combinado **debe deduplicar** usando `duplicates`. Un grupo duplicado tiene letras distintas: `gor-cap4-0414` vs `gor-sim6-0514` (la segunda es una de las pendientes).
- Ninguna pregunta de Gorgotsias es de selección múltiple; **Messer A80 sí** (`msr-a080`, "Select TWO", 5 opciones A–E, correctas B y C). Otras `selectionType: "single"` con 4 opciones. La UI debe soportar múltiple con N opciones y exigir el mismo número de marcas.

## Tipos de contenido y necesidades de presentación

1. **Opción única de 4 opciones** (1184). Enunciado mediana 296 car. (máx. 499); opción mediana 32 car. (máx. 132). Cabe en una tarjeta ancha sin truncar; las opciones ocupan toda la fila clicable.
2. **Selección múltiple** (1): checkboxes, indicación "Select TWO" ya viene en el enunciado original; la UI no debe reescribirlo, solo añadir una ayuda ("Elegí 2 respuestas").
3. **Enunciado con bloques** `stem: [{type:"text"|"code", text}]`. `code` (Messer A52, A80): logs; mostrar monoespaciado, con saltos de línea y scroll horizontal, con foco accesible.
4. **Explicación con origen** `explanation.origin`:
   - `pdf` (Gorgotsias, 1140, **inglés**): `text` + `perOption{letra: "Option X is incorrect. …"}` (3 por pregunta; 2 en 2 casos). Rotular "Explicación del PDF (en inglés)".
   - `ai` (Messer, 45, español, generada): `text` solo, sin `perOption`. Rotular **"Explicación generada por IA — no es del PDF"**.
5. **Referencia de origen**: `answerSource {doc, page, printedPage, kind: "explanation"|"quick_key"}`. Gorgotsias: página PDF = impresa. Messer: impresa = PDF + 16 (clave en pág. impresa 33 = PDF 17).
6. **Fragmento del PDF** (modal interno):
   - Gorgotsias: `fragment.question` / `fragment.answer` = texto literal extraído (con sus páginas). No hay imágenes de página (1620 págs.); aclarar "texto extraído literal".
   - Messer: `fragment.questionImage` y `answerImage` = JPG de la página (`data/pages/messer/p-NN.jpg`). Imagen con zoom/desplazamiento.
7. **Soluciones PBQ** (`bank.pbq`, 5): solo imágenes de página + texto extraído (A5 incluye diagrama de red y tabla de reglas de firewall; A1 y A4 con iconos/emparejamientos). Sección propia "Referencia PBQ", sin puntuación ni "Comprobar". Imagen grande con zoom, alt text desde `text`.
8. **Idioma**: preguntas y opciones en inglés (original); interfaz y explicaciones de IA en español.
9. **Temas** (`topic`): Gorgotsias → 5 capítulos (General Security Concepts 110, Threats/Vulnerabilities/Mitigations 110, Implementation 90, Security Operations 150, Program Mgmt & Oversight 80) + Simulacros 1–6 (100 c/u, mezclan temas, no tienen tema propio); Messer → "Practice Exam A". No existe clasificación por dominio SY0-701; no inventarla.
10. **Sin imágenes en las preguntas de opción**. Las únicas figuras son las páginas PBQ de Messer.

## Identificadores y versionado

- `id` estable: `gor-<sección>-<nº 4 dígitos>` (p. ej. `gor-sim3-0254`), `msr-a<nº 3 dígitos>`. Opciones: `<id>-<letra>`.
- `contentHash` por pregunta (enunciado + opciones + correcta) y `bankVersion` global: guardar con cada intento; si cambian, no mezclar resultados antiguos.
- Números originales no son únicos entre capítulos y simulacros: usar siempre `id`.

## Verificación realizada

- Dos copias independientes del texto de cada pregunta dentro del propio PDF de Gorgotsias (sección de preguntas y sección de respuestas): 1135/1140 idénticas tras normalizar espacios; las diferencias están revisadas una a una: tipográficas o de maquetación (quedan como `review.notes`) y una contradicción real de opciones (`sim6-0514`). Además se comprueba que la explicación empiece con el texto de la opción indicada; ahí fallan las 8 pendientes (la explicación pertenece a otra pregunta).
- `scripts/verify_bank.py`: cada bloque de enunciado (1232) y cada opción (4741) aparece literalmente (sin distinguir espacios/puntuación de ajuste) en una **segunda extracción del PDF** (`pdftotext -raw`): 0 diferencias; 0 problemas estructurales (ids únicos, letras consecutivas, sin U+FFFD, correctas dentro de las opciones).
- Revisión visual contra imagen del PDF: Messer págs. 19 y 25 y Gorgotsias pág. 1479 (coinciden). **No** se comparó visualmente cada pregunta; los PDF tienen capa de texto, no se usó OCR.
- Limitación: la unión de renglones partidos por guion (`off-\npeak` → `off-peak`) es una normalización de maquetación; se aplica solo si la línea termina en `letra-` y la siguiente empieza en minúscula.
- Las explicaciones de Messer (45) son texto generado por IA, guardado aparte en `data/ai_explanations_messer.json`; las claves provienen del PDF.


---

# Adenda: tercer documento `messerfull` (importado 2026-11-12)

Etapa de extracción ejecutada de nuevo por **Claude Sonnet 5.5** (no Opus). Scripts: `scripts/parse_messer_full.py` (nuevo), `build_bank.py` y `verify_bank.py` (ampliados). Los IDs, hashes y campos de las 1185 preguntas anteriores **no cambiaron** (comprobado comparando el banco anterior y el nuevo); sólo cambian `bankVersion` y las listas `duplicates`.

| id | Documento | Páginas | Contenido |
|---|---|---|---|
| `messerfull` | Professor Messer's SY0-701 Security+ Practice Exams, **libro completo v1.6** (exámenes A, B y C) | 393 | 255 preguntas de opción (85 por examen: X6–X90) + 15 PBQ (X1–X5) con clave rápida y respuestas detalladas en el PDF (inglés) |

Total del banco: **1440 preguntas de opción** (Gorgotsias 1140 · Messer extracto 45 · Messer libro completo 255) + **20 soluciones PBQ** (5 del extracto + 15 del libro).

## Resultado de la incorporación
- Añadidas: **255**. **45 ya existían** como duplicado idéntico del extracto (A46–A90; misma respuesta, sin conflicto) y **210 son nuevas**. Ninguna duplicada dentro del libro. Sin pares "similares" (≥0,6) no idénticos.
- Respuestas del PDF: 255/255 (`answerStatus: "pdf"`); respuestas propuestas por IA: 0; pendientes de revisión: **0**. Puntuables en total: 1432 (1440 − 8 pendientes de Gorgotsias).
- Cada respuesta tiene **dos fuentes independientes en el PDF** (clave rápida y línea «The Answer(s):»); coinciden en las 255 (una de ellas, A12, redacta la opción con otras palabras: nota). Para las respuestas múltiples se comprueba además que el texto de cada opción citada coincide con la opción de la pregunta.
- Banco total tras deduplicar por texto: **796 preguntas únicas** (579 grupos idénticos + 217 sin copia).
- 10 preguntas con `review.notes` (no bloquean): la copia de la pregunta en las respuestas detalladas difiere en la redacción de la de la sección de preguntas (variación del propio PDF) o la línea «The Answer:» parafrasea la opción: `msf-a012, msf-b027, msf-b055, msf-b078, msf-b083, msf-c016, msf-c020, msf-c027, msf-c048, msf-c054`.

## Nuevos rasgos de contenido (la UI debe contemplarlos)
- **Selección múltiple: 9** (antes 1): `msf-a014:AEG, msf-a023:BD, msf-a080:BC, msf-b039:AF, msf-b057:BD, msf-b072:AD, msf-b081:BE, msf-c054:DE, msf-c082:BD`. Hay «Select TWO» y **«Select THREE»** (`msf-a014`, 3 de 7 opciones). **Hasta 7 opciones (A–G)**: 241 con 4, 10 con 5, 3 con 6, 1 con 7.
- `stem` con bloques `text`/`code`: ahora hay **viñetas** (cada «• …» es un bloque `text` propio) y **18 enunciados con logs/código** (bloques `code` con saltos de línea literales de la maquetación).
- **`objective`** (nuevo, sólo `messerfull`): `{code, title, url}` tomado de «More information: SY0-701, Objective X.Y - …» del PDF (p. ej. `5.5`, `Penetration Tests`, enlace `professormesser.link`). Es el único metadato temático oficial de SY0-701 que aporta el material: puede usarse para filtrar o agrupar, con la advertencia de que existe sólo en este documento.
- `explanation.origin: "pdf"` para las 255 (inglés): `text` + `perOption` (letras incorrectas con su explicación). No hay explicaciones de IA en este documento.
- `answerSource`: `kind: "explanation"` + `keyPage`/`keyPrintedPage` (clave rápida) además de la página de la respuesta detallada. Página impresa = página PDF − 9.
- `section`: `mf-a`, `mf-b`, `mf-c`; `topic`: `Practice Exam A|B|C` (mismo rótulo que el extracto: distinguir por `doc`). IDs: `msf-a006`…`msf-c090`.
- `fragment` (texto literal, como Gorgotsias): `question` y `answer`; **no hay imágenes de página para las preguntas de opción** de este libro.
- **PBQ nuevas (15)**: `bank.pbq` con `doc: "messerfull"`, ids `msf-pbq-a1`…`msf-pbq-c5`; campos extra `questionPages`/`answerPages`, `questionImages`/`answerImages` (JPG 150 dpi en `data/pages/messerfull/p-NNN.jpg`, **31 páginas, 4 MB**). Son arrastrar/emparejar/ordenar o completar tablas: sólo imagen y referencia, sin puntuación. En varias páginas hay **dos PBQ en la misma imagen** (p. ej. B3 y B4 en la pág. 141); la imagen del enunciado y la de la respuesta se muestran enteras.

## Verificación de esta importación
- `scripts/verify_bank.py` sobre los tres documentos: **1541 bloques de enunciado y 5780 opciones** aparecen literalmente en una segunda extracción del PDF (`-raw`); 0 diferencias; 0 problemas estructurales.
- Revisión visual contra imagen de página: C54 (enunciado con log, 5 opciones, respuesta múltiple) y páginas PBQ B3/B4. No se compararon visualmente las 255 una por una.
- Se detectaron y corrigieron durante la importación (derivas de maquetación, no del contenido): números de página y columna «Quick Answer / The Details» que se colaban en opciones, y párrafos de enunciado confundidos con código.
