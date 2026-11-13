# PLAN-LAYOUT.md — Pantalla de pregunta ajustada a la ventana y contenido extenso bajo demanda

Especificación de ajustes visuales y de distribución sobre la app ya construida. Complementa a `PLAN.md` (con sus "Ajustes al plan") y a `PLAN-IA.md`: todo lo que ahí es regla sigue siendo regla acá, salvo las enmiendas explícitas de la sección 2. Donde hay una decisión, está tomada y justificada.

- Fuentes usadas: `PLAN.md`, `PLAN-IA.md`, `README.md`, `docs/EXTRACTION_SUMMARY.md`, el código de `src/` y `scripts/e2e*.mjs`, y una medición por script de `data/bank.json` (`bankVersion` `3efc5f1a3b`). **No se abrió ningún PDF.** Quien implemente **tampoco debe abrirlos**.
- Convención: "DEBE" = obligatorio para aceptar la fase; "PUEDE" = opcional.
- Sin código de app: solo contratos, medidas y ejemplos CSS cortos.
- Todas las medidas en px son px CSS. Los umbrales de ventana se expresan en `em` (1em = tamaño de fuente raíz, 16 px por defecto) para que respondan también al tamaño de fuente del navegador.

## Índice

0. Hechos que condicionan el diseño
1. Decisiones clave (resumen)
2. Enmiendas a `PLAN.md`
3. Alcance por pantalla
4. Modos de distribución y estructura de alturas
5. Encabezado compacto
6. Área de pregunta: completo, enunciado acotado, área desplazable, vista completa
7. Franja de estado y resultado de "Comprobar"
8. Barra de acciones
9. Vistas de detalle (modales)
10. Navegador de preguntas
11. PBQ, visor de imágenes y fragmento del PDF
12. Texto largo, desbordes y tipografía mínima
13. Teclado, foco y regiones vivas
14. Componentes, archivos y contrato de atributos
15. Pruebas: matriz de ventanas y automatización
16. Fases de implementación
17. Checklist final
18. Información faltante / delegada

---

## 0. Hechos que condicionan el diseño

### 0.1 Medidas del banco actual (1185 preguntas)

| Elemento (caracteres) | p50 | p90 | p99 | máx. |
|---|---|---|---|---|
| Enunciado completo (suma de bloques) | 296 | 364 | 416 | 497 |
| Una opción | 32 | 68 | 98 | 132 |
| Opción más larga de cada pregunta | 40 | 79 | 116 | 132 |
| Enunciado + opciones | 435 | 569 | 650 | 746 |
| Explicación, solo `text` | 296 | 389 | 583 | 698 |
| Explicación completa (`text` + `perOption`) | 843 | 1013 | 1158 | 1764 |
| Explicación de IA (45, Messer) | 130 | 180 | 205 | 205 |
| Motivos de pendiente (`review.reasons`, 8 preguntas) | 226 | 228 | 469 | 469 |
| Palabra más larga en un enunciado | 13 | 15 | 20 | 33 |

- Bloques `code`: 5 preguntas; el mayor tiene 7 líneas y 69 columnas (`msr-a080`). Tipos de bloque existentes: solo `text` y `code`. No hay imágenes en preguntas de opción.
- Opciones por pregunta: 4 (1184) o 5 (1). Una sola de selección múltiple.
- PBQ: 5 soluciones de referencia, 7 imágenes de 1200 × 1800 px, texto extraído de 1213 a 2780 caracteres.

### 0.2 Consecuencias

| Hecho (verificado en código) | Consecuencia |
|---|---|
| La explicación completa mide 843 caracteres de mediana y hoy se inserta dentro de la tarjeta al comprobar (`QuestionCard`) | Con la explicación en línea ninguna pregunta entra en pantalla. La explicación pasa a ser siempre bajo demanda (sección 7) |
| Una pregunta mediana (435 car.) con la tarjeta actual (padding 32, cabecera, insignia, pie con "Ver fragmento") mide unos 610 px de alto a 1366 × 650 y solo hay unos 480 | Para entrar sin scroll hay que sacar del área todo lo que no sea enunciado y opciones (sección 5) y compactar espaciados, no tipografía |
| En móvil chico (375 × ~553 visibles) quedan unos 350 px de área: una pregunta mediana no entra | El desborde del área en móviles chicos es el caso normal, no la excepción: el mecanismo principal ahí es el scroll interno del área, con la barra fija (sección 6) |
| La barra de acciones móvil es `position: fixed` sobre la `BottomNav`, con un `div.reserve` que compensa a mano (`QuestionLayout.module.css`) | Se reemplaza por una fila de grilla: la barra no puede tapar contenido por construcción |
| En móvil, "Anterior" y "Siguiente" ocultan su texto (`.btnText` como `sr-only`) | Incumple "etiquetas legibles": las etiquetas pasan a ser siempre visibles (sección 8) |
| Todo usa `vh` (`AppShell`, `Sidebar`, `Dialog`, `ImageViewer`, `PdfFragmentModal`) | En móvil `100vh` incluye la zona tapada por las barras del navegador. Se migra a `dvh` con respaldo (sección 4.3) |
| `index.html` ya declara `viewport-fit=cover`; solo `BottomNav` y la barra usan `env(safe-area-inset-bottom)` | Faltan los márgenes seguros superior y laterales (horizontal con muesca) |
| `Dialog` es un `<dialog>` nativo con `showModal()`, devuelve el foco y bloquea el scroll con `documentElement.style.overflow` | Se conserva y se endurece (sección 9); el bloqueo no admite diálogos anidados y el retorno de foco falla si el control de origen ya no existe |
| `shortcutsBlocked()` desactiva todos los atajos si hay un `dialog[open]` | Una "vista completa" hecha como diálogo dejaría sin atajos de respuesta y dejaría inertes el temporizador, sus avisos y los toasts. Por eso la vista completa **no** es un diálogo (sección 6.5) |
| `ExamClock` une la cuenta regresiva (`useCountdown`) y la vista del reloj; vive en el encabezado de `ExamRunning` | Ninguna vista de detalle desmonta ni duplica `ExamClock` |
| jsdom no calcula layout; `matchMedia` de los tests devuelve siempre `false` | La decisión de modo y de ajuste se separa en funciones puras con tests; en jsdom el resultado por defecto es "ajustado, contenido completo" |
| `Button` usa `white-space: nowrap` | En encabezado, franja y barra los botones DEBEN poder partir en dos líneas |
| El resultado y Repaso ya recortan una vista previa por caracteres (`stemPreview`, 120 y 90) | Es la única truncación por caracteres de texto del PDF y sigue acotada a esas listas |

---

## 1. Decisiones clave (resumen)

1. **Tres modos de distribución, elegidos por tamaño de ventana en `em`:** `fit` (ajustado), `fit-wide` (ajustado apaisado de poca altura) y `flow` (flujo normal con scroll de página, para zoom o tamaños extremos). En `fit` y `fit-wide` la página no se desplaza nunca.
2. **Grilla de filas, no posiciones fijas:** encabezado compacto / área de pregunta / franja de estado / barra de acciones. Solo el área (fila `minmax(0, 1fr)`) puede desplazarse.
3. **El área contiene solo enunciado y opciones.** Rótulo, insignia, favorita, marca, fragmento, avisos y duplicados pasan al encabezado compacto o a "Ver detalle".
4. **El texto original nunca se corta por caracteres ni se resume.** Si no entra: primero se acota la altura visible del enunciado (con scroll propio, indicador y botón); si aun así no entra, se desplaza el área entera. Las opciones nunca se recortan.
5. **"Ver pregunta completa" es un modo de la misma pantalla, no un diálogo:** los mismos controles de respuesta, la misma barra, el mismo temporizador.
6. **La explicación es siempre bajo demanda** en práctica y revisión: franja con el veredicto + botón "Ver explicación del PDF" o "Ver explicación de IA" (el origen va en el botón) que abre una hoja modal.
7. **La franja de estado tiene altura reservada** antes y después de comprobar: el resultado aparece sin mover la barra.
8. **En pantallas de pregunta de menos de 768 px no se muestran `TopBar` ni `BottomNav`**; el encabezado compacto trae "Volver".
9. **Vistas de detalle = `<dialog>` nativo** con cabecera y pie fijos, cuerpo con scroll interno, `dvh`, cierre siempre visible, retorno de foco con respaldo.
10. **Verificación automática por matriz** de 21 ventanas en un script nuevo `scripts/e2e-layout.mjs`, con contenido largo inyectado por intercepción de red (sin datos de ejemplo en producción).

---

## 2. Enmiendas a `PLAN.md`

Estas reglas cambian. Al terminar, DEBEN agregarse a la sección "Ajustes al plan" de `PLAN.md` con referencia a este documento.

| Regla de `PLAN.md` | Queda así |
|---|---|
| Principio 1: texto del PDF "sin recortar" | El **string** nunca se modifica, corta ni resume y siempre está completo en el DOM. Se permite **acotar la altura visible** del enunciado (6.3) con indicador explícito, scroll propio y acceso a la vista completa. Siguen prohibidos `text-overflow: ellipsis`, `line-clamp`, `slice` y "…" sobre texto del PDF, salvo las vistas previas ya existentes de Resultado y Repaso |
| 3.2: barra de acciones móvil fija sobre la navegación inferior | Fila de grilla; sin `BottomNav` en pantallas de pregunta |
| 3.3: "la tarjeta crece hacia abajo" al comprobar; `ExplanationPanel` dentro de la tarjeta | Veredicto en la franja de estado; explicación en hoja modal |
| `AnswerStatusBadge` `pending` como bloque con motivos | En pantallas de pregunta: chip "Pendiente de revisión" + línea fija + botón "Ver motivo". Los motivos se muestran completos y literales en la hoja. No es un tooltip |
| `OptionItem`: fila mínima 52 px | 52 px en `flow`; 48 px en `fit`; 44 px en `fit-wide` |
| `IconButton` 40 × 40 | 44 × 44 en encabezado compacto, franja, barra, diálogos y visor |
| 5.4 Atajos | Se agregan `L`, `X`, `I`, `RePág`/`AvPág` (sección 13) |
| PBQ: páginas apiladas, cada una con su visor | Una página por vez con paginador dentro del visor (sección 11) |
| `Dialog`: `90vh`, `100vh` | `dvh` con respaldo |
| Fase 7: zoom 200 % | Se amplía a 200–400 % con la matriz de la sección 15 |

Reglas inamovibles que este plan **no** toca: texto literal con `lang="en"`, orden de opciones del banco, sin `dangerouslySetInnerHTML`, origen PDF/IA siempre rotulado, pendientes excluidas de corrección y nota, nada revelado durante el examen, solo tokens de color existentes, `ui/` sin store ni banco.

---

## 3. Alcance por pantalla

