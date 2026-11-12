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