| Pantalla | Ruta | Tratamiento | Por qué |
|---|---|---|---|
| Práctica: una pregunta (incluye sesiones de Repaso y listas del plan de IA) | `/practica/:questionId` | **Pantalla de pregunta completa** (secciones 4 a 9) | Es el test |
| Examen en curso | `/examen/en-curso` | **Pantalla de pregunta completa**, sin explicación ni detalle | Es el test; el temporizador exige controles estables |
| Revisión de un intento | `/examen/resultado/:id/revision/:n` | **Pantalla de pregunta completa**, solo lectura | Misma estructura y mismos componentes |
| PBQ: detalle | `/pbq/:pbqId` | **Marco ajustado con visor** (sección 11) | Imagen grande: el visor debe vivir dentro de la pantalla |
| PBQ interactiva (futura) | a definir | Mismo marco (sección 11.4) | Depende del tercer documento |
| Resumen de sesión (`?fin=1`), Resultado, Plan de estudio, Repaso, Dashboard, Selección de práctica, Configuración de examen, Ajustes, lista PBQ | — | **Página normal con scroll**. Solo reciben: endurecimiento de desbordes (sección 12), diálogos nuevos (sección 9) y `dvh` | Son documentos de lectura o formularios, no el test. El plan de IA ya es bajo demanda (acordeones `ConceptCard`, `EvidenceQuestion` en `<details>`) |

En Resultado y Repaso se conserva la vista previa por caracteres existente. DEBE verificarse que, cuando `stemPreview().truncated` es verdadero, la fila muestra "…" visible y un enlace cuyo nombre accesible lleva a la pregunta completa.

---

## 4. Modos de distribución y estructura de alturas

### 4.1 Selección de modo

Función pura `resolveLayoutMode({ widthEm, heightEm, supportsDvh })`, con `widthEm = innerWidth / fuenteRaízPx` y `heightEm = innerHeight / fuenteRaízPx`. Se recalcula en `resize` y `orientationchange`.

| Modo | Condición | Qué pasa |
|---|---|---|
| `fit` | `heightEm ≥ 30` (480 px) | Grilla de 4 filas a alto de ventana. Sin scroll de página |
| `fit-wide` | `20 ≤ heightEm < 30` **y** `widthEm ≥ 40` (640 px) | Igual, compactado: encabezado de una fila, enunciado y opciones en dos columnas, franja integrada a la barra |
| `flow` | cualquier otro caso, o `supportsDvh === false` | Página normal con scroll. Nada fijo ni pegajoso. Todo el contenido completo |

Por qué estos números: el encabezado, la franja y la barra suman como máximo 264 px en `fit` y 108 px en `fit-wide`; con los umbrales elegidos el área nunca queda por debajo de unos 210 px (unas 4 opciones de una línea). Por debajo, fijar controles tapa más de la mitad de la ventana y atrapa al usuario: es el caso de zoom 300–400 % y se resuelve con `flow`.

- En jsdom (`innerHeight` 768, fuente raíz no calculable → 16) el modo es `fit`.
- El modo se publica como `data-qlayout="fit|fit-wide|flow"` en `<html>` mientras haya una pantalla de pregunta montada (se quita al desmontar). Se fija en un efecto de layout para que no haya un primer cuadro con el modo equivocado.
- `supportsDvh` = `CSS.supports('height', '100dvh')`. Sin soporte, `100vh` deja la barra bajo la interfaz del navegador móvil: se usa `flow`.

### 4.2 Filas

```
fit (retrato y escritorio)            fit-wide (apaisado, poca altura)
┌──────────────────────────────┐      ┌───────────────────────────────────────────┐
│ encabezado compacto   (auto) │      │ encabezado, una fila               (auto) │
├──────────────────────────────┤      ├─────────────────────┬─────────────────────┤
│ área de pregunta             │      │ enunciado           │ opciones            │
│ minmax(0, 1fr) ← única fila  │      │        (un solo contenedor con scroll)    │
│ que puede desplazarse        │      │                                           │
├──────────────────────────────┤      ├───────────────────────────────────────────┤
│ fila "continúa"       (auto) │      │ [Anterior] estado … [Comprobar][Siguiente]│
│ franja de estado      (auto) │      └───────────────────────────────────────────┘
│ barra de acciones     (auto) │
└──────────────────────────────┘
```

Ejemplo CSS (orientativo):

```css
/* AppShell mientras hay una pantalla de pregunta ajustada */
:global(:root[data-qlayout^='fit']) .shell {
  height: 100vh;            /* respaldo */
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
}
/* Marco de la pantalla de pregunta */
.screen {
  display: grid;
  height: 100%;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto auto auto;
}
.area {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-padding-block: var(--sp-3);
  padding: 6px;             /* el anillo de foco (3 px + 2 px) no se recorta */
}
.bar {
  padding: var(--sp-2) max(var(--sp-4), env(safe-area-inset-right))
           max(var(--sp-2), env(safe-area-inset-bottom)) max(var(--sp-4), env(safe-area-inset-left));
}
```

Reglas:

- `AppShell.main` y `.container` pasan a `min-height: 0` y sin padding vertical en modos `fit*`; el padding lateral se conserva (16 / 24 / 32 px) con `max(…, env(safe-area-inset-left|right))`.
- El encabezado suma `padding-top: env(safe-area-inset-top)`.
- `html` recibe `overscroll-behavior-y: none` en modos `fit*` (evita el gesto de recarga durante el test).
- Se eliminan `div.reserve`, `position: fixed` de `.actions`, `position: sticky` de `.runHead` y el `window.scrollTo` de `ExamRunning` (pasa a `area.scrollTop = 0` al cambiar de pregunta).
- Columna derecha (≥ 1280 px de ancho, solo modo `fit`): la grilla suma una columna de 300 px que abarca las filas del área, la franja y la barra, con `overflow-y: auto` y `min-height: 0` propios. La barra queda bajo la columna de la pregunta (760 px máx.). En `fit-wide` no hay columna derecha (el navegador se abre con su botón).
- `Sidebar` (≥ 768 px) se conserva: es lateral y no consume altura. Su `height: 100vh` pasa a `100dvh`.
- **Menos de 768 px de ancho:** en pantallas de pregunta no se renderizan `TopBar` ni `BottomNav`, en ningún modo. Por qué: consumen 120 px de alto; el encabezado compacto ya ofrece "Volver" como primer control y la navegación principal queda a un toque.
- `flow`: el marco es un bloque normal; encabezado, área, franja y barra van en ese orden en el flujo del documento. La barra queda al final del contenido (no pegajosa).

### 4.3 Unidades de ventana

- Alto de la app y de los diálogos: `dvh`, siempre precedido por la misma declaración en `vh` como respaldo.
- Por qué `dvh` y no `svh`: como el documento no se desplaza, las barras del navegador no se contraen con el scroll y `dvh` coincide con `svh`; cuando el navegador sí las oculta (rotación, pantalla completa, app instalada), `dvh` aprovecha el espacio y `svh` lo desperdiciaría.
- Prohibido `vw` o `vh` en `font-size`.

### 4.4 Presupuesto de alturas (objetivos medibles con una pregunta mediana)

| Región | `fit`, ancho < 768 | `fit`, ancho ≥ 768 | `fit-wide` |
|---|---|---|---|
| Encabezado compacto | ≤ 112 px | ≤ 128 px | ≤ 52 px |
| Fila "continúa" (solo si el área desborda) | 44 px | 44 px | no existe (botón en el encabezado) |
| Franja de estado | 44 px (hasta 88 si parte en dos líneas) | 48 px | integrada a la barra |
| Barra de acciones | 64 px + margen seguro | 72 px | 56 px + margen seguro |
| Área resultante mínima | ≥ 216 px (a 480 de alto) | — | ≥ 212 px (a 320 de alto) |

---

## 5. Encabezado compacto

Contiene todo lo que hoy rodea a la pregunta y no es enunciado ni opciones. DOM en este orden; ningún texto del PDF se trunca: si no entra, parte en líneas.

### 5.1 Práctica

| Fila | Contenido |
|---|---|
| A | `[← Práctica]` (enlace; con menos de 480 px solo icono con `aria-label` y `title`) · `h1` título de la lista · `[Filtros (n)]` · `[12 / 110]` (abre el navegador; no existe con ≥ 1280 px, donde el navegador está en la columna) |
| B | `h2` rótulo de la pregunta ("Question 37 · pág. 122") · `AnswerStatusBadge` como chip · ☆ Favorita · ⚑ Marcar · `[Ver fragmento]` · `[Ver detalle (n)]` |

- **`h1` (título de la lista, puede ser `topic` literal):** visible solo con `heightEm ≥ 43.75` (700 px) y ancho ≥ 768 px; en los demás casos queda como `sr-only` (sigue en el DOM, recibe el foco al entrar y está en `document.title`) y se muestra completo dentro de "Ver detalle". Nunca se trunca con puntos suspensivos.
- **`FilterBar`:** con menos de 1280 px se abre con el botón "Filtros (n)" (la hoja que ya existe para móvil, ahora en todos los anchos de esta pantalla). Con ≥ 1280 px va en la columna derecha, arriba del navegador.
- **Menos de 480 px:** Favorita, "Ver fragmento", "Ver detalle" y "Atajos" se agrupan en `[⋯ Más]`, que abre una hoja inferior con una lista de filas de 48 px. "Marcar" y la insignia quedan siempre visibles.
- **`[Ver detalle (n)]`** aparece solo si hay algo que mostrar; `n` = cantidad de avisos. Contenido de la hoja, en este orden: título de la lista, "Última vez: …", aviso de contenido cambiado, "También aparece en: …" (enlaces), "Nota de extracción" y motivos de pendiente. Si la pregunta es pendiente, además del chip se muestra la línea fija "No se corrige ni cuenta para la nota." y el botón se rotula **"Ver motivo"**.
- La línea "Preguntas de los capítulos donde tuviste errores…" de las listas `plan:` pasa a "Ver detalle".

### 5.2 Examen en curso

| Fila | Contenido |
|---|---|
| A | `h1` "Examen · Pregunta 12 de 45" (con menos de 480 px, `sr-only`: el botón de posición muestra lo mismo) · `Timer` · `[12 / 45]` (abre el navegador, con menos de 1280 px) · `[Finalizar]` |
| B | Barra de progreso de 4 px + "11 respondidas" · ⚑ Marcar (con texto) |

- Nada más: sin insignia, origen, página, fragmento, favorita ni detalle (regla de `PLAN.md` 3.3).
- `Timer`: el botón "Ocultar" pasa a solo icono con `aria-label` con menos de 480 px.
- El aviso "otra pestaña" (`role="status"`) va al principio del área.

### 5.3 Revisión

Fila A: `[← Volver al resultado]` · `h1` "Revisión · Pregunta 3 de 45" · `[3 / 45]`. Fila B: origen literal (`questionOriginLabel`, `lang="en"`, parte en líneas) · insignia · ☆ · ⚑ · `[Ver fragmento]` · `[Ver detalle (n)]` · `[Ver análisis de IA]` (solo si corresponde, 9.4).

### 5.4 `fit-wide`

Una sola fila: Volver (icono) · rótulo `h2` · insignia · ⚑ · posición · `Timer` y `[Finalizar]` (examen) · `[Ver completa]` (si el área desborda) · `[⋯ Más]` con el resto. En examen, "N respondidas" se muestra en el título del navegador y la barra de progreso queda como línea de 3 px bajo el encabezado.

### Criterios

- Altura del encabezado dentro del presupuesto de 4.4 en toda la matriz (sección 15) con la pregunta mediana.
- Ningún control del encabezado mide menos de 44 × 44 px ni se superpone con otro.
- A 320 px de ancho no hay desborde horizontal en ninguna fila.

---

## 6. Área de pregunta

### 6.1 Contenido

Solo: avisos que no pueden esperar (examen: "otra pestaña"; revisión: "el contenido cambió"), `StemRenderer`, el `fieldset` de opciones, la ayuda de selección múltiple y el mensaje "Ya elegiste N". Sin tarjeta decorativa pesada: superficie `--surface`, borde `--border`, radio `--r-lg`, padding 20 px (≥ 768), 12 px (< 768) y 8 px (`fit-wide`); separación entre bloques 12 px; entre opciones 8 px.

### 6.2 Tres estados de ajuste (por medición, no por caracteres)

Función pura `decideFit({ hBox, hStem, hRest, lineHeight })` → `complete | stem-scroll | area-scroll`.

- `hBox`: alto disponible del contenedor que agrupa el área y la fila "continúa".
- `hStem`: alto natural del enunciado completo (`scrollHeight` de su visor).
- `hRest`: alto de todo lo demás dentro del área (opciones, ayudas, avisos, separaciones, padding).
- `lineHeight`: alto de línea calculado del enunciado, en px.
- Constantes: `STEM_MIN_LINES = 5`, `MORE_ROW = 44`.

| Estado | Condición | Qué se ve |
|---|---|---|
| `complete` | `hStem + hRest ≤ hBox` | Todo completo, sin scroll, sin botón extra |
| `stem-scroll` | no entra, y `hBox − hRest − MORE_ROW ≥ STEM_MIN_LINES × lineHeight` | Opciones completas y visibles. El enunciado se ve en un **visor de altura acotada** a un número entero de líneas: `floor((hBox − hRest − MORE_ROW) / lineHeight) × lineHeight`. Debajo, la fila "continúa" |
| `area-scroll` | cualquier otro caso (opciones largas, poca altura, texto grande) | Nada acotado: enunciado y opciones completos; **el área entera se desplaza**. La fila "continúa" queda fija entre el área y la franja |

Por qué así:

- La medición cubre de una vez texto largo, texto grande, zoom, bloques de código y futuras imágenes; un umbral por caracteres no puede.
- **Las opciones nunca se acotan ni se recortan**: elegir sobre una opción incompleta es el error más caro. Si las opciones son largas, se desplaza el área.
- `stem-scroll` existe para que, cuando sobra lugar para al menos 5 líneas, las opciones no salgan de pantalla; por debajo de 5 líneas un visor es más molesto que desplazar todo.
- Una sola región con scroll vertical por estado: en `stem-scroll` el visor; en `area-scroll` el área.

Reglas de medición:

- Se mide con `ResizeObserver` sobre el contenedor, el enunciado y el bloque de opciones, más `document.fonts.ready`; como máximo un recálculo por cuadro.
- La decisión usa solo alturas naturales (`scrollHeight`), nunca la altura ya acotada: no hay realimentación.
- Sin `ResizeObserver` o con alturas en 0 (jsdom): `complete`.
- Al cambiar de pregunta: `scrollTop = 0` en el área y en el visor.
- Al comprobar no se cambia el `scrollTop`.
- En `flow` el estado es siempre `complete` y no hay fila "continúa".

### 6.3 Visor acotado del enunciado (`stem-scroll`)

- El texto está **completo en el DOM**; nada con `aria-hidden`. Lectores de pantalla, copiar y buscar en la página funcionan sobre el texto entero.
- `overflow-y: auto`, `tabindex="0"`, `role="group"`, `aria-label="Enunciado. Continúa: desplazá para leerlo completo."`, foco visible.
- Borde inferior con degradado de una línea de alto hacia `--surface` mientras no se llegó al final (decorativo, `pointer-events: none`). Se quita al llegar al final (centinela con `IntersectionObserver`). El degradado nunca es el único indicador.
- Sin "…", sin `line-clamp`.

### 6.4 Fila "continúa"

Fila de 44 px con dos partes:

| Estado | Texto (izquierda) | Botón (derecha) |
|---|---|---|
| `stem-scroll` | "El enunciado continúa" con icono `ChevronsDown`; al llegar al final del visor: "Enunciado completo leído" | `[Ver pregunta completa]` |
| `area-scroll` | "La pregunta continúa abajo"; al llegar al final del área: "Fin de la pregunta" | `[Ver pregunta completa]` |

- La fila existe mientras dure el estado (no aparece y desaparece al desplazar: solo cambia el texto), así el área no cambia de alto al llegar al final.
- El texto es `aria-hidden="true"` (quien usa lector de pantalla ya tiene el texto completo); el botón no.
- Con menos de 400 px el botón dice "Ver completa" (`aria-label` completo).
- En `fit-wide` no hay fila: el botón "Ver completa" va en el encabezado y el indicador es el degradado inferior del área más el texto "Continúa abajo" junto al botón.

### 6.5 Vista completa

Es un **modo de la misma pantalla** (`data-view="full"`), no un diálogo.

Por qué no un `<dialog>`: duplicaría el grupo de opciones (dos grupos de radio con el mismo nombre), dejaría inertes el temporizador, sus avisos y los toasts, bloquearía los atajos (`dialog[open]`) y obligaría a duplicar la barra. En el mismo árbol, la respuesta seleccionada, el temporizador y la navegación son literalmente los mismos.

| Aspecto | Comportamiento |
|---|---|
| Entrada | Botón "Ver pregunta completa" (`aria-pressed`) o tecla `L`. El botón solo existe cuando el estado no es `complete`; `L` funciona siempre |
| Qué cambia | Se ocultan `Sidebar`, columna derecha y la fila B del encabezado. Encabezado de una fila: `[✕ Salir de la vista completa]` · rótulo `h2` · posición · `Timer` (examen) · ⚑. El área usa todo el ancho hasta 80ch, centrada, en estado `area-scroll` forzado (nada acotado). Sin fila "continúa" |
| Qué no cambia | Opciones (mismos nodos), franja de estado y barra de acciones: se puede elegir, comprobar, reintentar, pasar de pregunta y finalizar |
| Persistencia | Se mantiene al pasar de pregunta dentro de la misma pantalla; se apaga al salir de la pantalla. No se guarda en preferencias |
| Salida | Botón Salir, `Esc` (si no hay diálogo abierto) o `L`. El foco vuelve al botón que la activó; si ya no existe (la pregunta actual entra completa), al `h2` de la pregunta |
| Anuncio | Región viva: "Vista completa activada" / "Vista completa desactivada" |
| `flow` | No se ofrece (todo está completo y la página se desplaza) |

### 6.6 Bloques de código, imágenes y dos columnas

- **Bloque `code`:** sin cambios de contenido (`white-space: pre`, scroll horizontal propio, enfocable). Se agrega un degradado en el borde derecho mientras haya contenido oculto a la derecha y `overscroll-behavior-x: contain`. El bloque no tiene scroll vertical propio: crece y cuenta dentro de `hStem`. PUEDE agregarse, solo en la vista completa, un conmutador "Ajustar líneas largas" (`white-space: pre-wrap`; el texto no cambia), apagado por defecto.
- **Imagen dentro de un enunciado (hoy no existe; ver sección 18):** miniatura completa, nunca recortada (`object-fit: contain`, alto máximo = el menor entre 320 px y 40 % de `hBox`), con botón "Ampliar imagen" que abre el `ImageViewer` en una hoja a pantalla completa.
- **`fit-wide`:** el área es una grilla `minmax(0, 1.1fr) minmax(0, 1fr)` (enunciado | opciones) dentro de un único contenedor con scroll; en ese modo no hay `stem-scroll`, solo `complete` o `area-scroll`.

### Criterios

- Con la pregunta mediana: `complete` en 390 × 844, 430 × 932, 768 × 1024, 1024 × 768, 1280 × 720, 1366 × 650, 1440 × 900 y 1920 × 1080. La más justa es 1366 × 650 (estimado: unos 385 px de contenido en unos 400 de área). Si alguna no se cumple, se ajustan espaciados o el alto del encabezado; no se tocan la tipografía mínima ni los umbrales de 4.1.
- El `textContent` de enunciado y opciones es idéntico al del banco en los tres estados y en la vista completa (el test de la muestra de 50 ids se repite forzando cada estado).
- En `stem-scroll`, el visor muestra un número entero de líneas (su alto es múltiplo de `lineHeight` ± 1 px) y al menos 5.
- Con una opción de 400 caracteres, ninguna opción tiene `scrollHeight > clientHeight` ni `overflow` distinto de `visible`.
- En ningún estado existe texto del PDF con `text-overflow: ellipsis` o `-webkit-line-clamp` (test que recorre los estilos calculados dentro del área).
- Entrar y salir de la vista completa no cambia la selección, no desmonta las opciones (misma cantidad de `input`) y devuelve el foco.

---

## 7. Franja de estado y resultado de "Comprobar"

Fila propia entre el área y la barra, **siempre presente** en `fit` (alto mínimo 44 px), así comprobar no mueve nada. En `fit-wide` su contenido va dentro de la barra, entre "Anterior" y el botón central. En `flow` es un bloque normal sobre la barra.

| Pantalla y momento | Izquierda (texto) | Derecha (botones) |
|---|---|---|
| Práctica, sin comprobar | Ayuda: "Elegí una opción" o "Elegí 2 respuestas (1 de 2)". Si hay registro previo: "Última vez: incorrecta · hace 2 días" | — |
| Práctica, comprobada | Veredicto con icono y texto: "Incorrecto. Elegiste B. La respuesta correcta es C." | `[Ver explicación del PDF]` o `[Ver explicación de IA]` |
| Práctica, pendiente sin revelar | "Esta pregunta no se corrige ni cuenta para la nota." | `[Ver motivo]` |
| Práctica, pendiente revelada | Aviso ámbar: "El PDF indica la letra C… No está validada." (texto actual de `pendingReveal`) | `[Ver explicación del PDF (no validada)]` |
| Examen | "Sin responder" / "Respuesta guardada" / "Elegí 2 respuestas (1 de 2)" | `[Borrar respuesta]` (solo si hay selección) |
| Revisión | "Correcta" / "Incorrecta. Elegiste B. Correcta: C." / "Omitida. Correcta: C." | `[Ver explicación …]` |

Reglas:

- El veredicto es texto de la app (no del PDF): es el "resumen breve inicial". **No se muestra ningún extracto de la explicación** en la franja: una explicación del PDF no se puede resumir y un recorte sin contexto confunde. La explicación completa está a un toque o a la tecla `X`.
- **Origen siempre visible:** el botón de explicación lleva icono y texto de origen. PDF: `FileText`, borde `--info-border`. IA: `Sparkles`, borde discontinuo `--warning-border`. No validada: `TriangleAlert`. Con menos de 400 px el texto visible se acorta a "Explicación (PDF)" / "Explicación (IA)" con el `aria-label` completo. Dentro de la hoja siguen los rótulos exactos de `PLAN.md` ("Explicación del PDF (en inglés)", "Explicación generada por IA — no es del PDF" y su línea de advertencia).
- **Estado de la respuesta siempre visible:** la insignia (`Respuesta del PDF`, `Pendiente de revisión`, `Respuesta propuesta por IA — requiere validación`) va en el encabezado compacto, antes y después de comprobar.
- El elemento del veredicto conserva `data-feedback="correct|incorrect|omitted|unreliable"`.
- El contenedor del texto del veredicto es la región viva (`aria-live="polite"`), montada vacía desde el principio. La ayuda previa a comprobar **no** está dentro de la región viva: se asocia a "Comprobar" con `aria-describedby` (como hoy `check-help`).
- La explicación se sigue pidiendo en segundo plano al comprobar (como hoy), para que la hoja abra con el contenido listo. `loading` y `error` se muestran dentro de la hoja.
- Animación: el veredicto entra solo con opacidad (`--dur-2`), sin desplazamiento vertical.
- Marcas por opción ("Tu respuesta · Incorrecta", "Respuesta correcta"): se conservan con icono, texto y borde. Con menos de 768 px van debajo del texto de la opción (como hoy); eso puede hacer crecer filas y pasar el área a `area-scroll`, lo cual está permitido porque franja y barra no se mueven.
- `feedbackExtra` ("Acertada: va a salir de Falladas.") se muestra en la franja, bajo el veredicto.
- En examen, la franja nunca contiene las cadenas prohibidas por los tests existentes ("Explicación", "Correcto", "Incorrecto", "Respuesta del PDF", "pág.").

### Criterios

- Entre "sin selección", "con selección" y "comprobada", el borde inferior de la barra de acciones no cambia (± 1 px) y, si la franja no parte en dos líneas, tampoco su borde superior.
- Tras comprobar no hay ningún `ExplanationPanel` en el DOM hasta abrir la hoja.
- El botón de explicación existe en práctica comprobada y en revisión, y **no existe** en examen.
- La región viva anuncia el veredicto una vez por comprobación; el foco no se mueve al comprobar.

---

## 8. Barra de acciones

| Pantalla | Izquierda | Centro | Derecha |
|---|---|---|---|
| Práctica | Anterior | Comprobar → Reintentar (o "Ver lo que dice el PDF" en pendientes) | Siguiente (o Terminar en la última) |
| Examen | Anterior | — | Siguiente (o Finalizar en la última) |
| Revisión | Anterior | — | Siguiente (o "Volver al resultado" en la última) |
| PBQ | ← anterior | Texto extraído | siguiente → |

- Primario (un solo botón violeta por estado): "Comprobar" antes de comprobar; "Siguiente"/"Terminar" después; en examen y revisión, el derecho.
- En los extremos "Anterior" queda `aria-disabled` (no se quita: las posiciones no cambian).
- "Finalizar" del examen sigue además en el encabezado; ambos abren el mismo diálogo de confirmación.

Distribución:

| Ancho | Distribución |
|---|---|
| ≥ 480 px (30em) | Una fila, `1fr auto 1fr` (izquierda al borde izquierdo, derecha al borde derecho), icono + texto, botones de 48 px de alto |
| < 480 px | Una fila, `minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 1fr)`, separación 8 px, **texto visible sin icono**, fuente no menor de 0,9375rem, `white-space: normal`, hasta 2 líneas, alto mínimo 48 px |
| < 480 px con rótulo central de más de 12 caracteres ("Ver lo que dice el PDF") | Dos filas: central a ancho completo arriba; Anterior y Siguiente abajo en `1fr 1fr` |
| Dos botones (examen, revisión) con < 480 px | `1fr 1fr` |
| `fit-wide` | Una fila: `[Anterior]` · estado (flexible, hasta 2 líneas) · `[botón de la franja]` · `[centro]` · `[Siguiente]`, botones de 44 px |

- El texto visible nunca se reemplaza por un icono solo ni se oculta con `sr-only`.
- Fondo `--surface`, borde superior `--border`, sin sombra.
- Los toasts no pueden tapar la barra ni la franja: en pantallas de pregunta la región de toasts se ancla por encima de ambas (variable CSS `--q-bottom-stack` publicada por el marco con el alto real de franja + barra) y muestra de a uno.

### Criterios

- En toda la matriz: cada botón visible de la barra está íntegro dentro de la ventana, mide ≥ 44 × 44 px, no se superpone con otro, y su texto no desborda (`scrollWidth ≤ clientWidth`, `scrollHeight ≤ clientHeight`).
- El rectángulo de la barra no interseca el del área ni el de la franja.
- A 320 px se leen completos "Anterior", "Comprobar", "Reintentar", "Siguiente", "Terminar" y "Finalizar" en una línea.
- Con el área desplazada hasta el final, la última opción queda entera por encima de la franja.

---

## 9. Vistas de detalle (modales)

### 9.1 Base: `Dialog` endurecido

Se conserva el `<dialog>` nativo con `showModal()`. Cambios obligatorios:

| Tema | Especificación |
|---|---|
| Estructura | Cabecera (título + Cerrar) y pie (acciones) con `flex: none`; opcional una subcabecera fija (pestañas, recapitulación). Solo el cuerpo se desplaza (`overflow: auto`, `min-height: 0`, `overscroll-behavior: contain`) |
| Tamaño | `max-height: min(90dvh, 100dvh − 32px)` con respaldo en `vh`. Ancho `min(560px, 100vw − 32px)`; `lg` 880 px |
| Móvil (< 768 px) y toda ventana con `heightEm < 30` | Pantalla completa: `width: 100vw`, `height: 100dvh`, sin radio; cabecera con `padding-top: env(safe-area-inset-top)`, pie con `padding-bottom: env(safe-area-inset-bottom)`, laterales con `env(safe-area-inset-left|right)` |
| `flow` (`heightEm < 20`) | El diálogo entero se desplaza; la cabecera queda `position: sticky; top: 0` para que Cerrar siga visible |
| Cerrar | Botón de 44 × 44 px en la cabecera, siempre visible. `Esc` y clic en el fondo cierran (como hoy) |
| Foco al abrir | Hojas de lectura: el título (`tabindex="-1"`), con el cuerpo en `scrollTop = 0`. Confirmaciones: como hoy |
| Foco al cerrar | Vuelve al control que abrió. Si ya no está en el DOM: al elemento marcado `data-focus-fallback` de la pantalla (el `h2` de la pregunta) |
| Bloqueo de fondo | Contador de diálogos abiertos: el `overflow` del documento se restaura solo cuando se cierra el último. Como máximo dos niveles (por ejemplo, navegador → confirmación) |
| Animación | Centrado: opacidad + `scale(.98 → 1)` (actual). Pantalla completa y hojas: opacidad + `translateY(16px → 0)`, `--dur-3`. Con `prefers-reduced-motion`: sin transformación, 0,01 ms (actual) |
| Cambio de pregunta o de ruta | Toda hoja abierta se cierra sin devolver foco a un control de la pregunta anterior |
| Texto | `overflow-wrap: anywhere` en título y cuerpo; el título parte en líneas |

### 9.2 Variante lateral para lectura (≥ 1100 px)

Las hojas de explicación, detalle y análisis se abren como panel a la derecha (`min(520px, 45vw)`, alto `100dvh`) para que la pregunta quede a la vista a la izquierda. Token nuevo `--overlay-soft` (`rgba(18,17,23,.25)` claro, `rgba(0,0,0,.35)` oscuro) para el fondo de estas hojas: con el `--overlay` normal la pregunta no se lee. Entre 768 y 1099 px: diálogo centrado `lg`. Menos de 768 px: pantalla completa.

### 9.3 "Ver explicación"

- Título: "Explicación · Question 37" (rótulo literal de la pregunta).
- Subcabecera fija: recapitulación del veredicto (texto de la app).
- Cuerpo: el `ExplanationPanel` actual sin cambios (rótulo de origen, referencia de página, texto literal, "Por qué las otras opciones son incorrectas", variante `unreliable`, `loading`, `error` con Reintentar).
- Pie: `[Cerrar]` y, en práctica y revisión, `[Siguiente]` (primario): cierra la hoja y avanza; el foco va al `h2` de la nueva pregunta.
- No se abre sola. PUEDE agregarse la preferencia "Abrir la explicación al comprobar" (apagada por defecto), fuera del alcance obligatorio.

### 9.4 "Ver detalle", "Ver motivo" y "Ver análisis de IA"

- **Detalle / motivo:** contenido de 5.1. Los motivos de pendiente (`review.reasons`) y las notas de extracción se muestran completos y literales, en lista.
- **Ver análisis de IA (solo Revisión):** aparece si el intento tiene un análisis guardado válido (`analysisStore`) y la pregunta figura en un concepto o en `keyFlags`. La hoja muestra, dentro de contenedores `AiGenerated` (`lang="es"`): nombre del concepto, la nota de esa pregunta, la nota de `keyFlags` si existe y el enlace "Abrir tu plan de estudio". No muestra texto del PDF (ya está en pantalla). No dispara ningún pedido a la API.

### 9.5 Otras hojas

"Ver fragmento del PDF" (sección 11.3), navegador (sección 10), filtros, "Más", atajos y "Texto extraído" de PBQ usan la misma base.

### Criterios

- En toda la matriz, con una explicación de 3000 caracteres más 4 entradas por opción de 600: el diálogo está íntegro dentro de la ventana; el documento no se desplaza; el cuerpo sí (`scrollHeight > clientHeight`); tras llevar el cuerpo al final, el botón Cerrar sigue dentro de la ventana y visible.
- Abrir y cerrar cualquier hoja: misma selección, mismo estado comprobado, mismo `scrollTop` del área, foco en el control de origen.
- En examen: con una hoja o la vista completa abierta 2 s, el tiempo restante baja 2 s (± 1) y nunca vuelve a un valor mayor; `remainingMs` guardado es monótono decreciente.
- Abrir un segundo diálogo y cerrarlo no desbloquea el fondo mientras el primero siga abierto.

---

## 10. Navegador de preguntas

| Ancho / modo | Presentación |
|---|---|
| ≥ 1280 px, `fit` | En la columna derecha (como hoy), con scroll propio |
| 768–1279 px, o `fit-wide` | Panel lateral derecho (variante `side` actual), alto `100dvh` |
| < 768 px | **Hoja a pantalla completa** |

- Se abre con el botón de posición ("12 / 110") o con `G`.
- Grilla `repeat(auto-fill, 44px)` con separación de 6 px (actual), dentro del cuerpo con scroll.
- Al abrir, la pregunta actual queda a la vista (`scrollIntoView({ block: 'center' })`, sin animación) y recibe el foco.
- Leyenda de estados como pie fijo de la hoja (texto, siempre visible). Si con ella el cuerpo queda en menos de 3 filas de botones (unos 150 px), pasa al final del cuerpo desplazable.
- El selector de rango para más de 150 ítems va en la subcabecera fija.
- En examen, el título incluye "N respondidas".
- Elegir una pregunta cierra la hoja y navega; el foco va al `h2` de la pregunta.
- PUEDE agregarse en examen un filtro "Todas / Sin responder / Marcadas".

Criterios: a 320 × 568 con 110 y con 1185 ítems, la grilla no desborda en horizontal, Cerrar y la leyenda quedan visibles, la actual está a la vista al abrir.

---

## 11. PBQ, visor de imágenes y fragmento del PDF

### 11.1 `ImageViewer`

- Propiedad nueva `fill`: la caja ocupa el alto disponible de su contenedor (`flex: 1; min-height: 0`) en lugar de `max-height: 70vh`. Sin `fill` se comporta como hoy, con `70dvh`.
- Barra de zoom en una sola fila de 44 px: con menos de 480 px de ancho o en `fit-wide`, "Ajustar al ancho" y "Restablecer" pasan a solo icono con `aria-label` y `title`; `−`, nivel y `+` no cambian.
- Paginador opcional en la misma barra: `[‹]` "Página 1 de 2" `[›]` (región viva al cambiar).
- PUEDE agregarse el nivel "Página entera" (la imagen completa dentro de la caja).

### 11.2 Detalle de PBQ (`/pbq/:pbqId`)

Marco ajustado con las mismas reglas de modo de la sección 4:

| Fila | Contenido |
|---|---|
| Encabezado | `[← Referencia PBQ]` · `h1` "PBQ A1" · chip "Solución del PDF — sin puntuación" · `[ⓘ Ver detalle]` (la nota del banco) |
| Título | `title` literal completo, `lang="en"`, parte en líneas |
| Visor (`minmax(0, 1fr)`) | `ImageViewer` con `fill`, **una página por vez** con paginador. Pie de foto bajo la barra del visor |
| Barra | `[← A anterior]` · `[Texto extraído]` · `[Siguiente: A2 →]` |

- "Texto extraído de la página" pasa de `<details>` a una hoja con el `<pre lang="en">` actual.
- Sin controles de respuesta ni puntaje (regla existente).
- En `flow`: el visor vuelve a `max-height: 70dvh` y la página se desplaza.

### 11.3 Fragmento del PDF (`PdfFragmentModal`)

- Las pestañas pasan a la subcabecera fija del diálogo.
- Texto (Gorgotsias): se quita `max-height: 55vh` del `<pre>`; el único scroll es el del cuerpo del diálogo. "Copiar texto" pasa al pie fijo.
- Imagen (Messer): `ImageViewer` con `fill` dentro del cuerpo, que en este caso no se desplaza.

### 11.4 PBQ interactiva (tercer documento; marco, no detalle)

Lo que se puede fijar sin conocer el contenido:

- Usa el mismo marco: encabezado compacto / área de trabajo con scroll interno / franja de estado / barra (Anterior, Comprobar, Siguiente).
- Área de trabajo en dos paneles, "Escenario" y "Tu respuesta": lado a lado con ≥ 900 px de ancho; con menos, pestañas fijas arriba del área.
- Imágenes: miniatura completa + "Ampliar imagen" (6.6).
- Ninguna interacción depende solo de arrastrar: toda asociación, orden o colocación DEBE poder hacerse con botones o listas (toque y teclado), con objetivos de 44 px.
- Respuestas detalladas: hoja "Ver explicación".

Todo lo demás (tipos de ejercicio, corrección, modelo de datos) está en la sección 18.

### Criterios

- A 390 × 844, 844 × 390 y 1280 × 720: la barra del visor, la imagen y la barra inferior están dentro de la ventana; el documento no se desplaza; la imagen ampliada se desplaza dentro de la caja.
- A1 y A2 muestran "Página 1 de 2" y el paginador cambia la imagen.
- Zoom por botones, teclado, Ctrl + rueda y pellizco siguen funcionando (checks existentes).

---

## 12. Texto largo, desbordes y tipografía mínima

| Regla | Detalle |
|---|---|
| Palabras y URL largas | `overflow-wrap: anywhere` en todo contenedor de texto del banco, de IA, de avisos, títulos, chips, diálogos y botones de encabezado, franja y barra. `hyphens: none` en texto del PDF (no se agregan guiones que el original no tiene) |
| Hijos de flex y grid | `min-width: 0` en todo hijo que contenga texto |
| Chips e insignias | `max-width: 100%`, `white-space: normal` |
| Botones de encabezado, franja y barra | `white-space: normal`, hasta 2 líneas, alto automático con mínimo 44 px |
| Código, imagen ampliada y tablas | Scroll horizontal **dentro de su contenedor**; son las únicas excepciones admitidas |
| URL en explicaciones | Texto plano, sin convertir en enlace (no hay HTML ni detección de enlaces sobre texto del banco) |
| Tipografía mínima | Enunciado ≥ 1rem (solo `fit-wide` baja de 1,0625 a 1rem; `fit` usa los tokens actuales). Opciones 1rem. Botones ≥ 0,9375rem. Metadatos ≥ 0,875rem. No se agrega ningún tamaño menor a los existentes |
| Compactación permitida | Solo espaciados: padding del área, separaciones, alto mínimo de fila de opción (48 / 44 px), padding de opción |
| Preferencia "Tamaño del texto: Grande" | Se respeta; la medición de 6.2 decide el estado. No se anula en ningún modo |
| No atrapar | En `flow` todo es alcanzable con scroll de página. En `fit*`, toda región con contenido oculto es desplazable con toque, rueda y teclado |

No se agrega `overflow-x: hidden|clip` global para tapar desbordes: se corrige la causa y los tests lo verifican.

---

## 13. Teclado, foco y regiones vivas

### 13.1 Atajos nuevos (se suman a `PLAN.md` 5.4)

| Tecla | Acción | Dónde |
|---|---|---|
| `L` | Entrar o salir de la vista completa | Práctica, examen, revisión |
| `X` | Abrir "Ver explicación" | Práctica comprobada o revelada, revisión |
| `I` | Abrir "Ver detalle" / "Ver motivo" | Práctica, revisión |
| `RePág` / `AvPág` / `Inicio` / `Fin` | Desplazar el área de pregunta (o el visor del enunciado en `stem-scroll`) | Modos `fit*`, sin diálogo abierto y sin foco en un campo |
| `Esc` | Cierra el diálogo abierto; si no hay, sale de la vista completa | — |

- Son atajos de una tecla: respetan la preferencia que los desactiva. `RePág`/`AvPág`/`Inicio`/`Fin` y `Esc` no dependen de esa preferencia.
- Las letras de opción siguen teniendo prioridad si una pregunta llegara a tener opciones `I`, `L` o `X`.
- Con un diálogo abierto, los atajos de pregunta siguen bloqueados (regla actual). La vista completa no es un diálogo: ahí funcionan todos.
- `←` / `→` no cambian de pregunta cuando el foco está en un bloque `code`, en el visor de imagen, en pestañas (como hoy) ni en el visor acotado del enunciado.
- `ShortcutsDialog` suma las filas nuevas.

### 13.2 Foco

- Orden de tabulación = orden del DOM = orden visual: encabezado → área (visor del enunciado si es desplazable → opciones) → fila "continúa" → franja → barra → columna derecha.
- Al comprobar, reintentar o pasar de pregunta el foco no se mueve (reglas actuales). Excepción: si el control enfocado desaparece, el foco pasa al `h2` de la pregunta.
- Regiones desplazables sin hijos enfocables (visor del enunciado, bloques `code`): `tabindex="0"`, nombre accesible y foco visible.
- Las regiones con scroll tienen 6 px de padding interno para que el anillo de foco no se recorte.
- Ningún elemento enfocado queda tapado: no hay elementos fijos superpuestos al área (WCAG 2.4.11).

### 13.3 Regiones vivas

| Región | Contenido | Tipo |
|---|---|---|
| Veredicto (franja) | Resultado de comprobar o de revelar | `polite`, existente, reubicada |
| "Ya elegiste N" | Existente, dentro del área | `polite` |
| Vista completa | "Vista completa activada / desactivada" | `polite`, `sr-only` |
| Paginador del visor | "Página 2 de 2" | `polite` |
| Temporizador | Sin cambios (`role="timer"`, avisos de 5 y 1 minuto) | — |

El cambio de estado de ajuste (6.2) **no** se anuncia: es visual y el texto completo ya está disponible.

---

## 14. Componentes, archivos y contrato de atributos

### 14.1 Archivos

| Archivo | Tipo | Responsabilidad |
|---|---|---|
| `src/ui/QuestionScreen/layoutMode.ts` | nuevo, puro | `resolveLayoutMode` y constantes de umbral (única fuente de los números de este plan) |
| `src/ui/QuestionScreen/fit.ts` | nuevo, puro | `decideFit` |
| `src/ui/QuestionScreen/QuestionScreen.tsx` + CSS | nuevo, solo props | Marco: regiones (encabezado, área, continúa, franja, barra, columna), modo, medición, vista completa, `data-qlayout` en `<html>`, `--q-bottom-stack` |
| `src/ui/QuestionScreen/ActionBar.tsx`, `StatusStrip.tsx`, `MoreRow.tsx` | nuevos, solo props | Secciones 8, 7 y 6.4 |
| `src/hooks/useLayoutMode.ts`, `useFitState.ts` | nuevos | Suscripción a `resize` y `ResizeObserver` |
| `src/ui/Dialog/` | modificado | Sección 9.1; tamaños `full` y `reading` |
| `src/ui/QuestionCard/` | modificado | Se divide en cabecera (rótulo, insignia, conmutadores) y cuerpo (enunciado, opciones, ayudas). Deja de renderizar `ExplanationPanel`, pie, feedback y "Borrar respuesta" |
| `src/ui/ImageViewer/`, `PdfFragmentModal/`, `QuestionNavigator/`, `Toast/`, `Sidebar/`, `AppShell/`, `Button/`, `StemRenderer/` | modificados | Secciones 11, 10, 8, 4 y 12 |
| `src/features/common/QuestionPanel.tsx`, `QuestionLayout.module.css` | modificados | Arman las regiones del marco; se elimina el CSS de barra fija |
| `src/features/practice/PracticeQuestion.tsx`, `exam/ExamRunning.tsx`, `exam/ExamReview.tsx`, `pbq/PbqDetail.tsx` | modificados | Usan el marco |
| `src/hooks/useShortcuts.ts` | modificado | Atajos de 13.1 |
| `src/i18n/es.ts` | modificado | Todos los textos nuevos de este plan |
| `src/styles/tokens.css` | modificado | `--overlay-soft`; se quita `--actionbar-h` si queda sin uso |
| `src/test/layoutFixtures.ts` | nuevo | Preguntas sintéticas de prueba (sección 15.2) |
| `scripts/e2e-layout.mjs`, `scripts/lib/e2e-utils.mjs` | nuevos | Sección 15 |

Se respetan las capas: `ui/` no importa store ni banco; el marco recibe todo por props.

### 14.2 Contrato de atributos (para tests y e2e)

| Atributo | Valores |
|---|---|
| `html[data-qlayout]` | `fit`, `fit-wide`, `flow` (ausente fuera de pantallas de pregunta) |
| `[data-qscreen]` | `practice`, `exam`, `review`, `pbq` |
| `[data-view]` | `normal`, `full` |
| `[data-qregion]` | `header`, `area`, `more`, `status`, `actions`, `aside` |
| `[data-fit]` (en el área) | `complete`, `stem-scroll`, `area-scroll` |
| `[data-stem-viewport]`, `[data-at-end]` | visor del enunciado |
| `[data-feedback]` | `correct`, `incorrect`, `omitted`, `unreliable` (existente) |
| `[data-action]` | `prev`, `check`, `retry`, `reveal`, `next`, `finish`, `back-to-result`, `full`, `explanation`, `detail`, `analysis`, `fragment`, `navigator`, `more`, `clear` |
| `dialog[data-sheet]` | `explanation`, `detail`, `analysis`, `fragment`, `navigator`, `filters`, `more`, `shortcuts`, `pbq-text`, `image` |
| `[data-focus-fallback]` | el `h2` de la pregunta |
| Existentes que se conservan | `article[data-question-id]` (envuelve cabecera de pregunta, área y franja), `label[data-letter][data-state]`, `section[data-origin][data-variant]`, `[data-zoom-viewer]` |

---

## 15. Pruebas

### 15.1 Matriz de ventanas

"Zoom N %" se simula con la ventana dividida por N/100 y `deviceScaleFactor` = N/100. "Fuente 200 %" se simula inyectando `html { font-size: 200% }`.

| ID | Ventana (px CSS) | Representa | Modo esperado |
|---|---|---|---|
| M1 | 320 × 568 | Móvil mínimo | `fit` |
| M2 | 360 × 560 | Android chico con barras del navegador | `fit` |
| M3 | 375 × 553 | iPhone SE con barras | `fit` |
| M4 | 390 × 844 | Móvil actual | `fit` |
| M5 | 430 × 932 | Móvil grande | `fit` |
| L1 | 667 × 375 | Horizontal chico | `fit-wide` |
| L2 | 844 × 390 | Horizontal | `fit-wide` |
| L3 | 932 × 430 | Horizontal grande | `fit-wide` |
| T1 | 768 × 1024 | Tablet vertical | `fit` |
| T2 | 1024 × 768 | Tablet horizontal | `fit` |
| D1 | 1280 × 720 | Portátil | `fit` |
| D2 | 1366 × 650 | Portátil con barras del navegador | `fit` |
| D3 | 1440 × 900 | Escritorio | `fit` |
| D4 | 1920 × 1080 | Escritorio grande | `fit` |
| H1 | 1280 × 400 | Poca altura | `fit-wide` |
| H2 | 1024 × 320 | Límite inferior | `fit-wide` |
| H3 | 360 × 420 | Pantalla dividida | `flow` |
| Z200 | 640 × 360, escala 2 | 1280 × 720 al 200 % | `fit-wide` |
| Z300 | 427 × 240, escala 3 | 1280 × 720 al 300 % | `flow` |
| Z400 | 320 × 256, escala 4 | 1280 × 1024 al 400 % (referencia WCAG 1.4.10) | `flow` |
| F200 | 390 × 844, fuente 200 % | Texto del navegador al doble | `flow` |

M1–M5 y L1–L3 con `isMobile` y `hasTouch`. M4 y D1 se corren además en tema oscuro. M4 y L2 se corren además con márgenes seguros simulados (ver 15.4).

### 15.2 Contenido de prueba (sintético, no sale de ningún PDF)

Definido en `src/test/layoutFixtures.ts` y reutilizado por Vitest y por el e2e.

| Fixture | Contenido |
|---|---|
| `corta` | Enunciado de 80 caracteres, 4 opciones de 12 |
| `mediana` | Enunciado de 300, 4 opciones de 35 (equivale al p50 real) |
| `enunciado-largo` | 1500 caracteres en 3 bloques `text` |
| `opciones-largas` | Enunciado de 300, 5 opciones de 400 |
| `codigo` | Texto + bloque `code` de 30 líneas y 140 columnas + texto |
| `palabra-larga` | Cadena sin espacios de 300 caracteres y una URL de 200, en enunciado, en una opción y en la explicación |
| `multiple` | "Elegir 3" con 7 opciones |
| `explicacion-pdf-larga` | Explicación de 3000 caracteres + 4 entradas por opción de 600 |
| `explicacion-ia-larga` | Explicación `origin: "ai"` de 2000 caracteres |
| `pendiente-larga` | 3 motivos de 400 caracteres |
| `imagen` | Se agrega cuando exista el tipo de bloque (sección 18) |

En e2e se inyectan con `page.route` sobre las respuestas de `bank/core.*.json` y `bank/explanations.*.json`, sustituyendo `stem`, `options`, `explanation` y `review` de ids existentes (por ejemplo `gor-cap1-0002` a `gor-cap1-0012`). Antes de usar esta vía DEBE confirmarse la forma real de esos archivos y que la carga no rechace el contenido alterado; si lo rechaza, el script genera una copia del banco con los fixtures en una carpeta temporal y sirve la app desde ahí. En ningún caso se agregan datos de ejemplo al build de producción.

### 15.3 Aserciones automáticas (`scripts/e2e-layout.mjs`, `npm run e2e:layout`)

Mismo estilo que `scripts/e2e.mjs` (Playwright + Chromium contra `vite preview`, `check(nombre, ok, detalle)`, capturas en `e2e-output/layout/<ID>-<pantalla>-<estado>.png`, salida con código 1 si algo falla). Los auxiliares comunes (`newPage`, `go`, `shot`, `axeCheck`, `noHScroll`) se mueven a `scripts/lib/e2e-utils.mjs` y los tres scripts los importan.

Función `assertLayout(page, modoEsperado)`, ejecutada en cada celda:

| # | Verificación | Cómo |
|---|---|---|
| 1 | Modo correcto | `html[data-qlayout]` = esperado |
| 2 | Sin scroll horizontal de página | `documentElement.scrollWidth ≤ clientWidth` |
| 3 | Sin scroll vertical de página (`fit*`) | `scrollHeight ≤ innerHeight + 1` y, tras `scrollTo(0, 9999)`, `scrollY === 0` |
| 4 | Botones dentro de la ventana | Rectángulo de cada `[data-qregion="actions"] button` dentro de `0…innerWidth` × `0…innerHeight`. En `flow`: tras `scrollIntoView` |
| 5 | Sin superposiciones | Ningún par de botones de barra, franja y encabezado se interseca; barra ∩ área = ∅; franja ∩ área = ∅; encabezado ∩ área = ∅ |
| 6 | Objetivo táctil | Cada control interactivo de encabezado, franja, barra y cabecera de diálogo mide ≥ 44 × 44 px |
| 7 | Texto de controles sin cortar | `scrollWidth ≤ clientWidth + 1` y `scrollHeight ≤ clientHeight + 1` en botones y chips |
| 8 | Nada fuera de los márgenes | Todo descendiente visible de `main` cumple `0 ≤ left` y `right ≤ innerWidth`, salvo descendientes de `pre`, `[data-zoom-viewer]` y `.table-wrap` |
| 9 | Tipografía mínima | `font-size` calculado ≥ 16 px en enunciado y opciones y ≥ 15 px en botones de barra (multiplicado por el factor de fuente en F200) |
| 10 | Texto literal | `textContent` de enunciado y de cada opción = cadenas del fixture |
| 11 | Sin recortes prohibidos | Dentro del área, ningún elemento con `text-overflow: ellipsis` ni `-webkit-line-clamp` |
| 12 | Coherencia del ajuste | `complete` ⇒ no existe `[data-action="full"]` y el área no desborda. `stem-scroll` ⇒ visor con alto múltiplo de `line-height` (± 1), ≥ 5 líneas, botón visible. `area-scroll` ⇒ el área desborda y la fila "continúa" (o el botón de encabezado en `fit-wide`) es visible |

Recorridos por celda (los marcados † solo en M1, M4, L2, D1, H1 y Z400 para acotar el tiempo):

1. Práctica con `mediana`: sin selección → con selección → comprobada. En cada paso `assertLayout`; además el borde inferior de la barra no cambia (± 1 px).
2. Práctica con `enunciado-largo`, `opciones-largas`, `codigo`, `palabra-larga` y `multiple`: `assertLayout`; elegir una opción que requiera desplazarse; comprobar.
3. Vista completa: activar, elegir, comprobar, "Siguiente", salir. Selección conservada, cantidad de `input` sin cambios, foco de vuelta.
4. "Ver explicación" con `explicacion-pdf-larga` y `explicacion-ia-larga`: criterios de 9; rótulo de origen exacto dentro de la hoja; `Esc` devuelve el foco al botón; selección intacta.
5. † "Ver motivo" con `pendiente-larga`; "Ver fragmento" de texto y de imagen; navegador (ir a otra pregunta); filtros.
6. Examen (Messer, 10 preguntas): `assertLayout`; responder; abrir y cerrar navegador y vista completa esperando 2 s; verificar tiempo (criterio de 9); recargar y verificar que se restaura; "Finalizar" visible y dentro de la ventana en la primera y en la última pregunta; ausencia de las cadenas prohibidas.
7. † Revisión: `assertLayout`; "Ver explicación"; última pregunta muestra "Volver al resultado".
8. † PBQ `msr-pbq-a1`: criterios de 11.
9. † `axe-core` sin infracciones serias ni críticas en: práctica sin comprobar, comprobada, con hoja de explicación abierta, vista completa, examen, revisión y PBQ.
10. Solo `flow` (H3, Z300, Z400, F200): todo control de la barra y todo el texto se alcanzan con scroll de página; ningún elemento con `position: fixed` o `sticky` visible fuera de diálogos.

Además, en M4: girar a L2 con una opción elegida y una hoja abierta (`setViewportSize`) → la selección se conserva, el modo pasa a `fit-wide`, la hoja sigue dentro de la ventana.

### 15.4 Lo que no se puede automatizar con fidelidad (verificación manual, una vez)

- Barras reales de Safari iOS y Chrome Android (contracción y expansión, teclado, gesto de recarga): probar en un dispositivo real o en el simulador que el alto usado es el visible y que la barra de acciones no queda bajo la interfaz del navegador.
- Márgenes seguros: Chromium de escritorio no los emula. Automatizable a medias: el CSS usa una variable intermedia (`--safe-bottom: env(safe-area-inset-bottom)`, etc.) y el e2e la sobrescribe con 34 px abajo y 47 px a los lados para comprobar que nada queda dentro de esas franjas. La verificación en dispositivo con muesca es manual.
- Zoom real del navegador al 200 % y 400 % en un escritorio (la matriz lo aproxima por equivalencia de px CSS).
- Lector de pantalla: una pregunta en `stem-scroll` se lee completa; el veredicto se anuncia; el foco vuelve al cerrar una hoja.

### 15.5 Impacto en los 288 tests existentes

Ninguna función de corrección, selector, almacenamiento ni servidor cambia: `grading/`, `state/`, `storage/`, `shared/`, `server/`, `scripts/*.test.mjs` y `studyPlan.test.tsx` no deberían necesitar cambios. Se tocan solo los tests que dependen del DOM de la pantalla de pregunta:

| Archivo | Qué cambia |
|---|---|
| `src/features/practice/practice.test.tsx` | Las aserciones sobre la región "Explicación del PDF (en inglés)" y "Explicación generada por IA — no es del PDF" dentro del `article` tras comprobar pasan a: existe el botón de explicación con su origen → clic → la región está en el diálogo. Se agrega el caso negativo (sin región antes del clic) |
| `src/features/exam/exam.test.tsx` | Revisión: misma adaptación para la explicación y para "Ver fragmento del PDF" (puede estar en el encabezado o en "Más"). La lista de cadenas prohibidas en examen suma "Ver explicación", "Ver detalle", "Ver motivo" y "Ver análisis" |
| `src/ui/QuestionCard/QuestionCard.test.tsx` | Se adapta a la división cabecera / cuerpo; "Borrar respuesta" se busca en la franja; las prohibiciones del modo examen se mantienen sobre el marco completo |
| `src/features/app/app.test.tsx` | Solo si alguna aserción depende de `TopBar` o `BottomNav` dentro de una pantalla de pregunta |
| `scripts/e2e.mjs` | Explicación tras comprobar → abrir la hoja; "Tras recargar: Última vez" → buscar en la franja; el check "barra de acciones fija sobre la navegación inferior" se reemplaza por los de 15.3; PBQ A1 con 2 imágenes simultáneas → paginador; "Revisión muestra explicación rotulada" → abrir la hoja |
| `scripts/e2e-ai.mjs` | Sin cambios esperados (el plan de IA no cambia de estructura); correrlo igual |

Regla: ningún test existente se borra; se adapta conservando lo que verifica. El total de tests no baja.

### 15.6 Tests nuevos (Vitest)

| Tema | Casos mínimos |
|---|---|
| `resolveLayoutMode` | Las 21 filas de la matriz + bordes exactos (29,99 / 30; 19,99 / 20; 39,99 / 40 em) + `supportsDvh: false` |
| `decideFit` | Entra justo; falta 1 px con 5 líneas disponibles → `stem-scroll` con alto múltiplo de línea; 4 líneas disponibles → `area-scroll`; alturas en 0 → `complete` |
| Barra por estado | Práctica: sin selección (Comprobar `aria-disabled`), con selección, comprobada (Reintentar + Siguiente primario), última (Terminar), pendiente ("Ver lo que dice el PDF"). Examen: sin Comprobar, última con Finalizar. Revisión: última con "Volver al resultado". Extremos: Anterior `aria-disabled`. Orden del DOM de las regiones |
| Franja | Textos de la tabla de 7 por estado; `data-feedback`; región viva presente antes de comprobar |
| Explicación bajo demanda | PDF, IA y no validada: botón con origen; hoja con rótulo exacto; cerrar devuelve foco; radios con el mismo `checked`; `loading` y `error` dentro de la hoja |
| Detalle / motivo | Motivos literales completos; duplicados con enlaces; nota de extracción |
| Ver análisis | Aparece solo con análisis válido que contiene la pregunta; contenido dentro de `AiGenerated`; no llama a la API |
| Vista completa | `data-view`; mismos `input`; `Esc` y `L`; foco de vuelta y respaldo; persiste al pasar de pregunta |
| Examen | Abrir y cerrar vista completa y navegador con temporizadores falsos: `selected` igual y `remainingMs` sigue bajando; cadenas prohibidas ausentes |
| Texto literal | La muestra de 50 ids en `complete`, `stem-scroll` y `area-scroll` (estado forzado por prop de prueba) |
| `Dialog` | Contador de bloqueo con dos diálogos; respaldo de foco con origen desconectado; cierre al cambiar de pregunta |
| Atajos | `L`, `X`, `I`; bloqueados con diálogo abierto; activos en vista completa; `AvPág` llama al desplazamiento del área; desactivables los de una tecla |
| `axe-core` (jsdom) | Práctica sin comprobar, comprobada con hoja abierta, vista completa, examen, PBQ |

---

## 16. Fases de implementación

Cada fase termina con `npm run typecheck`, `npm run lint`, `npm test` y `npm run e2e` en verde, sin errores en consola. `npm run e2e:layout` DEBE pasar para las pantallas ya migradas.

### Fase L0 — Red de seguridad y base

Alcance: `layoutFixtures.ts`; `scripts/lib/e2e-utils.mjs` y `e2e-layout.mjs` con la matriz y `assertLayout` (al principio solo informa: sirve de línea de base); `Dialog` endurecido (9.1) y variante de lectura (9.2); `dvh` con respaldo en `AppShell`, `Sidebar`, `Dialog`, `ImageViewer`, `PdfFragmentModal`; reglas de la sección 12; token `--overlay-soft`.

Criterios:
- Los 288 tests siguen en verde sin cambios de aserciones.
- Tests nuevos de `Dialog`.
- En toda la matriz, todos los diálogos existentes (fragmento, filtros, navegador, atajos, confirmación) quedan dentro de la ventana con Cerrar visible.
- Sin scroll horizontal en Inicio, Práctica, Examen, Resultado, Repaso, PBQ y Ajustes en toda la matriz, incluido el fixture `palabra-larga`.

### Fase L1 — Marco y barra en Práctica

Alcance: `layoutMode`, `useLayoutMode`, `QuestionScreen`, `ActionBar`, integración con `AppShell` (sin `TopBar` ni `BottomNav` con menos de 768 px), encabezado compacto de práctica, columna derecha, toasts sobre la barra. La explicación todavía puede estar en línea dentro del área.

Criterios: verificaciones 1 a 9 de `assertLayout` en práctica con `corta` y `mediana` en toda la matriz; criterios de las secciones 5 y 8; ya no existen `div.reserve` ni la barra con `position: fixed`.

### Fase L2 — Franja de estado y contenido bajo demanda

Alcance: `StatusStrip`; hojas de explicación, detalle y motivo; división de `QuestionCard`; adaptación de los tests de 15.5.

Criterios: los de las secciones 7 y 9; recorridos 1, 4 y 5 de 15.3 en práctica.

### Fase L3 — Ajuste por medición y vista completa

Alcance: `fit.ts`, `useFitState`, visor acotado, `MoreRow`, vista completa, dos columnas de `fit-wide`, atajos de 13.1.

Criterios: los de la sección 6; verificaciones 10 a 12; recorridos 2 y 3 en toda la matriz.

### Fase L4 — Examen en curso y Revisión

Alcance: migrar `ExamRunning` y `ExamReview`; "Borrar respuesta" en la franja; navegador (sección 10); "Ver análisis de IA".

Criterios: recorridos 6 y 7; criterios de la sección 10; la restauración tras recargar y el cierre por tiempo siguen funcionando (checks existentes de `e2e.mjs`).

### Fase L5 — PBQ, visor y fragmento

Alcance: sección 11.

Criterios: los de la sección 11; recorrido 8; los checks existentes de zoom siguen en verde.

### Fase L6 — Cierre

Alcance: matriz completa con tema oscuro y márgenes seguros simulados; `axe`; modo `flow`; verificación manual de 15.4; actualizar "Ajustes al plan" de `PLAN.md` (sección 2 de este documento), `README.md` (`npm run e2e:layout`) y `ShortcutsDialog`.

Criterios: `npm run e2e:layout` sin fallos en las 21 ventanas; checklist de la sección 17 completo; cantidad total de tests ≥ 288 más los nuevos.

---

## 17. Checklist final

Estructura
- [ ] Práctica, examen en curso, revisión y detalle de PBQ usan el marco encabezado / área / franja / barra.
- [ ] En `fit` y `fit-wide` el documento no se desplaza en ninguna ventana de la matriz.
- [ ] La barra es una fila de grilla: no hay `position: fixed` ni espaciadores de reserva.
- [ ] Alto con `dvh` y respaldo `vh`; márgenes seguros superior, inferior y laterales aplicados.
- [ ] En `flow` no hay nada fijo ni pegajoso fuera de diálogos y todo se alcanza con scroll.

Botones
- [ ] Anterior, Comprobar / Reintentar, Siguiente / Terminar / Finalizar siempre visibles según el estado.
- [ ] Texto visible en todos los anchos; objetivos ≥ 44 × 44 px; sin superposiciones ni desbordes.
- [ ] Comprobar no mueve la barra.

Contenido
- [ ] Enunciado y opciones idénticos al banco en todos los estados y vistas.
- [ ] Ningún texto del PDF con puntos suspensivos, `line-clamp` ni corte por caracteres en pantallas de pregunta.
- [ ] Las opciones nunca se acotan.
- [ ] Toda vista acotada tiene indicador de texto, botón "Ver pregunta completa" y scroll propio.
- [ ] La vista completa permite elegir, comprobar, navegar y finalizar.
- [ ] Explicación, detalle, motivo y análisis solo bajo demanda; origen PDF / IA visible en el botón y dentro de la hoja.
- [ ] La insignia de estado de respuesta sigue visible (fuera del examen); las pendientes siguen sin corregirse.
- [ ] En examen no aparece ningún control ni texto de explicación, detalle, origen o acierto.

Modales
- [ ] `<dialog>` nativo; dentro de la ventana; Cerrar siempre visible; scroll interno.
- [ ] `Esc` cierra; el foco vuelve al origen o al respaldo; el fondo no se desplaza; contador para anidados.
- [ ] Abrir y cerrar no cambia respuestas, estado comprobado ni temporizador.
- [ ] Animación atenuada con `prefers-reduced-motion`.

Accesibilidad
- [ ] Orden de foco = orden visual; foco visible y nunca tapado ni recortado.
- [ ] Regiones desplazables operables con teclado; `RePág` / `AvPág` desplazan el área.
- [ ] Veredicto anunciado por región viva; atajos nuevos documentados y desactivables.
- [ ] `axe-core` sin infracciones serias ni críticas en los estados nuevos, en ambos temas.
- [ ] Zoom 200–400 % y fuente 200 %: sin pérdida de contenido ni de controles.

Pruebas
- [ ] `e2e-layout.mjs` cubre las 21 ventanas con los fixtures de 15.2.
- [ ] Tests existentes adaptados sin borrar ninguno; tests nuevos de 15.6.
- [ ] Verificación manual de 15.4 hecha y anotada.
- [ ] `PLAN.md` ("Ajustes al plan") y `README.md` actualizados.

---

## 18. Información faltante / delegada

Nada de esto se resolvió consultando los PDF. Cada punto dice qué hace la app mientras tanto. El tercer documento (libro de Professor Messer: 3 exámenes de 90 preguntas, PBQ interactivas, respuestas detalladas) todavía no está importado.

| # | Falta o duda | Efecto en este plan | Qué se pide a extracción |
|---|---|---|---|
| 1 | Longitudes reales de enunciados, opciones y explicaciones del tercer documento | Los umbrales son por medición y no dependen de esto, pero no se sabe qué proporción de preguntas caerá en cada estado por ventana | Tabla de percentiles (p50, p90, p99, máximo) de caracteres por enunciado, opción y explicación, por examen |
| 2 | Forma de las "respuestas detalladas": ¿texto de la correcta más un texto por opción incorrecta?, ¿idioma?, ¿`origin: "pdf"`? | Hoy las explicaciones de Messer son de IA; si pasan a ser del PDF cambian rótulos y botón ("Ver explicación del PDF"). La hoja ya soporta ambos | Confirmar `origin`, `language`, presencia de `perOption` y si reemplazan a las 45 generadas |
| 3 | Si las explicaciones traen URL o referencias a objetivos del examen | Se muestran como texto plano que parte en líneas; no se convierten en enlaces | Indicar si existen y en qué campo quedan; decisión del usuario sobre hacerlas clicables (requeriría una regla nueva y segura) |
| 4 | PBQ interactivas: tipos de ejercicio (emparejar, ordenar, completar tabla, ubicar en diagrama, otros), si son puntuables y cómo se corrigen (parcial o todo o nada) | Solo está fijado el marco (11.4). Falta diseñar cada tipo, su franja de estado y su vista de solución | Modelo de datos por tipo (`kind`, elementos, destinos, respuesta), cantidad por examen y reglas de corrección que figuren en el libro |
| 5 | Imágenes de las PBQ: resolución, si son página entera o recortes, y si hay texto alternativo o transcripción | El visor asume 1200 × 1800 por defecto y usa las dimensiones reales al cargar | Dimensiones, peso total, rutas, y transcripción por imagen |
| 6 | Imágenes o diagramas dentro de preguntas de opción (en enunciado u opciones) | No existe el tipo de bloque `image`; la regla de 6.6 queda especificada pero sin implementar ni probar | Confirmar si existen; de ser así, tipo de bloque, dimensiones y texto alternativo literal |
| 7 | Bloques de código o registro: máximo de líneas y de columnas; existencia de tablas | El plan soporta cualquier largo (scroll horizontal propio, vertical por el área). Una tabla necesitaría un tipo de bloque nuevo | Máximos por bloque y si hay contenido tabular que hoy caería en `code` o `text` |
| 8 | Cantidad máxima de opciones y preguntas de "elegir N" | Con opciones más allá de la `H`, las letras `I`, `L` o `X` chocarían con los atajos nuevos (ganan las letras de opción) | Máximo de opciones y lista de preguntas de selección múltiple |
| 9 | Escenarios compartidos por varias preguntas (un mismo texto o figura para un grupo) | No hay soporte: cada pregunta se trata como independiente | Confirmar si existen y cómo se identificarían |
| 10 | Identificadores del tercer documento y destino del extracto actual (`msr-a046`…`msr-a090`, `msr-pbq-a1`…`a5`) | Los e2e y varios tests usan `msr-a080`, `msr-a052` y `msr-pbq-a1`; si cambian o desaparecen hay que actualizar los ids de prueba | Esquema de ids y si el extracto se reemplaza o convive |
| 11 | Longitud de los nombres de sección (`topic`) nuevos | El título de lista parte en líneas o queda en "Ver detalle"; no afecta el diseño, sí el presupuesto del encabezado en escritorio | Lista de `topic` nuevos |
| 12 | Nuevos motivos de pendiente y notas de extracción | Se muestran completos en la hoja de detalle, sin límite | Ninguna obligatoria |
| 13 | Comportamiento real de las barras del navegador y de los márgenes seguros en los dispositivos del usuario | Cubierto por diseño (`dvh`, `env()`), verificable solo a mano (15.4) | No es de extracción: lo verifica quien implemente o el usuario en su teléfono |

---

## Ajustes al plan

Implementado sobre el banco `758483f7ae` (tres documentos: 1440 preguntas, hasta 7 opciones, 10 de selección múltiple, 36 bloques `code`). Desvíos y precisiones respecto de este documento (todo lo demás se implementó como está escrito):

1. **Hechos de la sección 0 actualizados.** El libro completo de Messer trae preguntas de hasta 7 opciones (A–G) con "Select THREE", viñetas como bloques `text` propios, 14 enunciados con bloques `code` (hasta 11 líneas y 78 columnas) y explicaciones del PDF con `perOption`. Nada de eso requirió umbrales nuevos: la decisión de ajuste es por medición. Las letras F y G eligen opción y tienen prioridad sobre los atajos `F` (Favorita) y `G` (navegador), como preveía la sección 13.1 para `I`, `L` y `X`.
2. **Columna derecha.** El `<article data-question-id>` envuelve encabezado, área y franja (contrato de 14.2 y tests existentes), así que la columna de 300 px abarca también la fila del encabezado, no solo área/franja/barra. La columna de la pregunta mide hasta 820 px con columna y 900 px sin ella (no 760): con 760 px una pregunta mediana no entraba completa a 1280 × 720.
3. **fit-wide.** La franja va dentro de la barra (fuera del `<article>`); el encabezado puede ocupar dos filas cuando el rótulo, la posición y "Ver completa" no entran en una (medido: ~100 px a 844 × 390 frente a los ≤ 52 px presupuestados); el área sigue sin desbordar la página en las 6 ventanas fit-wide de la matriz. Favorita, fragmento, detalle, análisis y atajos van en "Más" también en fit-wide.
4. **Encabezado en móvil.** A 360–430 px la fila B (rótulo + insignia, que nunca se truncan, + Marcar + "Más") parte en dos líneas: el encabezado mide ~150 px (presupuesto 112). Se priorizó no truncar el rótulo ni ocultar la insignia; el exceso lo absorbe el área (que pasa a `area-scroll` o `stem-scroll` con indicador).
5. **Pendientes.** Mientras no se reveló lo que dice el PDF, "Ver motivo" está en la franja (junto a la línea fija "Esta pregunta no se corrige…") y no se repite en el encabezado; después de revelar, la franja muestra el aviso ámbar y "Ver explicación del PDF (no validada)" y el encabezado vuelve a ofrecer "Ver motivo".
6. **Ayuda de selección múltiple.** "Elegí N respuestas (k de N)" vive solo en la franja (es la ayuda asociada a Comprobar); dentro del área queda la regla ("Puntúa solo si marcás exactamente las correctas") y el aviso "Ya elegiste N". Así el mismo texto no aparece dos veces.
7. **Vista completa.** Fila A del encabezado = la de la pantalla sin "Volver" ni filtros, precedida por "Salir de la vista completa"; fila B = rótulo + Marcar. El examen conserva Timer y "Finalizar" en la misma posición del árbol (el reloj no se desmonta: verificado en Vitest y en las 21 ventanas).
8. **Nombres accesibles y rótulos cortos (< 400 px).** Para cumplir WCAG 2.5.3 (axe `label-content-name-mismatch`) el `aria-label` empieza por el texto visible: "Ver completa: Ver pregunta completa", "Explicación (IA): Ver explicación de IA", y el botón de posición "1 / 6 · Pregunta 1 de 6. Abrir navegador de preguntas".
9. **Diálogos.** Las confirmaciones (`md`, rol `alertdialog`) no pasan a pantalla completa en móvil ni con poca altura: quedan centradas con `max-height` en `dvh`. El selector de rango del navegador (> 150 ítems) queda al principio del cuerpo, no en una subcabecera fija. La leyenda del navegador va en el pie fijo; con menos de 20em de alto el diálogo entero se desplaza (9.1) y la leyenda se alcanza desplazando. El foco inicial del navegador se da con `initialFocus` del diálogo (el `showModal()` nativo lo movía al botón Cerrar).
10. **Hoja de explicación.** "Siguiente" del pie dice "Terminar" en la última pregunta de práctica y "Volver al resultado" en la última de la revisión.
11. **Toasts.** En pantallas de pregunta se muestra solo el último (CSS) y se anclan con `--q-bottom-stack`.
12. **Revisión con contenido cambiado.** Se muestra como página normal (aviso + resultado guardado + Anterior/Siguiente), sin el marco, porque no hay pregunta que mostrar.
13. **PBQ.** El paginador del visor recorre enunciado y solución (libro completo) o solo la solución (extracto); el pie de foto dice qué parte es y avisa si la misma página contiene otra PBQ ("también contiene la PBQ B4: buscá la B3"). La lista de PBQ se agrupa por documento; el detalle no tiene controles de respuesta (11.4 sigue sin datos para PBQ interactivas: el libro completo solo trae imágenes).
14. **Objetivo SY0-701 (dato nuevo).** Metadato discreto en la fila B (≥ 768 px), en "Más" y en "Ver detalle"; enlace externo solo `https`, `target="_blank"`, `rel="noopener noreferrer"`. Nunca en el examen.
15. **Márgenes seguros.** Además de `env()`, el CSS usa variables intermedias `--safe-top/right/bottom/left` (15.4), que el e2e sobrescribe con 34 px abajo y 47 px a los lados.
16. **Corrección encontrada por la matriz.** Los elementos `sr-only` (posición absoluta) del cuerpo tomaban como bloque contenedor el documento y lo hacían desplazable aun con `overflow: hidden` (por script o al enfocar). El área y el visor acotado ahora son `position: relative`.
17. **e2e.** `scripts/e2e-layout.mjs` corre con `vite-node` para importar los fixtures TypeScript; los inyecta interceptando `core.*.json` y `explanations.*.json` (la carga no los rechaza). "Comprobar no mueve la barra" se verifica solo en `fit`/`fit-wide` (en `flow` la barra está al final del contenido por definición). El criterio "el cuerpo se desplaza" de 9 se exige con la explicación del PDF de 3000 + 4 × 600 caracteres; la de IA de 2000 entra sin desplazarse en ventanas grandes (T1).
18. **No verificado (15.4, manual):** barras reales de Safari iOS y Chrome Android, muesca real, zoom real del navegador (se aproximó por equivalencia de px CSS), lector de pantalla. Tampoco Firefox ni WebKit: solo Chromium headless.
19. **Resultado de la matriz (cierre, 13/11/2026).** `npm run e2e:layout` sobre 21 ventanas: la corrida `layout-final` dio 659/660 verificaciones; el único fallo (F200, "Finalizar" tapado por el contador "N respondidas") se corrigió después y la corrida siguiente (`layout-final2`) no registró ningún FAIL en las 657 verificaciones que alcanzó a ejecutar, pero **terminó antes de tiempo** con `browserContext.newPage: Target crashed` (Chromium headless, no una aserción). Por eso no hay una corrida completa en verde posterior a la última corrección: queda por repetir. Los fallos que la matriz fue encontrando y que ya están corregidos: contador del examen a 200 % de zoom, leyenda del navegador de preguntas a 400 %, y barra que se movía al pulsar "Comprobar" en zoom.
20. **Cuántas preguntas del banco real entran completas (`E2E_LAYOUT_BANK=1`, medido con la corrida de las 01:12, antes de las últimas correcciones de zoom/PBQ).** La estimación de la sección 3 era optimista para ventanas bajas:

    | Ventana | Entran completas | Enunciado acotado con scroll propio | Se desplaza el área |
    |---|---|---|---|
    | 1366 × 650 (D2) | 201 de 1440 (14,0 %) | 0 | 1239 |
    | 390 × 844 (M4) | 1066 de 1440 (74,0 %) | 166 | 208 |

    Por documento a 1366 × 650: Gorgotsias 170/1140, Messer extracto 25/45, Messer libro completo 6/255. A 390 × 844: 789/1140, 41/45 y 236/255. Las demás nunca se cortan: cuando no entran, el área de la pregunta se desplaza (o el enunciado tiene su propio scroll con el indicador "El enunciado continúa"), y los botones de acción siguen visibles. El criterio "la pregunta mediana entra completa a 1366 × 650" de la sección 5 se cumple con la pregunta sintética mediana, **no** con la mayoría de las reales (las del libro completo tienen enunciados y opciones largos). Si se quiere subir ese 14 %, las palancas son el alto del encabezado y los espaciados, no la tipografía.
21. **Títulos de PBQ del libro completo.** Varios títulos extraídos (`msf-pbq-b1…b4`, `c1…c5`) arrastran rótulos de la imagen o vienen cortados; el chip del detalle de PBQ se ajustó para no mostrarlos rotos. El dato del banco no se tocó (es texto extraído; no se reescribe).
22. **Estado del cierre.** El agente de implementación se detuvo por pedido del usuario antes de entregar su informe final; esta sección y la del README se completaron a mano a partir de los registros de las corridas. Verificado después de la detención: `tsc` sin errores, `npm run build` (con `check-dist`), 361 tests de Vitest en verde (26 archivos) y `verify_bank.py` con 0 diferencias. No se volvió a correr `e2e`, `e2e:ai` ni `e2e:layout` completos en esta etapa (`e2e:ai` dio 45/45 antes de la detención).
