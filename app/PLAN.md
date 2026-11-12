# PLAN.md — App de estudio CompTIA Security+ SY0-701

Plan estético y estructural para implementar la app. Está escrito para que quien implemente no tenga que tomar decisiones de diseño: donde hay una decisión, está tomada y justificada.

- Fuentes usadas para este plan: `docs/EXTRACTION_SUMMARY.md`, `data/import-report.json`, `data/verification-report.json` y una inspección de forma de `data/bank.json` (`bankVersion` `3efc5f1a3b`). **No se abrió ningún PDF.**
- Quien implemente **tampoco debe abrir los PDF**: todo el contenido sale de `data/`.
- Convención: "DEBE" = obligatorio para aceptar la fase; "PUEDE" = opcional.

## Índice

1. Principios y decisiones de diseño
2. Sistema visual
3. Pantallas, navegación y layouts
4. Componentes reutilizables
5. Flujos y máquinas de estado
6. Modelo de datos local
7. Estructura de carpetas, capas y reglas de corrección
8. Fases de implementación
9. Checklist final de aceptación
10. Información faltante / delegada al modelo de extracción

---

## 0. Hechos del banco que condicionan el diseño

Estos números son los reales del banco actual. La UI nunca los escribe a mano: los calcula del banco o los lee de `import-report.json`. Sirven acá para dimensionar y para los tests.

| Dato | Valor |
|---|---|
| Preguntas de opción | 1185 (Gorgotsias 1140, Messer 45) |
| Puntuables (`scorable: true`) | 1177 (1132 + 45) |
| `answerStatus` presentes | `pdf` 1177, `pending` 8, `ai_proposed` 0 |
| Pendientes de revisión | 8, todas de Gorgotsias; tienen `correct` cargado pero **no es confiable** |
| Selección múltiple | 1 (`msr-a080`, 5 opciones, correctas B y C) |
| Opciones por pregunta | 4 en 1184, 5 en 1 |
| Bloques de enunciado | 1 bloque en 1173 preguntas; hasta 7; 12 bloques `code` (solo Messer) |
| Longitudes máximas | bloque de enunciado 473 car., opción 132 car., explicación 698 car. |
| `explanation.origin` | `pdf` 1140 (inglés, con `perOption`: 3 entradas en 1138, 2 en 2), `ai` 45 (español, `perOption` vacío) |
| `answerSource.kind` | `explanation` 1140, `quick_key` 45 |
| Grupos de duplicados | 534 grupos; uniendo duplicados quedan **586 unidades** (541 Gorgotsias, 45 Messer); ninguna cruza documentos |
| Unidades con al menos una copia puntuable | **583** (538 Gorgotsias + 45 Messer). 3 unidades son enteramente pendientes |
| Grupo con claves distintas | `gor-cap4-0414` (B, puntuable) y `gor-sim6-0514` (A, pendiente) |
| Grupos duplicados con `contentHash` distinto | 6 (el anterior y 5 con diferencias tipográficas en el enunciado). **No deduplicar por hash, sino por `duplicates`** |
| `similar` | vacío en las 1185 |
| PBQ | 5 soluciones (`msr-pbq-a1`…`a5`), 7 imágenes de página en total |
| Imágenes de página Messer | 25 JPG de 660 × 990 px, 1,9 MB en total |
| Peso de `bank.json` | 5,3 MB: `fragment` 2,2 MB, `explanation` 1,1 MB, `options` 0,4 MB, `stem` 0,4 MB, resto 0,3 MB |

Secciones (`section` → `topic` → cantidad):

| section | topic (literal) | n |
|---|---|---|
| cap1 | Chapter 1 · General Security Concepts | 110 |
| cap2 | Chapter 2 · Threats, Vulnerabilities, and Mitigations | 110 |
| cap3 | Chapter 3 · Implementation | 90 |
| cap4 | Chapter 4 · Security Operations | 150 |
| cap5 | Chapter 5 · Security Program Management and Oversight | 80 |
| sim1…sim6 | Exam Simulator #1 … #6 | 100 c/u |
| pe-a | Practice Exam A (Messer, A46–A90) | 45 |

---

## 1. Principios y decisiones de diseño

1. **El texto del PDF es intocable.** Enunciados, opciones y explicaciones del PDF se muestran tal cual están en el banco: sin traducir, sin recortar, sin corregir tipografía, sin `text-transform`, sin truncar con "…". El orden de opciones es siempre el del banco. Por qué: la app es una herramienta de estudio fiel a dos libros; cualquier "mejora" introduce errores que el usuario no puede detectar.
2. **El origen de cada dato siempre está a la vista.** Toda respuesta lleva su insignia de estado y toda explicación su etiqueta de origen. Lo generado por IA nunca comparte estilo visual con lo que viene del PDF. Por qué: hay 45 explicaciones generadas y 8 preguntas contradictorias; el usuario tiene que poder calibrar cuánto confiar.
3. **Los conflictos se muestran, no se resuelven.** Una pregunta pendiente nunca se corrige como acierto o error ni entra en una nota. La letra que trae el banco se muestra como "letra que indica el PDF", no como respuesta correcta.
4. **Solo números reales.** Ningún contador, porcentaje, racha o gráfico que no salga del banco o del progreso guardado. Si no hay datos, hay un estado vacío con una acción útil. Ningún botón sin función.
5. **Una tarea por pantalla.** En práctica y examen la pregunta es lo único protagonista; la navegación, los filtros y el estado se retiran a la periferia. En examen se oculta la navegación de la app (modo foco).
6. **Calma visual.** Superficies neutras, un solo acento (violeta) reservado para la acción principal y la selección. Verde, rojo y ámbar se usan solo con significado (correcto, incorrecto, advertencia) y siempre acompañados de icono y texto.
7. **Teclado primero.** Una sesión entera de práctica o examen se puede hacer sin mouse. El foco siempre es visible.
8. **Arquitectura chica.** Sin backend, sin librería de UI, sin librería de estilos. Lógica de corrección en funciones puras con tests; la UI no decide qué es correcto.
9. **La app arranca rápido.** El banco se reparte en archivos y los 2,2 MB de fragmentos solo se bajan cuando se abre un fragmento.

Decisiones técnicas cerradas:

| Tema | Decisión | Por qué |
|---|---|---|
| Build | Vite + React 18 + TypeScript `strict` | Pedido |
| Rutas | `react-router-dom` con `HashRouter` | Funciona en hosting estático y con `vite preview` sin configurar reescrituras |
| Estado | `zustand` (sin su middleware `persist`; persistencia propia en `src/storage`) | Store chico, sin boilerplate; la persistencia propia permite versionar y migrar |
| Estilos | CSS Modules + custom properties en `src/styles/tokens.css` | Tokens explícitos, sin dependencia de runtime, tema claro/oscuro con un atributo |
| Iconos | `lucide-react` (importación por icono) | Trazo consistente, tree-shaking |
| Fuentes | `@fontsource-variable/figtree` y `@fontsource-variable/jetbrains-mono` (se empaquetan en el build; no hay pedidos a red externa) | Sin dependencia de CDN; fallback a fuentes del sistema |
| Tests | Vitest + Testing Library; `axe-core` en tests de componentes | Corrección y a11y verificables |
| Datos | Script Node `scripts/prepare-bank.mjs` que reparte `data/bank.json` en `public/bank/` | Carga eficiente sin tocar el contenido |

Nombre de trabajo de la app: **"Sec+ Práctica"**. Marca propia: un monograma simple (cuadrado redondeado violeta con un tilde) y el nombre en texto. No usar logos, nombres comerciales ni capturas de CompTIA, Udemy, ExamsDigest ni Professor Messer como marca; los documentos se nombran por su título tal como figura en `bank.documents[].title`.

---

## 2. Sistema visual

### 2.1 Color

Tokens semánticos. Los componentes usan solo tokens, nunca hex. Tema por atributo `data-theme="light|dark"` en `<html>`; el valor inicial sale de la preferencia guardada o, si es "sistema", de `prefers-color-scheme`. Para evitar el parpadeo, un script en línea en `index.html` fija `data-theme` antes del primer render.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | `#F6F5FA` | `#121117` | Fondo de página |
| `--surface` | `#FFFFFF` | `#1B1A22` | Tarjetas, barra lateral, modales |
| `--surface-2` | `#EFEDF5` | `#25232E` | Hover de filas, bloques de código, chips |
| `--border` | `#DCD9E6` | `#35323F` | Separadores y bordes decorativos |
| `--border-strong` | `#85819A` | `#7F7B92` | Borde de controles (opciones, inputs, botones secundarios) |
| `--text` | `#1B1A23` | `#ECEAF3` | Texto principal |
| `--text-muted` | `#565366` | `#B5B1C4` | Texto secundario |
| `--text-subtle` | `#6B687C` | `#9A96AB` | Metadatos, ayudas |
| `--accent` | `#6A35D9` | `#7A4CF0` | Fondo de botón primario, selección, progreso |
| `--accent-hover` | `#5727BD` | `#6B3DE0` | Hover y activo del primario (en ambos temas oscurece) |
| `--on-accent` | `#FFFFFF` | `#FFFFFF` | Texto sobre `--accent` |
| `--accent-soft` | `#EEE8FC` | `#2A2147` | Fondo de opción seleccionada, ítem de navegación activo |
| `--accent-text` | `#5224B3` | `#BBA4FF` | Enlaces, texto e iconos violetas |
| `--focus` | `#6A35D9` | `#BBA4FF` | Anillo de foco |
| `--success` | `#126B40` | `#63D39B` | Texto e icono de correcto |
| `--success-soft` | `#E4F3EA` | `#11301F` | Fondo de correcto |
| `--success-border` | `#1E8A55` | `#3BA872` | Borde de correcto |
| `--danger` | `#B42318` | `#FF8F85` | Texto e icono de incorrecto y de error |
| `--danger-soft` | `#FCEAE8` | `#3B1614` | Fondo de incorrecto |
| `--danger-border` | `#D0352A` | `#E0574B` | Borde de incorrecto |
| `--warning` | `#7A4F00` | `#F0C04A` | Pendiente de revisión, propuesta por IA |
| `--warning-soft` | `#FFF3D1` | `#33270A` | Fondo de advertencia |
| `--warning-border` | `#A86F00` | `#C4962C` | Borde de advertencia |
| `--info` | `#1A57A0` | `#82B6F7` | Información neutra, "Respuesta del PDF" |
| `--info-soft` | `#E6EFFB` | `#12263F` | Fondo informativo |
| `--info-border` | `#2F74C7` | `#4B8FDF` | Borde informativo |
| `--overlay` | `rgba(18,17,23,.55)` | `rgba(0,0,0,.65)` | Fondo de modal |

Contrastes calculados (fórmula WCAG 2.x) con estos valores exactos:

| Par (texto sobre fondo) | Claro | Oscuro | Mínimo exigido |
|---|---|---|---|
| `--text` sobre `--bg` / `--surface` / `--surface-2` | 15,9 / 17,2 / 14,9 | 15,8 / 14,5 / 13,0 | 4,5 |
| `--text-muted` sobre `--bg` / `--surface` / `--surface-2` | 6,9 / 7,4 / 6,4 | 9,0 / 8,3 / 7,4 | 4,5 |
| `--text-subtle` sobre `--bg` / `--surface` / `--surface-2` | 5,0 / 5,4 / 4,7 | 6,6 / 6,0 / 5,4 | 4,5 |
| `--on-accent` sobre `--accent` / `--accent-hover` | 6,7 / 8,6 | 5,1 / 6,2 | 4,5 |
| `--accent-text` sobre `--surface` / `--bg` / `--accent-soft` | 9,3 / 8,6 / 7,8 | 8,1 / 8,8 / 7,0 | 4,5 |
| `--text` sobre `--accent-soft` | 14,4 | 12,5 | 4,5 |
| `--success` sobre `--surface` / `--success-soft` | 6,6 / 5,7 | 9,3 / 7,7 | 4,5 |
| `--danger` sobre `--surface` / `--danger-soft` | 6,6 / 5,7 | 7,8 / 7,3 | 4,5 |
| `--warning` sobre `--surface` / `--warning-soft` | 7,1 / 6,5 | 10,1 / 8,6 | 4,5 |
| `--info` sobre `--surface` / `--info-soft` | 7,2 / 6,2 | 8,2 / 7,3 | 4,5 |
| `--text` sobre fondos `-soft` de estado | ≥ 14,8 | ≥ 12,0 | 4,5 |
| `--border-strong` sobre `--surface` / `--bg` / `--surface-2` | 3,8 / 3,5 / 3,2 | 4,2 / 4,6 / 3,8 | 3,0 (componente UI) |
| Bordes de estado sobre su fondo `-soft` | ≥ 3,8 | ≥ 4,3 | 3,0 |
| `--focus` sobre `--surface` / `--bg` / `--surface-2` | 6,7 / 6,2 / 5,8 | 8,1 / 8,8 / 7,3 | 3,0 |
| `--accent` como gráfico sobre `--surface` / `--bg` | 6,7 / 6,2 | 3,4 / 3,7 | 3,0 |

Reglas derivadas:

- `--border` (1,4:1) es decorativo. Todo control interactivo usa `--border-strong` o un borde de estado.
- En oscuro `--accent` no se usa para texto (3,4:1): el texto violeta es `--accent-text`.
- El botón primario en oscuro oscurece en hover (`#6B3DE0`); no aclarar, porque el blanco sobre un violeta más claro baja de 4,5.
- Texto sobre fondos `-soft`: el cuerpo va en `--text`; solo el rótulo y el icono van en el color de estado.

### 2.2 Tipografía

```css
--font-sans: "Figtree Variable", "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif;
--font-mono: "JetBrains Mono Variable", "Cascadia Mono", Consolas, "SF Mono", Menlo, "Liberation Mono", monospace;
```

Las dos familias se instalan por npm y se importan en `main.tsx`; quedan dentro del bundle. Si no cargan, el fallback del sistema es aceptable y no rompe el layout. `font-display: swap`.

Escala (rem sobre 16 px; la app respeta el zoom y el tamaño de fuente del navegador, nada en px fijos para texto):

| Token | Tamaño / interlineado | Peso | Uso |
|---|---|---|---|
| `--fs-display` | 2,25rem / 1,15 | 700 | Nota final del examen |
| `--fs-h1` | 1,75rem / 1,2 | 700 | Título de página |
| `--fs-h2` | 1,375rem / 1,3 | 650 | Título de sección |
| `--fs-h3` | 1,125rem / 1,35 | 650 | Título de tarjeta |
| `--fs-stem` | 1,125rem / 1,6 (móvil 1,0625rem) | 450 | Enunciado |
| `--fs-body` | 1rem / 1,55 | 400 | Opciones, explicación, cuerpo |
| `--fs-sm` | 0,875rem / 1,45 | 400–600 | Metadatos, insignias, ayudas |
| `--fs-xs` | 0,75rem / 1,35 | 600 | Rótulos en versalitas falsas: **no usar mayúsculas forzadas sobre texto del PDF** |
| `--fs-code` | 0,875rem / 1,55 | 400 | Bloques `code` |

- Ancho de lectura del enunciado y explicaciones: máximo 72ch.
- Números que cambian (temporizador, contadores, "12 / 45") con `font-variant-numeric: tabular-nums`. El temporizador usa `--font-mono`.
- Texto del PDF: `overflow-wrap: anywhere` para que una cadena larga no desborde; nunca `text-overflow: ellipsis`.

### 2.3 Espaciado, radios, sombras

```css
/* base 4 px */
--sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px; --sp-5: 20px;
--sp-6: 24px; --sp-8: 32px; --sp-10: 40px; --sp-12: 48px; --sp-16: 64px;

--r-sm: 6px;   /* chips, insignias, inputs chicos */
--r-md: 10px;  /* botones, opciones, inputs */
--r-lg: 14px;  /* tarjetas */
--r-xl: 20px;  /* modales, tarjeta de pregunta */
--r-pill: 999px;

--shadow-1: 0 1px 2px rgba(27,26,35,.06), 0 1px 1px rgba(27,26,35,.04);   /* tarjetas */
--shadow-2: 0 4px 12px rgba(27,26,35,.08), 0 1px 3px rgba(27,26,35,.06);  /* hover de tarjeta clicable, popovers */
--shadow-3: 0 16px 40px rgba(27,26,35,.18);                               /* modales */
```

- En oscuro las sombras casi no se ven: las tarjetas se distinguen por `--surface` sobre `--bg` más borde `--border`. Mantener `--shadow-3` con `rgba(0,0,0,.5)` para modales.
- Padding de tarjeta: 24 px escritorio, 16 px móvil. Tarjeta de pregunta: 32 px escritorio, 20 px móvil.
- Separación vertical entre secciones de página: 32 px escritorio, 24 px móvil. Entre opciones: 10 px.
- Objetivo táctil mínimo 44 × 44 px en todo control. La fila de opción entera es clicable (mínimo 52 px de alto).

### 2.4 Iconografía

`lucide-react`, trazo 1,75, tamaños 16 (en línea con texto `sm`), 20 (botones, navegación), 24 (estados vacíos usan 40). Los iconos decorativos llevan `aria-hidden="true"`; un botón de solo icono lleva `aria-label` y `title`.

| Significado | Icono lucide |
|---|---|
| Inicio / Práctica / Examen / Repaso / PBQ / Ajustes | `LayoutDashboard` / `BookOpenCheck` / `Timer` / `RotateCcw` / `Network` / `Settings` |
| Correcto / Incorrecto / Omitida | `CircleCheck` / `CircleX` / `CircleDashed` |
| Respuesta del PDF | `FileCheck2` |
| Propuesta por IA | `Sparkles` |
| Pendiente de revisión | `TriangleAlert` |
| Explicación del PDF / de IA | `FileText` / `Sparkles` |
| Favorita (off / on) | `Star` (contorno / relleno) |
| Marcar para repasar (off / on) | `Flag` (contorno / relleno) |
| Ver fragmento | `FileSearch` |
| Zoom + / − / restablecer | `ZoomIn` / `ZoomOut` / `Maximize` |
| Tema claro / oscuro / sistema | `Sun` / `Moon` / `Monitor` |
| Duplicado | `Copy` |

El estado activo de favorita y marcada no depende solo del relleno: cambia el `aria-pressed` y el texto del tooltip ("Quitar de favoritas").

### 2.5 Movimiento

```css
--dur-1: 120ms;  /* hover, press, cambio de color */
--dur-2: 200ms;  /* aparición de feedback, chips, acordeones */
--dur-3: 280ms;  /* modales, cambio de pregunta */
--ease-out: cubic-bezier(.2, .8, .2, 1);
--ease-in-out: cubic-bezier(.4, 0, .2, 1);
```

| Interacción | Animación |
|---|---|
| Hover de opción y tarjeta clicable | Cambio de fondo y borde, `--dur-1` |
| Press de botón | `transform: scale(.98)`, `--dur-1` |
| Seleccionar opción | El chip de letra se rellena de violeta, `--dur-1` |
| Comprobar | El panel de feedback aparece con opacidad 0→1 y `translateY(6px→0)`, `--dur-2`; los iconos de estado de cada opción aparecen con opacidad |
| Cambio de pregunta | Opacidad 0→1 de la tarjeta, `--dur-2`. Sin deslizamientos laterales |
| Modal | Overlay opacidad; diálogo opacidad + `scale(.98→1)`, `--dur-3` |
| Anillo y barra de progreso | Transición del valor, `--dur-3`; solo al cambiar, no al montar la página |
| Skeleton | Pulso de opacidad .6↔1 cada 1,4 s |

Con `prefers-reduced-motion: reduce`: todas las duraciones pasan a 0,01 ms, se eliminan transformaciones y el pulso del skeleton (queda estático), y el scroll programático usa `behavior: "auto"`. No hay animaciones de celebración (confeti, etc.) en ningún caso. Nada parpadea; el temporizador no late cuando queda poco tiempo.

### 2.6 Foco

```css
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; border-radius: inherit; }
```

Nunca `outline: none` sin reemplazo. En la fila de opción, el foco del input oculto se dibuja sobre toda la fila con `:has(input:focus-visible)`.

---

## 3. Pantallas, navegación y layouts

### 3.1 Rutas (`HashRouter`)

| Ruta | Pantalla | Notas |
|---|---|---|
| `/` | Dashboard | |
| `/practica` | Práctica: selección de alcance | Tarjetas de sección y filtros; arranca una sesión |
| `/practica/:questionId` | Práctica: una pregunta | Filtros en query string (`?doc=&sec=&estado=`), así un enlace reproduce la lista |
| `/examen` | Examen: configuración | Si hay examen en curso, ofrece reanudar o descartar |
| `/examen/en-curso` | Examen en curso | Modo foco. Sin examen activo redirige a `/examen` |
| `/examen/resultado/:attemptId` | Resultado | |
| `/examen/resultado/:attemptId/revision/:n` | Revisión pregunta por pregunta | `n` = posición 1…N |
| `/repaso` | Repaso | Pestañas en query: `?tab=falladas|marcadas|favoritas|historial` |
| `/pbq` | Referencia PBQ: lista | |
| `/pbq/:pbqId` | Referencia PBQ: detalle | |
| `/ajustes` | Ajustes e importación | Anclas `#apariencia`, `#importacion`, `#datos` |
| `*` | No encontrada | `EmptyState` con enlace al inicio |

Navegación principal (6 destinos, mismo orden en barra lateral y navegación inferior): Inicio, Práctica, Examen, Repaso, PBQ, Ajustes. En móvil, la barra inferior muestra los 5 primeros y Ajustes va en el encabezado superior (icono de engranaje).

Cada pantalla fija `document.title` ("Práctica · Sec+ Práctica") y, al cambiar de ruta, mueve el foco al `<h1>` de la página (`tabindex="-1"`). Hay un enlace "Saltar al contenido" como primer elemento enfocable.

### 3.2 Breakpoints y layout

| Rango | Nombre | Shell |
|---|---|---|
| < 768 px | móvil | Encabezado superior de 56 px (marca, título, tema, ajustes) + navegación inferior fija de 64 px con `padding-bottom: env(safe-area-inset-bottom)`. Contenido con margen lateral de 16 px |
| 768–1099 px | tablet | Barra lateral angosta de 72 px (solo iconos con tooltip y `aria-label`). Margen de contenido 24 px |
| ≥ 1100 px | escritorio | Barra lateral de 264 px con texto. Contenido centrado, ancho máximo 1120 px, margen 32 px |
| ≥ 1280 px | escritorio ancho | En práctica, examen y revisión aparece una columna derecha de 300 px (navegador de preguntas y datos de sesión) |

- Columna de la pregunta: ancho máximo 760 px.
- Por debajo de 1280 px el navegador de preguntas se abre como panel deslizable (botón "12 / 45" en el encabezado de la pregunta).
- En móvil, la barra de acciones de la pregunta (Anterior, Comprobar, Siguiente) queda fija sobre la navegación inferior; el contenido reserva ese alto para que nada quede tapado.
- En examen en curso no hay barra lateral ni navegación inferior en ningún tamaño.
- Ninguna pantalla tiene scroll horizontal de página a 320 px de ancho. Los bloques de código y la imagen ampliada hacen scroll dentro de su contenedor.

### 3.3 Wireframes

Leyenda: `[Botón]`, `(•)` radio, `[x]` checkbox, `{insignia}`, `▸` desplegable.

#### Dashboard (`/`) — escritorio

```
┌ Sidebar 264 ─┬──────────────────────────────────────────────────────────────┐
│ ▣ Sec+       │ Inicio                                                       │
│   Práctica   │                                                              │
│              │ ┌ Continuar estudiando ────────────────────────────────────┐ │
│ ▸ Inicio     │ │ Chapter 2 · Threats, Vulnerabilities, and Mitigations    │ │
│   Práctica   │ │ Pregunta 37 de 110 · última vez hace 2 días              │ │
│   Examen     │ │                                    [Continuar práctica]  │ │
│   Repaso     │ └──────────────────────────────────────────────────────────┘ │
│   PBQ        │                                                              │
│              │ Tu progreso                                                  │
│              │ ┌ (anillo) ───┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│              │ │  214        │ │ Acertadas│ │ Falladas │ │ Marcadas │      │
│              │ │ de 1177     │ │   171    │ │    43    │ │    12    │      │
│              │ │ respondidas │ │          │ │ [Repasar]│ │ [Repasar]│      │
│              │ └─────────────┘ └──────────┘ └──────────┘ └──────────┘      │
│              │                                                              │
│              │ Documentos                                                   │
│ ──────────── │ ┌ Gorgotsias ───────────────┐ ┌ Messer ───────────────────┐ │
│   Ajustes    │ │ <título del documento>    │ │ <título del documento>    │ │
│ ☀ Tema       │ │ 1140 preguntas · 1620 pág.│ │ 45 preguntas · 25 pág.    │ │
│              │ │ 5 capítulos · 6 simulacros│ │ A46–A90 · 5 soluciones PBQ│ │
│              │ │ ▓▓▓░░░░░░ 190 de 1132     │ │ ▓▓▓▓▓░░░ 24 de 45         │ │
│              │ │ {8 pendientes de revisión}│ │ {explicaciones de IA}     │ │
│              │ │ [Practicar] [Examen]      │ │ [Practicar] [Examen] [PBQ]│ │
│              │ └───────────────────────────┘ └───────────────────────────┘ │
│              │                                                              │
│              │ Resumen de importación                    [Ver detalle]      │
│              │ ┌──────────────────────────┬────────────┬────────┬────────┐ │
│              │ │                          │ Gorgotsias │ Messer │ Total  │ │
│              │ │ Encontradas en el PDF    │    1140    │   45   │  1185  │ │
│              │ │ Listas para practicar    │    1132    │   45   │  1177  │ │
│              │ │ Respuesta del PDF        │    1132    │   45   │  1177  │ │
│              │ │ Propuestas por IA        │      0     │    0   │     0  │ │
│              │ │ Con contradicciones      │      8     │    0   │     8  │ │
│              │ └──────────────────────────┴────────────┴────────┴────────┘ │
│              │ 534 grupos de preguntas repetidas · 586 preguntas distintas  │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

Reglas del Dashboard:

- "Continuar estudiando" tiene tres variantes, por prioridad: (1) examen en curso → "Tenés un examen en curso: 12 de 45 respondidas" + `[Reanudar examen]`; (2) última sesión de práctica → como en el wireframe; (3) sin actividad → "Todavía no empezaste" + `[Empezar a practicar]`.
- "Tu progreso" cuenta sobre preguntas puntuables. Sin actividad, las cuatro tarjetas se reemplazan por una sola línea: "Todavía no hay progreso. Los números aparecen cuando respondas tu primera pregunta." No se muestran ceros decorativos ni gráficos vacíos.
- "Listas para practicar" = `scorable: true`. Debajo de la tabla, texto fijo: "Las preguntas con contradicciones se pueden leer en Práctica, pero no se corrigen ni cuentan para la nota."
- La fila "Propuestas por IA" se muestra aunque sea 0.
- La tabla es una `<table>` real con `<caption>` y encabezados `scope`. En móvil se mantiene como tabla (3 columnas numéricas angostas caben en 320 px).
- Móvil: todo en una columna, en el orden del wireframe; las cuatro tarjetas de progreso pasan a grilla de 2 × 2.

#### Práctica: selección (`/practica`)

```
Práctica
Elegí qué practicar. Las preguntas se muestran en el orden del PDF.

FilterBar:  Documento (Todos ▾)   Estado (Todas ▾)   [x] Solo favoritas

Gorgotsias — Capítulos
┌ Chapter 1 · General Security Concepts ──────┐ ┌ Chapter 2 · Threats, … ───┐
│ 110 preguntas · 3 pendientes de revisión    │ │ 110 preguntas             │
│ ▓▓▓▓░░░░ 41 respondidas · 33 acertadas      │ │ Sin empezar               │
│                               [Practicar]   │ │              [Practicar]  │
└─────────────────────────────────────────────┘ └───────────────────────────┘
… (cap3, cap4, cap5)

Gorgotsias — Simuladores
… (Exam Simulator #1 … #6)

Messer
… (Practice Exam A · 45 preguntas · 1 de selección múltiple)

                                  [Practicar las 1185 que coinciden con el filtro]
```

- Cada tarjeta abre `/practica/:id` en la primera pregunta sin responder de esa sección (o la primera, si todas están respondidas), con `?sec=<section>`.
- Los contadores de cada tarjeta respetan los filtros activos. Si un filtro deja una sección en 0, la tarjeta se muestra atenuada con "Ninguna coincide con el filtro" y el botón deshabilitado.

#### Práctica: una pregunta (`/practica/:questionId`) — escritorio ancho

```
┌ Sidebar ┬───────────────────────────────────────────────┬ Panel 300 ───────┐
│         │ ← Práctica   Chapter 1 · General Security …   │ Esta lista       │
│         │ FilterBar: Gorgotsias ▾ · Chapter 1 ▾ · Todas ▾│ 110 preguntas    │
│         │                                               │ ▓▓▓░░ 41 resp.   │
│         │ ┌ QuestionCard ─────────────────────────────┐ │                  │
│         │ │ Question 1 · pág. 11        12 / 110  ☆ ⚑ │ │ Navegador        │
│         │ │ {Respuesta del PDF}                       │ │ ┌──┬──┬──┬──┬──┐ │
│         │ │                                           │ │ │1✓│2✓│3✗│4 │5 │ │
│         │ │ A client disputes having signed a digital │ │ │6 │7 │8⚑│9 │10│ │
│         │ │ contract. The service provider needs to … │ │ └──┴──┴──┴──┴──┘ │
│         │ │                                           │ │ ✓ acertada       │
│         │ │ ( ) A  Authentication                     │ │ ✗ fallada        │
│         │ │ ( ) B  Confidentiality                    │ │ ⚑ marcada        │
│         │ │ (•) C  Non-repudiation                    │ │ ! pendiente rev. │
│         │ │ ( ) D  Access Control                     │ │                  │
│         │ │                                           │ │ Atajos  [?]      │
│         │ │ [Ver fragmento del PDF]                   │ │                  │
│         │ └───────────────────────────────────────────┘ │                  │
│         │ [← Anterior]        [Comprobar]   [Siguiente →]│                  │
└─────────┴───────────────────────────────────────────────┴──────────────────┘
```

Después de "Comprobar" (misma pantalla, la tarjeta crece hacia abajo):

```
│ │ ( ) A  Authentication                                         │
│ │ (•) B  Confidentiality          ✗ Tu respuesta · Incorrecta   │  borde rojo sólido
│ │ ( ) C  Non-repudiation          ✓ Respuesta correcta          │  borde verde sólido
│ │ ( ) D  Access Control                                         │
│ │                                                               │
│ │ ┌ ✗ Incorrecto ─────────────────────────────────────────────┐ │
│ │ │ Elegiste B. La respuesta correcta es C.                   │ │
│ │ └───────────────────────────────────────────────────────────┘ │
│ │ ┌ ExplanationPanel ─────────────────────────────────────────┐ │
│ │ │ {Explicación del PDF (en inglés)}   Gorgotsias · pág. 51  │ │
│ │ │ Non-repudiation. Non-repudiation ensures that a party …   │ │
│ │ │                                                           │ │
│ │ │ Por qué las otras opciones son incorrectas                │ │
│ │ │  A  Option A is incorrect. Authentication confirms …      │ │
│ │ │  B  Option B is incorrect. Confidentiality ensures …  ← tu elección │
│ │ │  D  Option D is incorrect. Access Control determines …    │ │
│ │ └───────────────────────────────────────────────────────────┘ │
│ │ [Ver fragmento del PDF]   Copy También aparece en: Exam Simulator #1 · Question 92 │
│ └───────────────────────────────────────────────────────────────┘
│ [← Anterior]        [Reintentar]            [Siguiente →]
```

Variante "Pendiente de revisión" (por ejemplo `gor-cap1-0023`):

```
│ │ Question 23 · pág. 19                           23 / 110  ☆ ⚑ │
│ │ ┌ ⚠ Pendiente de revisión ──────────────────────────────────┐ │
│ │ │ Esta pregunta no se corrige ni cuenta para la nota.       │ │
│ │ │ Motivo: Contradicción en el PDF: la explicación que       │ │
│ │ │ figura con este número (pág. 75) indica la letra C con …  │ │
│ │ └───────────────────────────────────────────────────────────┘ │
│ │ <enunciado y opciones, seleccionables>                        │
│ │ [Ver lo que dice el PDF]                                      │
```

Al pulsar "Ver lo que dice el PDF": ninguna opción se pinta de verde ni de rojo. Aparece un panel de advertencia: "El PDF indica la letra C, pero la explicación asociada parece pertenecer a otra pregunta. No está validada." y debajo la explicación del PDF dentro de un `ExplanationPanel` en variante `unreliable` (borde ámbar discontinuo, rótulo "Explicación del PDF — figura con este número, pero no corresponde a esta pregunta"). El `perOption` se muestra dentro del mismo panel no confiable, sin asociarlo visualmente a las filas de opción.

Móvil (misma pantalla):

```
┌──────────────────────────────┐
│ ← Chapter 1 · General …   ⚙  │  encabezado 56
│ Filtros (2) ▾       12 / 110 │  abre hoja inferior / navegador
├──────────────────────────────┤
│ Question 1 · pág. 11    ☆ ⚑  │
│ {Respuesta del PDF}          │
│ A client disputes having …   │
│ ┌──────────────────────────┐ │
│ │ A  Authentication        │ │  filas de 52 px mínimo
│ └──────────────────────────┘ │
│ …                            │
│ [Ver fragmento del PDF]      │
├──────────────────────────────┤
│ [←]    [ Comprobar ]    [→]  │  barra de acciones fija
├──────────────────────────────┤
│ Inicio Práct. Examen Rep. PBQ│  navegación inferior 64
└──────────────────────────────┘
```

#### Examen: configuración (`/examen`)

```
Examen
Simulá un examen. Las respuestas se muestran recién al finalizar.

┌ Origen ───────────────────────────────────────────────────────────┐
│ (•) Ambos documentos    583 preguntas distintas disponibles       │
│ ( ) Gorgotsias          538                                       │
│ ( ) Messer               45                                       │
│ ▸ Limitar a secciones   (casillas por capítulo / simulador)       │
└───────────────────────────────────────────────────────────────────┘
┌ Cantidad de preguntas ────────────────────────────────────────────┐
│ ( ) 10   ( ) 25   (•) 45   ( ) 90   ( ) Otra: [   ]  (máx. 583)   │
└───────────────────────────────────────────────────────────────────┘
┌ Tiempo ───────────────────────────────────────────────────────────┐
│ [x] Usar temporizador     Minutos: [ 45 ]   (1 minuto por pregunta)│
└───────────────────────────────────────────────────────────────────┘
┌ Qué incluye ──────────────────────────────────────────────────────┐
│ • Orden de preguntas al azar; las opciones mantienen su orden.    │
│ • Las preguntas repetidas entre capítulos y simuladores aparecen  │
│   una sola vez.                                                   │
│ • Se excluyen las 8 preguntas pendientes de revisión.             │
│ • La pregunta de selección múltiple puntúa todo o nada.           │
└───────────────────────────────────────────────────────────────────┘
                                                   [Empezar examen]
```

- Los "disponibles" se calculan en vivo según origen y secciones (unidades deduplicadas con al menos una copia puntuable). Los presets mayores que lo disponible se deshabilitan con el motivo en texto ("Solo hay 45 disponibles").
- "Otra": entero entre 1 y el máximo; error en línea asociado por `aria-describedby`.
- Minutos por defecto = cantidad de preguntas; editable entre 1 y 600. Al cambiar la cantidad se recalcula solo si el usuario no editó los minutos a mano.
- La línea de selección múltiple se muestra solo si el alcance elegido contiene alguna pregunta `multiple`.
- Si existieran preguntas `ai_proposed` puntuables en el alcance, aparece una casilla "Incluir respuestas propuestas por IA (N)", desmarcada por defecto. Hoy no aparece.
- Si hay un examen en curso, arriba de todo: tarjeta "Tenés un examen sin terminar (12 de 45 respondidas, quedan 31:20)" con `[Reanudar]` y `[Descartar]` (este último con confirmación).

#### Examen en curso (`/examen/en-curso`) — modo foco

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Examen · Pregunta 12 de 45   ▓▓▓▓░░░░░░ 11 respondidas   ⏱ 31:20 [Ocultar]│
│                                                             [Finalizar]  │
├───────────────────────────────────────────────┬──────────────────────────┤
│ ┌ QuestionCard (modo examen) ───────────────┐ │ Navegador                │
│ │ Pregunta 12                    ⚑ Marcar   │ │ ┌──┬──┬──┬──┬──┐         │
│ │                                           │ │ │1●│2●│3 │4⚑│5●│ …       │
│ │ <enunciado>                               │ │ └──┴──┴──┴──┴──┘         │
│ │                                           │ │ ● respondida             │
│ │ ( ) A …                                   │ │ ○ sin responder          │
│ │ (•) B …                                   │ │ ◐ incompleta             │
│ │ ( ) C …                                   │ │ ⚑ marcada                │
│ │ ( ) D …                                   │ │                          │
│ └───────────────────────────────────────────┘ │                          │
│ [← Anterior]                    [Siguiente →] │                          │
└───────────────────────────────────────────────┴──────────────────────────┘
```

- En examen la tarjeta **no** muestra: insignia de estado de respuesta, sección de origen, número original, página, "Ver fragmento", favorita, aviso de duplicado. Solo "Pregunta n", enunciado, opciones y "Marcar". Por qué: el número y la sección delatan la respuesta a quien ya practicó, y el fragmento de respuesta la contiene.
- No hay "Comprobar". Seleccionar guarda la respuesta al instante; se puede cambiar hasta finalizar. En selección única se puede dejar sin responder con "Borrar respuesta" (botón de texto bajo las opciones, visible solo si hay selección).
- "Finalizar" abre un diálogo de confirmación con el recuento real: "Respondiste 40 de 45. Quedan 5 sin responder y 1 incompleta. No vas a poder cambiar las respuestas." `[Seguir respondiendo]` `[Finalizar examen]`.
- Al llegar a 0:00 el examen se cierra solo y va a resultados con el aviso "Se terminó el tiempo".
- Salir de la ruta con examen activo: el examen queda guardado; no hay diálogo bloqueante. El Dashboard y `/examen` ofrecen reanudar.

#### Examen: resultados (`/examen/resultado/:attemptId`)

```
Resultado del examen                         11 nov 2026 · Ambos documentos

┌──────────────────────────────────────────────────────────────────────────┐
│   (anillo)     37 de 45 correctas                                        │
│    82,2 %      ✓ 37 correctas    ✗ 6 incorrectas    ◌ 2 omitidas         │
│                Tiempo usado: 38:12 de 45:00                              │
│                La nota se calcula sobre las 45 preguntas puntuables.     │
└──────────────────────────────────────────────────────────────────────────┘

Por sección
┌───────────────────────────────────────────────┬─────────┬───────────────┐
│ Chapter 1 · General Security Concepts         │ 7 de 9  │ ▓▓▓▓▓▓▓░░     │
│ Practice Exam A                               │ 3 de 4  │ ▓▓▓▓▓▓░░      │
└───────────────────────────────────────────────┴─────────┴───────────────┘

Preguntas        Filtro: (Todas) (Incorrectas) (Omitidas) (Marcadas)
 1  ✓ Correcta    A client disputes having signed a digital contract. …
 2  ✗ Incorrecta  Which of the following …                       [Revisar]
 3  ◌ Omitida     …

[Revisar todas]   [Practicar las incorrectas]   [Nuevo examen]
```

- La nota es `correctas / puntuables del intento`, en porcentaje con un decimal y coma decimal. Las omitidas cuentan como no acertadas y eso se dice: "Las omitidas cuentan como no acertadas."
- **No hay veredicto de aprobado o desaprobado** ni conversión a la escala del examen real: los PDF no dan una equivalencia y sería un dato inventado.
- En la lista, el enunciado se recorta a una línea **solo como vista previa** (primeros 120 caracteres del primer bloque `text`, corte en límite de palabra, con `title` y enlace al texto completo). Es la única truncación permitida de texto del PDF y nunca se usa en la pantalla donde se responde o se revisa.
- "Por sección" se muestra solo si el intento abarca más de una sección; la sección es la de la copia mostrada.
- "Practicar las incorrectas" abre Práctica con la lista de ids incorrectos y omitidos de ese intento.

#### Examen: revisión (`/examen/resultado/:attemptId/revision/:n`)

Igual a la pantalla de práctica ya comprobada, en solo lectura: opciones con estados `correct`/`incorrect`/`missed`, banner de resultado (Correcta / Incorrecta / Omitida), `AnswerStatusBadge`, `ExplanationPanel` completo, "Ver fragmento del PDF", origen ("Chapter 4 · Security Operations · Question 414 · pág. …"), aviso de duplicado y, si corresponde, la nota de `review.notes`. Navegador a la derecha con colores e iconos de resultado. Botones: Anterior, Siguiente, "Volver al resultado". Favorita y marcar siguen activos.

#### Repaso (`/repaso`)

```
Repaso
[ Falladas (43) ] [ Marcadas (12) ] [ Favoritas (5) ] [ Historial (7) ]

── pestaña Falladas ──
Preguntas cuya última respuesta corregida fue incorrecta.
FilterBar: Documento ▾  Sección ▾                      [Repasar las 43]

┌──────────────────────────────────────────────────────────────────────────┐
│ ✗ Chapter 1 · Question 3      A client disputes …     fallada 2 de 3 · hace 2 d │
│ ✗ Practice Exam A · A52       A security technician … fallada 1 de 1 · ayer     │
└──────────────────────────────────────────────────────────────────────────┘

── pestaña Historial ──
┌ Fecha ───────┬ Origen ─────────┬ Preguntas ┬ Nota ───┬ Tiempo ┬──────────┐
│ 11 nov 2026  │ Ambos           │ 45        │ 82,2 %  │ 38:12  │ [Ver]    │
│ 9 nov 2026   │ Messer          │ 45        │ 71,1 %  │ —      │ [Ver]    │
└──────────────┴─────────────────┴───────────┴─────────┴────────┴──────────┘
```

- "Repasar las N" abre Práctica con esa lista (`?lista=falladas|marcadas|favoritas`), en el mismo componente de práctica, con el título "Repaso · Falladas".
- En repaso, una pregunta acertada **sale de "Falladas" al terminar la sesión**, no en el momento (para que Anterior/Siguiente no salten). Se informa: "Acertada: va a salir de Falladas."
- Cada fila muestra el estado con icono y texto: Vista (sin responder), Respondida, Acertada, Fallada, más "n intentos".
- Las listas agrupan duplicados: si dos copias de la misma unidad están falladas, aparece una fila con "2 copias".
- Historial: cada intento guardado; los de un banco anterior llevan la insignia "Banco anterior" (ver 6.4). `[Ver]` abre el resultado.
- Estados vacíos por pestaña: "No tenés preguntas falladas." / "No marcaste preguntas para repasar. Usá la bandera en cualquier pregunta." / "Todavía no hiciste ningún examen." con el botón correspondiente.

#### Referencia PBQ (`/pbq` y `/pbq/:pbqId`)

```
Referencia PBQ
Soluciones de las preguntas prácticas (PBQ) del extracto de Messer.
Son material de consulta: no se responden ni se puntúan.

┌ A1 ────────────────────────────────────────────────────────────────┐
│ Match the description with the most accurate attack type. Not all  │
│ attack types will be used.                                         │
│ 2 páginas · pág. impresas 35–36                          [Ver]     │
└────────────────────────────────────────────────────────────────────┘
… A2 … A5

── detalle /pbq/msr-pbq-a1 ──
← Referencia PBQ          A1                       [← A anterior] [Siguiente →]
{Solución del PDF — sin puntuación}
<title literal>
ⓘ <note literal del banco>

┌ ImageViewer ────────────────────────────────────────────────────────┐
│ [−] 100 % [+] [Ajustar al ancho] [Restablecer]     Página 1 de 2    │
│                    (imagen de la página)                            │
└─────────────────────────────────────────────────────────────────────┘
Página 19 del PDF (impresa 35)
▸ Texto extraído de la página
```

- Sin "Comprobar", sin opciones, sin contadores de progreso.
- Varias páginas: se apilan en vertical, cada una con su propio visor y pie.
- "Texto extraído de la página" es un desplegable con `bank.pbq[].text` en `<pre>` con ajuste de línea, `lang="en"`. Es la alternativa accesible a la imagen.

#### Ajustes e importación (`/ajustes`)

```
Ajustes

Apariencia
  Tema:  (•) Sistema  ( ) Claro  ( ) Oscuro
  Tamaño del texto de las preguntas:  ( ) Normal  ( ) Grande
  [x] Atajos de teclado de una tecla          [Ver atajos]

Importación del banco
  Versión del banco: 3efc5f1a3b · generado el 2026-11-11
  <tabla de resumen, igual a la del Dashboard, con más filas:>
    Explicaciones del PDF / generadas por IA · Selección múltiple ·
    Con notas de extracción · Soluciones PBQ
  Preguntas pendientes de revisión (8)
    gor-cap1-0023 · Question 23 · pág. 19   <motivo completo>   [Abrir]
    …
  ▸ Notas de extracción (11)
    gor-cap2-0216 · <nota>                                       [Abrir]
  Pares duplicados con clave distinta (1)
    gor-cap4-0414 ↔ gor-sim6-0514                                [Abrir]

Tus datos
  Se guardan solo en este navegador.
  [Exportar progreso (.json)]  [Importar progreso]  [Borrar todo el progreso]
```

- "Borrar todo el progreso" pide confirmación escribiendo nada extra: diálogo con el recuento real ("Vas a borrar 214 respuestas y 7 exámenes") y botones `[Cancelar]` `[Borrar]`.
- "Importar progreso" valida el archivo (ver 6.5) y muestra qué se va a reemplazar antes de aplicar.

---

## 4. Componentes reutilizables

Convenciones: props en TypeScript; ningún componente de `ui/` importa el store ni el banco (reciben datos por props); todo texto del PDF se envuelve con `lang="en"`; toda explicación de IA con `lang="es"`.

### AppShell
- Props: `children`, `focusMode?: boolean`.
- Compone `SkipLink`, `Sidebar` (≥ 768) o `TopBar` + `BottomNav` (< 768), y `<main id="contenido" tabIndex={-1}>`.
- `focusMode` (examen en curso) oculta toda la navegación.
- Landmarks: `<nav aria-label="Principal">`, `<main>`, un solo `<h1>` por página.

### Sidebar / BottomNav
- Props: `items: {to, label, icon}[]`, `collapsed?: boolean` (tablet).
- Ítem activo: fondo `--accent-soft`, texto `--accent-text`, barra de 3 px a la izquierda (arriba en BottomNav) y `aria-current="page"`. No depende solo del color.
- Colapsada: solo iconos con `aria-label` y tooltip al foco y al hover.
- BottomNav: 5 ítems con icono + etiqueta de `--fs-xs`; nunca solo iconos.
- La marca del examen en curso: si hay examen activo, el ítem Examen lleva un punto con texto oculto "examen en curso".

### QuestionCard
- Props:
  ```ts
  {
    question: Question;
    mode: 'practice' | 'exam' | 'review';
    position: { index: number; total: number };
    selected: Letter[];
    onSelect(letters: Letter[]): void;
    result?: GradeResult;            // presente cuando está comprobada o en revisión
    revealUnreliable?: boolean;      // pendiente: el usuario pidió ver lo que dice el PDF
    explanation?: Explanation | 'loading' | 'error';
    flags: { favorite: boolean; flagged: boolean };
    onToggleFavorite?(): void; onToggleFlag(): void;
    onOpenFragment?(): void;
    duplicatesInfo?: { id: string; label: string }[];
  }
  ```
- Estructura: `<article aria-labelledby>`; encabezado (rótulo, posición, acciones), insignia, `StemRenderer`, grupo de opciones, ayuda de selección múltiple, zona de feedback (`aria-live="polite"`), pie.
- Rótulo del encabezado en práctica y revisión: `originalLabel` literal + "· pág. N" (para Messer "· pág. PDF 11 (impresa 27)"). En examen: "Pregunta n".
- Variantes por `mode`: ver wireframes. En `exam` no se renderizan insignia, origen, fragmento, favorita ni duplicados.
- Al aparecer el feedback el foco **no** se mueve; el resultado se anuncia por la región viva ("Incorrecto. Elegiste B. La respuesta correcta es C.").
- Aviso de duplicado en `<p>` con icono `Copy`: "También aparece en: …" con enlaces. Si `review.notes` no está vacío, se muestran en un bloque informativo "Nota de extracción".

### StemRenderer
- Props: `blocks: StemBlock[]`.
- `text` → `<p lang="en">` con `white-space: pre-wrap` (conserva saltos de línea si los hubiera).
- `code` → `<pre tabIndex={0} role="group" aria-label="Bloque de registro o código" lang="en"><code>`; `--font-mono`, fondo `--surface-2`, borde `--border`, radio `--r-md`, padding 16 px, `overflow-x: auto`, `white-space: pre` (no reajusta líneas). Enfocable para desplazarlo con teclado; foco visible.
- No interpreta Markdown ni HTML: todo es texto plano (`textContent`). Nunca `dangerouslySetInnerHTML`. Importante: el banco contiene literales como `<script>alert(2)</script>` (en `msr-a080`).
- Separación entre bloques: 12 px.

### OptionItem
- Props:
  ```ts
  {
    option: Option; type: 'single' | 'multiple'; name: string;
    checked: boolean; disabled: boolean;
    state: 'idle' | 'selected' | 'correct' | 'incorrect' | 'missed' | 'neutral-locked';
    onChange(checked: boolean): void;
    shortcutHint?: string;   // "1" o "A"
  }
  ```
- Implementación: `<label>` que envuelve un `<input type="radio|checkbox">` nativo visualmente oculto (no `display:none`), el chip de letra, el texto y la marca de estado. El grupo es `<fieldset>` con `<legend class="sr-only">Opciones de respuesta</legend>`; en múltiple la leyenda agrega "Elegí 2".
- Estados (cada uno con tres señales: borde, icono, texto):

| Estado | Fondo | Borde | Chip de letra | Marca a la derecha |
|---|---|---|---|---|
| `idle` | `--surface` | 1,5 px `--border-strong` | contorno | — |
| hover (idle) | `--surface-2` | igual | igual | — |
| `selected` | `--accent-soft` | 2 px `--accent` | relleno `--accent`, letra blanca | radio o casilla marcada |
| `correct` (elegida y correcta) | `--success-soft` | 2 px `--success-border` | relleno verde | `CircleCheck` + "Tu respuesta · Correcta" |
| `incorrect` (elegida y errónea) | `--danger-soft` | 2 px `--danger-border` | relleno rojo | `CircleX` + "Tu respuesta · Incorrecta" |
| `missed` (correcta no elegida) | `--surface` | 2 px **discontinuo** `--success-border` | contorno verde | `CircleCheck` + "Respuesta correcta" |
| `neutral-locked` (bloqueada sin veredicto) | `--surface` | 1,5 px `--border` | contorno | — ; si estaba elegida: "Tu respuesta" |
| `disabled` | opacidad de texto no reducida; cursor por defecto | | | |

- Tras comprobar, los inputs quedan `disabled` pero el texto mantiene contraste AA (no se baja la opacidad del texto del PDF).
- El texto de marca es visible en ≥ 768 px; en móvil se muestra debajo del texto de la opción. Nunca solo el icono.
- En múltiple, al llegar al número requerido las casillas no marcadas **no** se deshabilitan; si el usuario intenta marcar una más, no se marca y se anuncia "Ya elegiste 2. Desmarcá una para cambiar." (texto visible bajo el grupo y región viva).
- El texto de la opción nunca se trunca; la fila crece.

### AnswerStatusBadge
- Props: `status: 'pdf' | 'ai_proposed' | 'pending' | 'unknown'`, `reasons?: string[]`, `size?: 'sm' | 'md'`.
- Derivación (función pura `getAnswerState(q)` en `bank/`): si `review.status === 'pending'` → `pending`; si no, `answerStatus`; cualquier otro valor → `unknown`.

| status | Texto exacto | Icono | Estilo |
|---|---|---|---|
| `pdf` | Respuesta del PDF | `FileCheck2` | texto `--info`, fondo `--info-soft`, borde sólido `--info-border` |
| `ai_proposed` | Respuesta propuesta por IA — requiere validación | `Sparkles` | texto `--warning`, fondo `--warning-soft`, borde **discontinuo** `--warning-border` |
| `pending` | Pendiente de revisión | `TriangleAlert` | texto `--warning`, fondo `--warning-soft`, borde sólido 2 px `--warning-border` |
| `unknown` | Estado de respuesta desconocido | `CircleHelp` | igual a `pending`; la pregunta se trata como no puntuable |

- `pending` con `reasons` se muestra como bloque (no como chip) con los motivos completos, literales, en una lista. No se oculta detrás de un tooltip.
- Las tres variantes se distinguen por texto e icono, no solo por color.

### ExplanationPanel
- Props: `explanation: Explanation | 'loading' | 'error'`, `source: AnswerSource`, `options: Option[]`, `selected: Letter[]`, `variant?: 'normal' | 'unreliable'`, `onRetry?()`.
- Encabezado con etiqueta de origen y referencia:

| `origin` | Etiqueta exacta | Estilo |
|---|---|---|
| `pdf` | Explicación del PDF (en inglés) | icono `FileText`, borde izquierdo de 3 px `--info-border`, fondo `--surface` |
| `ai` | Explicación generada por IA — no es del PDF | icono `Sparkles`, borde discontinuo `--warning-border`, fondo `--warning-soft`, más la línea fija "Puede contener errores. La respuesta correcta sí proviene del PDF." |

- Referencia: `kind: 'explanation'` → "Gorgotsias · pág. 51"; `kind: 'quick_key'` → "Messer · clave rápida de respuestas · pág. PDF 17 (impresa 33)". Si `page === printedPage` se muestra una sola.
- Cuerpo: `text` literal en `<p>` con `lang` según `explanation.language`.
- Si `perOption` tiene entradas: subtítulo "Por qué las otras opciones son incorrectas" y una lista en orden de letra; cada ítem con el chip de letra y el texto literal. Las letras sin entrada no se listan ni se inventa texto. Si la letra coincide con una elección errónea del usuario se agrega la marca "Tu elección". Si `perOption` está vacío, la sección no existe (no se muestra un título con "no disponible").
- `'loading'`: skeleton de 3 líneas con `aria-busy`. `'error'`: "No se pudo cargar la explicación." + `[Reintentar]`. El veredicto correcto/incorrecto no depende de esta carga.
- `variant="unreliable"`: ver variante pendiente en 3.3.

### PdfFragmentModal
- Props: `open`, `onClose`, `question: Question`, `fragment: Fragment | 'loading' | 'error'`, `allowAnswer: boolean`.
- `<dialog>` nativo con `showModal()` (trampa de foco y Esc nativos), `aria-labelledby` al título "Fragmento del PDF · Question 1". Al cerrar, el foco vuelve al botón que lo abrió. El fondo no hace scroll.
- Tamaño: ancho máximo 880 px, alto máximo 90 vh; en móvil ocupa toda la pantalla.
- Pestañas (`role="tablist"`): "Pregunta (pág. N)" y "Respuesta (pág. N)". Si `allowAnswer` es falso (práctica sin comprobar), la pestaña Respuesta está deshabilitada con el texto "Disponible después de comprobar". En examen en curso el modal no existe.
- Gorgotsias: aviso fijo "Texto extraído literal del PDF. No hay imagen de esta página." y el texto en `<pre lang="en">` con `white-space: pre-wrap` (conserva los saltos de renglón originales), `--font-mono` de `--fs-code`, botón "Copiar texto".
- Messer: `ImageViewer` con la imagen de página. Pie: "Página 11 del PDF (impresa 27). La página contiene varias preguntas: buscá la A80."
- Carga del fragmento: se pide `fragments/<section>.json` al abrir; mientras, skeleton; error con reintento.

### ImageViewer
- Props: `src`, `alt`, `naturalWidth?`, `naturalHeight?`, `caption?`.
- Barra: `[−]` `[nivel %]` `[+]` `[Ajustar al ancho]` `[Restablecer]`. Zoom de 50 % a 300 % en pasos de 25 %. Las imágenes son de 660 × 990 px, por eso el tope es 300 %.
- Interacción: contenedor con `overflow: auto` y `tabIndex={0}` (scroll nativo con flechas, rueda y arrastre táctil); arrastre con mouse para desplazar; Ctrl + rueda y pellizco hacen zoom; teclas `+`, `−`, `0` con el visor enfocado.
- El nivel de zoom se anuncia en una región `aria-live="polite"`.
- `alt` corto y descriptivo ("Página 19 del PDF de Messer: solución de la PBQ A1"); la transcripción larga va aparte (desplegable), no en el `alt`.
- Estados: skeleton con la proporción 2:3 reservada (sin salto de layout); error "No se pudo cargar la imagen de la página." + reintento.
- `loading="lazy"` y `decoding="async"`.

### FilterBar
- Props: `value: PracticeFilter`, `onChange`, `counts`, `available: {docs, sections}`.
- Controles: Documento (Todos / Gorgotsias / Messer), Sección (dependiente del documento; agrupada en Capítulos / Simuladores / Messer), Estado (Todas / Sin responder / Falladas / Marcadas / Pendientes de revisión), casilla "Solo favoritas".
- **Rótulo "Sin responder"** para el filtro que el pedido llama "pendientes": se evita la palabra "pendiente" para que no se confunda con "Pendiente de revisión".
- Son `<select>` nativos con `<label>` visible. Cada opción muestra su cantidad real entre paréntesis.
- Debajo: contador "110 preguntas" con `aria-live="polite"` y, si hay filtros activos, `[Quitar filtros]`.
- Móvil: botón "Filtros (n)" que abre una hoja inferior (`<dialog>`) con los mismos controles y `[Aplicar]`.
- Resultado vacío: `EmptyState` "Ninguna pregunta coincide con estos filtros" + `[Quitar filtros]`.
- Los filtros viven en la query string y en `prefs.lastPracticeFilter`.

### ProgressRing / ProgressBar
- Props: `value`, `max`, `label`, `size?`, `tone?: 'accent' | 'success'`.
- `role="progressbar"` con `aria-valuenow/min/max` y `aria-valuetext` ("214 de 1177 respondidas"). El número siempre está también como texto visible; nunca solo el gráfico.
- `max === 0` → no se renderiza (el contenedor decide el estado vacío).
- Pista `--surface-2`, valor `--accent`; grosor del anillo 8 px, barra 8 px con radio `pill`.
- `ProgressBar` admite `segments` (acertadas en `--success-border`, falladas en `--danger-border`) con leyenda textual obligatoria.

### Timer
- Props: `remainingMs`, `totalMs`, `hidden`, `onToggleHidden`.
- `role="timer"`, `aria-live="off"`; formato `mm:ss` (o `h:mm:ss`), `--font-mono`, tabular.
- Avisos por región viva separada (`polite`), una sola vez cada uno: "Quedan 5 minutos" y "Queda 1 minuto". Con menos de 5 minutos, el reloj suma el icono `TriangleAlert` y el texto "Queda poco tiempo" (no solo cambio de color; sin parpadeo).
- "Ocultar" reemplaza el reloj por `[Mostrar tiempo]`; los avisos de 5 y 1 minuto se siguen mostrando.

### QuestionNavigator
- Props: `items: {index, state, flagged, current}[]`, `onGo(index)`, `mode`.
- Grilla de botones de 40 × 40 px (44 en táctil), 5 columnas en panel, auto-fill en hoja móvil. Es un `<nav aria-label="Preguntas">` con una lista.
- Cada botón: número + icono pequeño de estado, y `aria-label` completo ("Pregunta 3, fallada, marcada"). `aria-current="true"` en la actual, que además lleva borde de 2 px `--accent`.
- Estados en práctica y revisión: sin ver, vista, acertada (`CircleCheck` verde), fallada (`CircleX` rojo), sin corregir (pendiente de revisión, `TriangleAlert`). En examen: sin responder (contorno), respondida (relleno `--accent-soft` + punto), incompleta (medio punto), marcada (bandera en la esquina).
- Leyenda textual siempre visible bajo la grilla.
- Con más de 150 ítems (lista "todas" de práctica), la grilla se pagina de a 100 con selector de rango ("1–100", "101–200", …) para no montar 1185 botones.

### ResultSummary
- Props: `attempt: ExamAttempt`.
- Muestra anillo con porcentaje, "37 de 45 correctas", tres contadores con icono y texto (correctas, incorrectas, omitidas), tiempo usado si hubo temporizador, y la línea de base de la nota. Los tres contadores siempre suman el total; hay un test que lo verifica.

### EmptyState / ErrorState / Skeleton
- `EmptyState`: props `icon`, `title`, `description?`, `action?`. Icono de 40 px en `--text-subtle`, título `h2`, una acción como máximo.
- `ErrorState`: props `title`, `detail?`, `onRetry?`. `role="alert"`. Para el banco: "No se pudo cargar el banco de preguntas." + detalle técnico corto en un desplegable + `[Reintentar]`.
- `Skeleton`: bloques con `aria-hidden`; el contenedor lleva `aria-busy="true"` y un texto oculto "Cargando…". Hay un skeleton con la forma de `QuestionCard` y otro de tarjetas de Dashboard.
- `ErrorBoundary` global que muestra `ErrorState` con "Recargar" y nunca borra datos.

### ThemeToggle
- Props: `value: 'system' | 'light' | 'dark'`, `onChange`.
- En Ajustes: grupo de radios. En la barra lateral y el encabezado: botón que alterna claro ↔ oscuro, con `aria-label` "Cambiar a tema oscuro" y el icono del tema de destino.

### Otros
- `Button`: variantes `primary` (fondo `--accent`), `secondary` (borde `--border-strong`), `ghost`, `danger`; tamaños `md` (40 px) y `lg` (48 px); estado `loading` con `aria-busy`; deshabilitado con `aria-disabled` y motivo visible cuando no es obvio.
- `IconButton`: 40 × 40 px, `aria-label` obligatorio por tipo.
- `ToggleIconButton` (favorita, marcar): `aria-pressed`.
- `Dialog`: envoltorio de `<dialog>` con título, cuerpo y acciones; usado por confirmaciones, fragmento, filtros móviles y ayuda de atajos.
- `Tabs`: patrón WAI-ARIA con flechas izquierda y derecha.
- `Toast`: región `aria-live="polite"` para confirmaciones breves ("Agregada a favoritas"); se cierra sola a los 4 s, se puede cerrar antes y no contiene acciones imprescindibles.
- `Tooltip`: aparece al hover y al foco; nunca es la única vía a una información.
- `ShortcutsDialog`: tabla de atajos.
- `Kbd`: tecla en `--font-mono`.

---

## 5. Flujos y máquinas de estado

### 5.1 Práctica (por pregunta)

```
              seleccionar / cambiar
        ┌──────────────┐
        ▼              │
  idle ───seleccionar──▶ answering ──Comprobar──▶ checked
   ▲                       │                        │
   │◀─── navegar ──────────┘                        │ Reintentar
   │       (descarta la selección sin guardar)      │
   └────────────────────────────────────────────────┘
```

- `idle`: sin selección. "Comprobar" deshabilitado, con ayuda "Elegí una opción".
- `answering`: única → 1 seleccionada; múltiple → entre 1 y N. "Comprobar" se habilita con exactamente N (`N = correct.length`). Ayuda en múltiple: "Elegí 2 respuestas (1 de 2)".
- `checked`: opciones bloqueadas; se corrige con `grade()` (7.3), se registra el intento en el progreso (6.2), se muestra feedback y explicación. El botón central pasa a "Reintentar" (vuelve a `idle` sin borrar el historial) y "Siguiente" pasa a ser el primario.
- Pregunta no puntuable (pendiente o desconocida): el botón central dice "Ver lo que dice el PDF"; lleva a `revealed`, que bloquea las opciones en `neutral-locked`, guarda el intento con resultado `ungraded` y no toca contadores de aciertos ni errores.
- Dentro de una sesión (misma lista), volver a una pregunta comprobada la muestra comprobada. La sesión vive en memoria (`sessionStore`); al recargar, las preguntas vuelven a `idle` y muestran un chip informativo "Última vez: incorrecta · hace 2 días".
- Al entrar a una pregunta se registra `seenAt`.
- Anterior y Siguiente recorren la lista filtrada en orden del banco. En los extremos el botón se deshabilita; en la última, "Siguiente" se reemplaza por "Terminar", que va a un resumen de sesión en la misma ruta (`?fin=1`): respondidas, acertadas y falladas de esta sesión, con `[Repasar falladas]` y `[Volver a Práctica]`.
- La lista de ids se congela al iniciar la sesión: cambiar el estado de una pregunta no la saca de la lista en curso.
- `:questionId` inexistente → `EmptyState` "Esa pregunta no existe en el banco actual".

### 5.2 Examen

```
config ──Empezar──▶ running ──Finalizar (confirmado) / tiempo agotado──▶ finished ──▶ review
                      │  ▲
            cerrar o  │  │ Reanudar
            recargar  ▼  │
                    suspended (guardado en localStorage)
config ◀──Descartar── suspended
```

Construcción del examen (`grading/buildExam.ts`, función pura con generador aleatorio inyectable para tests):

1. Tomar las preguntas del alcance (documento y secciones).
2. Agrupar en unidades por componentes conexos de `duplicates`.
3. De cada unidad, quedarse con las copias puntuables dentro del alcance; si no queda ninguna, descartar la unidad. Representante: la primera en orden del banco con `group === 'cap'`; si no hay, la primera en orden del banco. (Así `gor-cap4-0414` representa a su unidad y `gor-sim6-0514` nunca entra.)
4. Mezclar con Fisher–Yates y tomar las primeras `count`.
5. Guardar por ítem `{questionId, contentHash}` y el `bankVersion`.

Durante `running`:

- Cada cambio de respuesta, marca o posición se guarda de inmediato en `examActive`.
- Tiempo: se guarda `remainingMs` y se descuenta por diferencia de `performance.now()` mientras la pestaña está abierta; se persiste cada 5 s y en `visibilitychange` y `pagehide`. **El tiempo con la app cerrada no cuenta**; al reanudar sigue desde lo guardado. Esto se informa en la tarjeta de reanudación ("El tiempo se pausó al salir").
- Sin feedback de ningún tipo: ni colores, ni explicación, ni fragmento, ni insignias.
- Al finalizar se crea un `ExamAttempt` inmutable con la corrección ya calculada, se actualiza el progreso por pregunta (modo `exam`) y se borra `examActive`.

Estados de respuesta por ítem al corregir: `correct`, `incorrect`, `omitted` (selección vacía). Una múltiple con selección parcial o de más es `incorrect`.

### 5.3 Repaso

- Listas derivadas del progreso (no se guardan aparte):
  - Falladas: último resultado corregido `incorrect`.
  - Marcadas: `flagged`.
  - Favoritas: `favorite`.
- Estados por pregunta (selector `getStudyState(progress)`), mutuamente excluyentes y con rótulo visible:

| Estado | Condición | Rótulo |
|---|---|---|
| `unseen` | sin registro | Sin ver |
| `seen` | `seenAt` y ningún intento | Vista, sin responder |
| `ungraded` | solo intentos sin corregir | Respondida, sin corregir |
| `correct` | último intento corregido correcto | Acertada |
| `incorrect` | último intento corregido incorrecto | Fallada |

  "Respondida" (contadores) = `correct` + `incorrect`.
- Una sesión de repaso usa la máquina de práctica. La lista se congela al empezar; la pertenencia a "Falladas" se recalcula al salir.

### 5.4 Atajos de teclado

Activos en práctica, examen y revisión. Se ignoran si hay un modal abierto, si el foco está en un campo de texto o `<select>`, o si se mantiene Ctrl, Alt o Meta. Se pueden desactivar en Ajustes (los de una sola tecla), como exige WCAG 2.1.4.

| Tecla | Acción |
|---|---|
| `1`–`9` | Elegir o alternar la opción n |
| `A`–`E` (hasta la última letra existente) | Elegir o alternar la opción por letra |
| `↑` / `↓` | Mover entre opciones (comportamiento nativo del grupo) |
| `Espacio` | Marcar la opción enfocada (nativo) |
| `Enter` | Práctica: Comprobar si la selección es válida; ya comprobada: Siguiente. Examen: Siguiente |
| `←` / `→` | Pregunta anterior / siguiente (se intercepta también con el foco en una opción, para que no cambie la selección) |
| `P` / `N` | Alternativa a anterior / siguiente |
| `R` | Reintentar (práctica comprobada) |
| `F` | Favorita (no en examen) |
| `M` | Marcar para repasar |
| `V` | Ver fragmento del PDF (no en examen) |
| `G` | Abrir el navegador de preguntas |
| `?` | Ayuda de atajos |
| `Esc` | Cerrar modal, hoja o panel |

- `Enter` sobre un botón o enlace enfocado ejecuta ese control, no el atajo global.
- Las letras `F`, `M`, `N`, `P`, `R`, `V`, `G` no chocan con las letras de opción porque las opciones llegan como máximo a `E`. Si el banco trajera más de 5 opciones, las letras de opción tienen prioridad y el atajo en conflicto queda sin efecto (los números siguen funcionando).
- En el visor de imagen enfocado: `+`, `−`, `0`.
- Cada opción muestra su pista de tecla (`Kbd`) solo en dispositivos con puntero fino (`@media (hover: hover) and (pointer: fine)`).

---

## 6. Modelo de datos local

### 6.1 Banco (solo lectura)

Tipos en `src/bank/types.ts`. Reflejan la forma real de `data/bank.json`.

```ts
export type DocId = 'gorgotsias' | 'messer';
export type Letter = string;               // 'A'…'E'; no asumir 4
export type AnswerStatus = 'pdf' | 'ai_proposed' | 'pending';

export interface BankDocument { id: DocId; title: string; file: string; pages: number; }

export type StemBlock = { type: 'text' | 'code'; text: string };
export interface Option { id: string; letter: Letter; text: string; }

export interface AnswerSource {
  doc: DocId; page: number; printedPage: number; kind: 'explanation' | 'quick_key';
}
export interface Explanation {
  origin: 'pdf' | 'ai'; language: 'en' | 'es'; text: string;
  perOption: Record<Letter, string>;       // puede estar vacío o incompleto
}
export interface Review { status: 'ok' | 'pending'; reasons: string[]; notes: string[]; }

export type Fragment =
  | { questionPage: number; question: string; answerPage: number; answer: string }            // gorgotsias
  | { questionPage: number; questionImage: string; answerPage: number; answerImage: string }; // messer

/** Lo que va en core.json: todo menos explanation y fragment. */
export interface Question {
  id: string;                 // 'gor-cap1-0001', 'msr-a080'
  doc: DocId;
  group: string;              // 'cap' | 'sim' | 'pe-a'
  section: string;            // 'cap1'…'cap5', 'sim1'…'sim6', 'pe-a'
  topic: string;              // literal
  number: number;
  originalLabel: string;      // 'Question 1', 'A80'
  page: number; printedPage: number;
  stem: StemBlock[];
  options: Option[];
  selectionType: 'single' | 'multiple';
  correct: Letter[];
  answerStatus: AnswerStatus;
  answerSource: AnswerSource;
  review: Review;
  duplicates: string[];
  similar: string[];
  scorable: boolean;
  contentHash: string;
}

export interface PbqSolution {
  id: string; doc: DocId; originalLabel: string; kind: 'pbq-solution';
  title: string; pages: number[]; printedPages: number[]; images: string[];
  text: string; note: string; scorable: false;
}
```

Reparto en archivos (`scripts/prepare-bank.mjs`, se ejecuta en `predev` y `prebuild`; salida en `public/bank/`, que no se versiona):

| Archivo | Contenido | Tamaño aprox. | Cuándo se carga |
|---|---|---|---|
| `manifest.json` | `bankVersion`, `generatedAt`, `documents`, lista de secciones con conteos, contenido de `import-report.json`, nombres de los demás archivos | < 15 KB | Al arrancar |
| `core.<bankVersion>.json` | `Question[]` sin `explanation` ni `fragment` | ~1,2 MB (≈ 200 KB comprimido) | Al arrancar, tras el manifest |
| `explanations.<bankVersion>.json` | `Record<id, Explanation>` | ~1,1 MB | En segundo plano (`requestIdleCallback`) apenas termina `core`; a demanda si se comprueba antes |
| `fragments/<section>.<bankVersion>.json` | `Record<id, Fragment>` de una sección (12 archivos) | 5–300 KB c/u | Al abrir el primer fragmento de esa sección |
| `pbq.<bankVersion>.json` | `PbqSolution[]` | ~10 KB | Al entrar a `/pbq` |
| `pages/messer/p-NN.jpg` | Copia de `data/pages/messer/` | 1,9 MB en total | Por imagen, a demanda |

Reglas del script:

- Solo reparte y copia: no modifica ningún string. Un test (`prepare-bank.test`) recompone el banco a partir de los archivos generados y verifica igualdad profunda con `data/bank.json`.
- Escribe JSON sin sangría.
- Falla con mensaje claro si falta `data/bank.json` o si `import-report.json` tiene otro `bankVersion`.
- Las rutas de imagen del banco (`pages/messer/p-11.jpg`) se resuelven contra `import.meta.env.BASE_URL + 'bank/'`.

`BankProvider` (capa `bank/`): estados `loading | ready | error`; valida al cargar con un validador escrito a mano (sin dependencia): ids únicos, `correct ⊆ letras`, `selectionType` conocido, `stem` no vacío. Si falla, `ErrorState` con la lista de problemas; no se corre con un banco inválido. Construye una vez los índices: `byId`, `bySection`, `byDoc`, `unitOf` (id → id de unidad), `units`.

### 6.2 Store local

```ts
export interface Prefs {
  theme: 'system' | 'light' | 'dark';
  textSize: 'normal' | 'large';
  singleKeyShortcuts: boolean;                 // por defecto true
  timerHidden: boolean;
  lastPracticeFilter?: PracticeFilter;
  lastExamConfig?: ExamConfig;
}

export interface PracticeFilter {
  doc?: DocId; section?: string;
  state?: 'all' | 'unanswered' | 'failed' | 'flagged' | 'pending_review';
  onlyFavorites?: boolean;
  list?: 'falladas' | 'marcadas' | 'favoritas' | `attempt:${string}`;
}

export type Outcome = 'correct' | 'incorrect' | 'ungraded';

export interface QuestionProgress {
  contentHash: string;            // hash con el que se registró lo de abajo
  seenAt?: number;                // epoch ms, primera vez
  lastSeenAt?: number;
  attempts: number;               // intentos corregidos
  correctCount: number;
  incorrectCount: number;
  last?: { selected: Letter[]; outcome: Outcome; at: number; mode: 'practice' | 'review' | 'exam' };
  lastGraded?: { outcome: 'correct' | 'incorrect'; at: number };
  favorite?: boolean;
  flagged?: boolean;
  contentChanged?: boolean;       // ver 6.4
}

export interface ProgressState {
  schemaVersion: 1;
  bankVersion: string;
  questions: Record<string, QuestionProgress>;
  orphans?: Record<string, QuestionProgress>;   // ids que ya no existen en el banco
  lastPractice?: { filter: PracticeFilter; questionId: string; at: number };
}

export interface ExamConfig {
  source: 'both' | DocId; sections?: string[];
  count: number; timerMinutes: number | null;
  includeAiProposed: boolean;
}

export interface ExamItem {
  questionId: string; contentHash: string;
  selected: Letter[]; flagged: boolean;
}

export interface ExamActive {
  schemaVersion: 1; id: string; bankVersion: string;
  config: ExamConfig; startedAt: number;
  items: ExamItem[]; currentIndex: number;
  remainingMs: number | null; elapsedMs: number;
}

export interface ExamAttempt {
  id: string; bankVersion: string; config: ExamConfig;
  startedAt: number; finishedAt: number; elapsedMs: number;
  endedBy: 'user' | 'timeout';
  items: (ExamItem & { correct: Letter[]; result: 'correct' | 'incorrect' | 'omitted' })[];
  totals: { scorable: number; correct: number; incorrect: number; omitted: number };
}

export interface AttemptsState { schemaVersion: 1; attempts: ExamAttempt[]; }  // más nuevo primero
```

`ExamAttempt.items[].correct` guarda la clave con la que se corrigió: el resultado histórico no se recalcula nunca.

### 6.3 Claves de `localStorage`

| Clave | Contenido | Tamaño estimado |
|---|---|---|
| `secplus:v1:prefs` | `Prefs` | < 1 KB |
| `secplus:v1:progress` | `ProgressState` | hasta ~250 KB con las 1185 respondidas |
| `secplus:v1:attempts` | `AttemptsState` | ~6 KB por examen de 90; se conservan los últimos 100 |
| `secplus:v1:exam-active` | `ExamActive` o ausente | < 10 KB |

- `v1` es la versión del esquema de almacenamiento. Un cambio incompatible crea `v2` con una función `migrateV1toV2`; las migraciones son puras, encadenadas y con tests.
- Capa `storage/`: lectura con `try/catch` y validación de forma; JSON corrupto → se renombra la clave a `…:corrupt:<timestamp>` y se arranca limpio con un aviso no bloqueante ("No se pudo leer tu progreso guardado; se guardó una copia").
- Escritura con debounce de 300 ms (inmediata en `pagehide`). `QuotaExceededError` → aviso persistente "No hay espacio para guardar el progreso" con enlace a exportar; la app sigue funcionando en memoria.
- Si `localStorage` no está disponible, la app funciona en memoria y lo avisa una vez en Ajustes y en un toast.
- Sincronización entre pestañas con el evento `storage`: se recarga el estado; si hay un examen activo en otra pestaña, esta muestra "El examen se está rindiendo en otra pestaña".

### 6.4 Versionado: `bankVersion` y `contentHash`

Se ejecuta una vez al arrancar, después de cargar `core` (`storage/reconcile.ts`, función pura con tests):

1. Si `progress.bankVersion === manifest.bankVersion`: no hacer nada.
2. Si difiere, por cada entrada de `progress.questions`:
   - El id existe y `contentHash` coincide → se conserva intacta.
   - El id existe y el hash difiere → se conservan `favorite` y `flagged`; se ponen en cero `attempts`, `correctCount`, `incorrectCount`, se borran `last` y `lastGraded`, se actualiza `contentHash` y se pone `contentChanged: true`. La pregunta muestra el aviso "Esta pregunta cambió en el banco desde tu último intento; se reinició su historial." hasta el próximo intento.
   - El id no existe → se mueve a `orphans` (no se muestra ni cuenta; se incluye en la exportación).
3. Se actualiza `progress.bankVersion` y se muestra un aviso con el recuento real: "El banco se actualizó: 3 preguntas cambiaron y reiniciaron su historial; 1 ya no existe."
4. `examActive` con otro `bankVersion`: si todos sus `{questionId, contentHash}` siguen coincidiendo, se conserva; si no, se descarta con aviso ("El examen en curso se descartó porque el banco cambió").
5. `attempts`: nunca se modifican. Un intento con `bankVersion` distinto lleva la insignia "Banco anterior". En su revisión, cada ítem cuyo hash ya no coincide (o cuyo id no existe) muestra "El contenido de esta pregunta cambió desde este intento" y el resultado guardado, sin volver a corregir; si el id no existe, se muestra solo el resultado y las letras.
6. Las estadísticas del Dashboard se calculan solo desde `progress.questions` (ya reconciliado), nunca mezclando intentos de bancos anteriores.

Nota: el progreso es por `id`, no por unidad de duplicados. Responder `gor-cap1-0001` no marca como respondida a `gor-sim1-0092`. Se eligió así porque las copias pueden diferir (6 grupos tienen hash distinto) y porque es más fácil de explicar; la UI lo compensa con el aviso "También aparece en…".

### 6.5 Exportar e importar

- Exportar: un `.json` con `{ app: 'secplus', schemaVersion: 1, exportedAt, prefs, progress, attempts }`, generado con `Blob` y un enlace de descarga.
- Importar: valida `app` y `schemaVersion`, pasa las migraciones, corre la reconciliación de 6.4 contra el banco actual, muestra un resumen ("214 preguntas con progreso, 7 exámenes") y pide confirmación antes de **reemplazar** (no fusiona).

---

## 7. Estructura de carpetas, capas y reglas de corrección

### 7.1 Carpetas

```
app/
  data/                      # fuente (no tocar): bank.json, import-report.json, pages/
  docs/                      # EXTRACTION_SUMMARY.md
  scripts/
    prepare-bank.mjs         # reparte data/bank.json → public/bank/
    (scripts Python existentes de extracción: no se modifican)
  public/bank/               # generado, fuera de control de versiones
  index.html
  src/
    main.tsx  App.tsx  routes.tsx
    bank/                    # carga, tipos, validación, índices, selectores puros
      types.ts  loadBank.ts  validate.ts  indexes.ts  selectors.ts  BankProvider.tsx
    grading/                 # funciones puras, sin React ni almacenamiento
      grade.ts  buildExam.ts  scoreAttempt.ts  units.ts
    storage/                 # localStorage, esquema, migraciones, reconciliación
      keys.ts  storage.ts  schema.ts  migrate.ts  reconcile.ts  exportImport.ts
    state/                   # stores zustand que combinan las capas
      prefsStore.ts  progressStore.ts  examStore.ts  practiceSession.ts
    ui/                      # componentes de presentación sin dependencias de estado
      AppShell/ Sidebar/ BottomNav/ Button/ Dialog/ Tabs/ Toast/ Tooltip/
      QuestionCard/ StemRenderer/ OptionItem/ AnswerStatusBadge/ ExplanationPanel/
      PdfFragmentModal/ ImageViewer/ FilterBar/ Progress/ Timer/ QuestionNavigator/
      ResultSummary/ States/ ThemeToggle/
    features/                # pantallas: conectan state + ui
      dashboard/ practice/ exam/ review/ pbq/ settings/
    hooks/                   # useShortcuts, useMediaQuery, useDocumentTitle, useCountdown
    styles/                  # tokens.css, reset.css, global.css
    i18n/es.ts               # todos los textos de interfaz en un solo módulo
    test/                    # fixtures (incluye una pregunta ai_proposed ficticia SOLO para tests)
```

Reglas de dependencia (verificables con una regla de ESLint `no-restricted-imports`):

- `grading/` no importa de `storage/`, `state/`, `ui/` ni React.
- `bank/` no importa de `storage/` ni `state/`.
- `ui/` no importa de `state/`, `storage/` ni `bank/loadBank`; solo tipos de `bank/types`.
- `features/` es la única capa que conecta todo.
- "Importación" como capa es el par `scripts/` (extracción y reparto, fuera del runtime) + `bank/` (carga y validación en runtime).

Textos de interfaz: todos en `i18n/es.ts`, en español rioplatense con voseo ("Elegí", "Comprobá"), consistente en toda la app. Los fixtures de test con datos ficticios no se empaquetan en producción.

### 7.2 Reglas de corrección

```ts
// grading/grade.ts
export type GradeResult =
  | { kind: 'correct' }
  | { kind: 'incorrect' }
  | { kind: 'omitted' }
  | { kind: 'ungraded'; reason: 'pending_review' | 'not_scorable' | 'unknown_status' };

export function isScorable(q: Question): boolean;
export function grade(q: Question, selected: Letter[]): GradeResult;
```

1. `isScorable(q)` es verdadero solo si `q.scorable === true` **y** `q.review.status === 'ok'` **y** `q.answerStatus` es `'pdf'` o `'ai_proposed'` **y** `q.correct.length ≥ 1` **y** todas las letras de `correct` existen en `options`. La app nunca "asciende" a puntuable una pregunta que el banco marca como no puntuable.
2. Si no es puntuable → `ungraded`, sin mirar `correct`.
3. `selected` vacío → `omitted` (en práctica no ocurre: no se puede comprobar sin selección).
4. Única: `correct` si `selected.length === 1` y `selected[0] === correct[0]`; si no, `incorrect`.
5. Múltiple: **todo o nada**. `correct` solo si el conjunto de `selected` es exactamente igual al conjunto `correct`. Selección parcial, de más o con una errónea → `incorrect`. No hay puntaje parcial. La UI lo dice antes de responder ("Puntúa solo si marcás exactamente las correctas") y en la revisión ("Selección múltiple: todo o nada").
6. La comparación es por letra, sin distinguir orden.
7. Estado visual de cada opción tras corregir (`optionStates(q, selected)`): elegida y en `correct` → `correct`; elegida y no en `correct` → `incorrect`; no elegida y en `correct` → `missed`; el resto → `idle` bloqueada. Para `ungraded` todas quedan `neutral-locked`.

Nota del examen (`scoreAttempt.ts`):

- `scorable` = cantidad de ítems del intento (todos son puntuables por construcción; se vuelve a verificar al corregir y cualquier ítem no puntuable se excluye del denominador y se lista aparte como "No puntuada").
- `porcentaje = correct / scorable × 100`, mostrado con un decimal. Con `scorable === 0` no se muestra porcentaje.
- `correct + incorrect + omitted === scorable` siempre.

Estadísticas del Dashboard: denominador = preguntas con `isScorable` verdadero del alcance (hoy 1177). Los intentos `ungraded` no suman a respondidas, acertadas ni falladas.

---

## 8. Orden de implementación por fases

Cada fase termina con `npm run typecheck`, `npm run lint` y `npm test` en verde, sin errores en la consola del navegador.

### Fase 0 — Base del proyecto y datos
Alcance: proyecto Vite + React + TS estricto en `app/`; ESLint; Vitest; `tokens.css`, reset y fuentes; `prepare-bank.mjs`; tipos, carga, validación e índices del banco.

Criterios de aceptación:
- `npm run dev` y `npm run build` ejecutan `prepare-bank` y generan `public/bank/` con los archivos de 6.1.
- Test: recomponer los archivos generados da un objeto profundamente igual a `data/bank.json`.
- Test: el banco cargado tiene 1185 preguntas, 1177 puntuables, 8 con `review.status === 'pending'`, 586 unidades de duplicados y 583 con copia puntuable (los números se comparan contra `import-report.json` donde existan, no contra constantes del código de producción).
- La carga inicial no pide `explanations` de forma bloqueante ni ningún archivo de `fragments` (verificable en la pestaña Red).
- Un test recorre todos los pares de la tabla de contrastes de 2.1 leyendo `tokens.css` y falla si alguno baja del mínimo.

### Fase 1 — Shell, navegación, tema y estados
Alcance: `AppShell`, `Sidebar`, `BottomNav`, rutas con pantallas vacías, `ThemeToggle`, `prefsStore`, capa `storage/`, `BankProvider` con Skeleton y ErrorState, `ErrorBoundary`, componentes base (`Button`, `Dialog`, `Tabs`, `Toast`, `EmptyState`).

Criterios de aceptación:
- A 320, 768, 1100 y 1440 px de ancho el shell coincide con 3.2 y no hay scroll horizontal.
- El tema persiste tras recargar y no hay parpadeo de tema al cargar; "Sistema" sigue al sistema operativo.
- Simular un fallo al pedir `core` muestra `ErrorState` con "Reintentar", y reintentar funciona.
- Con Tab se llega a todo; el enlace "Saltar al contenido" funciona; al navegar, el foco va al `h1`.
- `localStorage` con JSON corrupto no rompe la app (test).

### Fase 2 — Práctica
Alcance: `grading/grade`, `QuestionCard`, `StemRenderer`, `OptionItem`, `AnswerStatusBadge`, `ExplanationPanel`, `FilterBar`, `QuestionNavigator`, `progressStore`, sesión de práctica, atajos, pantalla de selección.

Criterios de aceptación:
- Tests de `grade`: única correcta e incorrecta; `msr-a080` con {B,C} correcta; {B}, {B,C,D}, {A,C} y {C,B} (esta última correcta); pregunta pendiente → `ungraded`; `scorable: false` → `ungraded`.
- `gor-cap1-0001`: elegir C y comprobar muestra "Correcto", etiqueta "Explicación del PDF (en inglés)", referencia "pág. 51" y tres entradas en "Por qué las otras opciones son incorrectas" (A, B, D).
- `msr-a080`: se ven 5 casillas, los 3 bloques del enunciado con el log en monoespaciado y scroll propio; "Comprobar" se habilita solo con 2 marcadas; la explicación lleva "Explicación generada por IA — no es del PDF" y no hay sección por opción; la referencia dice "clave rápida" y "pág. PDF 17 (impresa 33)".
- `gor-cap1-0023`: muestra "Pendiente de revisión" con el motivo literal de `review.reasons`; no hay verde ni rojo; después de "Ver lo que dice el PDF" los contadores de aciertos y errores no cambian (test).
- Un test con un fixture `ai_proposed` muestra la insignia "Respuesta propuesta por IA — requiere validación".
- El texto renderizado de enunciado y opciones es idéntico carácter por carácter al del banco (test sobre una muestra fija de 50 ids que incluya `msr-a052` y `msr-a080`, comparando `textContent`).
- El `<script>` del enunciado de `msr-a080` se ve como texto y no se ejecuta.
- Favorita, marcar y progreso persisten tras recargar. Los filtros Documento, Sección, Sin responder, Falladas, Marcadas, Pendientes de revisión y Solo favoritas devuelven los conteos esperados (tests de selectores).
- Todos los atajos de 5.4 funcionan y se pueden desactivar.
- Una sesión completa de 5 preguntas se puede hacer solo con teclado.

### Fase 3 — Fragmentos, visor de imágenes y PBQ
Alcance: `PdfFragmentModal`, `ImageViewer`, carga perezosa de `fragments/<section>`, pantallas PBQ.

Criterios de aceptación:
- En una pregunta de Gorgotsias el modal muestra el texto de `fragment.question` con sus saltos de renglón y el aviso de "texto extraído literal"; la pestaña Respuesta está bloqueada antes de comprobar y disponible después.
- En una pregunta de Messer el modal muestra la imagen de la página correcta; el zoom funciona con botones, teclado, Ctrl + rueda y pellizco, y la imagen ampliada se puede desplazar.
- El archivo de fragmentos se pide recién al abrir el modal y una sola vez por sección.
- El modal atrapa el foco, cierra con Esc y devuelve el foco al botón de origen.
- `/pbq` lista 5 soluciones con título literal; el detalle muestra todas sus imágenes (A1 y A2 tienen 2 páginas), la nota del banco, la transcripción desplegable y ningún control de respuesta ni puntaje.

### Fase 4 — Examen
Alcance: `buildExam`, `scoreAttempt`, `examStore`, configuración, examen en curso, `Timer`, resultados, `ResultSummary`, revisión.

Criterios de aceptación:
- Tests de `buildExam` con generador sembrado: nunca dos preguntas de la misma unidad; nunca una pregunta no puntuable; el máximo para "Ambos" es 583, Gorgotsias 538, Messer 45; `gor-sim6-0514` no aparece nunca y su unidad está representada por `gor-cap4-0414`; el orden de `options` no cambia.
- Durante el examen no aparece en el DOM ninguna insignia, explicación, origen ni indicación de acierto (test que busca esos textos).
- Recargar a mitad del examen lo restaura con respuestas, marcas, posición y tiempo restante.
- Con temporizador de 1 minuto, al llegar a cero se cierra solo y el resultado dice "Se terminó el tiempo".
- Resultado: `correctas + incorrectas + omitidas = total`; el porcentaje coincide con `correctas / total`; hay un caso de test con `msr-a080` respondida parcialmente que cuenta como incorrecta.
- La revisión muestra, por pregunta, la respuesta dada, la correcta, la explicación con su etiqueta de origen y el fragmento.
- El intento queda en el historial y sobrevive a recargar.

### Fase 5 — Repaso e historial
Alcance: pantalla Repaso con sus cuatro pestañas, sesiones de repaso, selector `getStudyState`.

Criterios de aceptación:
- Fallar una pregunta la agrega a Falladas; acertarla después la quita al terminar la sesión (test de selectores).
- Cada fila distingue con icono y texto Vista, Respondida sin corregir, Acertada y Fallada.
- Las tres listas y el historial tienen su estado vacío con acción.
- "Practicar las incorrectas" desde un resultado abre exactamente esos ids.

### Fase 6 — Dashboard, Ajustes e importación
Alcance: Dashboard completo, Ajustes, resumen y detalle de importación, exportar, importar y borrar, reconciliación de versiones.

Criterios de aceptación:
- Con almacenamiento vacío, el Dashboard no muestra ningún número de progreso inventado ni gráficos en cero; muestra el estado inicial de 3.3.
- La tabla de importación coincide celda por celda con `import-report.json` (test que la arma desde el JSON).
- La lista de pendientes muestra los 8 ids con su motivo y cada "Abrir" lleva a la pregunta.
- Tests de `reconcile`: mismo `bankVersion` (sin cambios); hash distinto (reinicia historial, conserva favorita y marca, activa `contentChanged`); id inexistente (pasa a `orphans`); examen activo incompatible (descartado); intentos históricos intactos.
- Exportar, borrar e importar el mismo archivo deja el estado idéntico al original (test de ida y vuelta).

### Fase 7 — Pulido, accesibilidad y rendimiento
Criterios de aceptación:
- `axe-core` sin infracciones serias ni críticas en Dashboard, Práctica (sin comprobar y comprobada), Examen en curso, Resultado, Repaso, PBQ y Ajustes, en ambos temas.
- Con `prefers-reduced-motion` no hay transiciones perceptibles.
- Zoom del navegador al 200 % a 1280 px: sin pérdida de contenido ni scroll horizontal.
- Lighthouse sobre `vite preview` en perfil móvil: Accesibilidad ≥ 95; la primera pantalla útil no espera a `explanations` ni a `fragments`.
- Revisión manual con lector de pantalla de una pregunta de práctica: se anuncian la posición, el estado de la respuesta, el resultado al comprobar y el origen de la explicación.

---

## 9. Checklist final de aceptación

Fidelidad del contenido
- [ ] Enunciados, opciones y explicaciones del PDF se muestran completos y literales; ninguna transformación de mayúsculas, recorte ni traducción.
- [ ] El orden de las opciones es el del banco en práctica, examen y revisión.
- [ ] Los bloques `code` conservan saltos de línea y espacios, en monoespaciado, con scroll horizontal propio.
- [ ] El contenido del banco se inserta siempre como texto; no hay `dangerouslySetInnerHTML` en el proyecto.
- [ ] `topic` y títulos de documento se muestran literales; no existe ninguna clasificación por dominio SY0-701.
- [ ] Texto del PDF con `lang="en"`; interfaz y explicaciones de IA con `lang="es"`.

Origen y estados
- [ ] Toda pregunta fuera del examen en curso muestra una de las tres insignias de estado de respuesta.
- [ ] Toda explicación lleva "Explicación del PDF (en inglés)" o "Explicación generada por IA — no es del PDF", con estilos claramente distintos.
- [ ] Las 8 pendientes muestran su motivo, no se corrigen, no entran en exámenes y no afectan ninguna estadística.
- [ ] El par `gor-cap4-0414` / `gor-sim6-0514` se muestra como conflicto en ambas preguntas y en Ajustes.
- [ ] La variante `ai_proposed` existe y está cubierta por un test con fixture.
- [ ] No hay números inventados, datos de ejemplo ni botones sin función en producción.

Corrección y puntuación
- [ ] Tests de `grade` para única, múltiple (todo o nada) y no puntuables.
- [ ] Tests de `buildExam`: deduplicación por `duplicates`, exclusión de no puntuables, máximos 583 / 538 / 45, opciones sin reordenar.
- [ ] La nota usa solo preguntas puntuables y la pantalla lo dice.
- [ ] No hay veredicto de aprobado o desaprobado.
- [ ] En examen no se revela nada hasta finalizar.

Persistencia
- [ ] Progreso, favoritas, marcas, preferencias, examen en curso e historial sobreviven a recargar.
- [ ] Cada intento guarda `bankVersion` y `contentHash` por pregunta.
- [ ] La reconciliación por cambio de banco funciona según 6.4 y avisa con conteos reales.
- [ ] JSON corrupto, cuota llena y `localStorage` no disponible no rompen la app.
- [ ] Exportar e importar hacen ida y vuelta sin pérdida.

Accesibilidad
- [ ] Todo es operable con teclado; foco visible en todos los controles.
- [ ] Contraste AA verificado por test sobre los tokens, en claro y oscuro.
- [ ] Ningún estado depende solo del color (icono + texto + estilo de borde).
- [ ] Modales con foco atrapado, Esc y retorno del foco.
- [ ] Regiones vivas para resultado, contador de filtros, avisos del temporizador y toasts.
- [ ] `prefers-reduced-motion` respetado.
- [ ] Atajos de una tecla desactivables.
- [ ] Imágenes con `alt` breve y transcripción disponible.
- [ ] Objetivos táctiles de 44 px como mínimo.

Responsive y rendimiento
- [ ] Correcto a 320, 375, 768, 1100, 1280 y 1440 px; sin scroll horizontal de página.
- [ ] Escritorio con barra lateral; tablet con barra angosta; móvil con navegación inferior y barra de acciones fija.
- [ ] Carga inicial sin fragmentos ni imágenes de página; explicaciones en segundo plano.
- [ ] Estados de carga, vacío y error en todas las pantallas que cargan o listan datos.

---

## 10. Información faltante / delegada al modelo de extracción

Nada de esto se resolvió consultando los PDF. Cada punto indica qué hace la app mientras tanto.

| # | Falta o duda | Efecto en el diseño | Qué se pide a extracción |
|---|---|---|---|
| 1 | Las imágenes de página de Messer miden 660 × 990 px | Al ampliar se ven borrosas; el visor limita el zoom a 300 % | Regenerar las 25 páginas a ≥ 1320 px de ancho (ideal 1980). La app no necesita cambios si se mantienen las rutas |
| 2 | No hay coordenadas de cada pregunta dentro de la página de Messer | El fragmento muestra la página entera con la ayuda "buscá la A80" | Opcional: caja `{x, y, w, h}` por pregunta y por respuesta para encuadrar o recortar |
| 3 | Gorgotsias no tiene imágenes de página | El fragmento es solo texto extraído; no hay verificación visual desde la app | Opcional: imágenes solo de las páginas de las 8 pendientes y del par en conflicto (≈ 20 páginas) para mostrar la contradicción |
| 4 | Las 8 pendientes siguen sin resolver y tienen `correct` cargado con una letra no confiable | La app la muestra como "letra que indica el PDF", sin corregir | Decisión humana por pregunta; si se resuelve, cambiar `review.status`, `answerStatus` y `scorable` en el banco (la app no tiene edición) |
| 5 | Explicaciones de Messer generadas por IA, sin `perOption` y sin validación humana | Rotuladas como IA, con aviso de que pueden contener errores; sin sección por opción | Opcional: `perOption` para las 45, validación, o confirmar si el PDF trae explicaciones detalladas de A46–A90 fuera del extracto |
| 6 | El extracto de Messer no incluye los enunciados de las PBQ A1–A5 ni las preguntas A6–A45 | PBQ solo como referencia; la tarjeta de Messer dice "A46–A90" | Si existe el documento completo, extraerlo; el modelo de datos ya lo soporta |
| 7 | El título del PDF de Gorgotsias menciona "PBQs" pero el banco no trae PBQ de ese documento | La sección PBQ muestra solo las 5 de Messer y lo dice | Confirmar si el PDF contiene PBQ y, de ser así, extraerlas al mismo formato de `bank.pbq` |
| 8 | No existe clasificación por dominio u objetivo de SY0-701 | Los filtros son por capítulo y simulador; no hay estadísticas por dominio | Ninguna obligatoria. No inventar la clasificación |
| 9 | Cinco grupos de duplicados difieren en detalles tipográficos del enunciado (`contentHash` distinto) | Se muestra cada copia como está; la deduplicación usa `duplicates` | Confirmar que son la misma pregunta (ya están marcadas así) |
| 10 | `similar` está vacío y `ai_proposed` no tiene casos reales | La UI de "propuesta por IA" se prueba con un fixture de test; no hay UI para `similar` | Si aparecen casos, avisar para diseñar la vista de "preguntas parecidas" |
| 11 | La duración por defecto del temporizador (1 minuto por pregunta) y los tamaños 10/25/45/90 no salen de los PDF | Son decisiones de producto, editables por el usuario; la app no afirma que reproduzcan el examen real | Ninguna |
| 12 | No hay equivalencia entre porcentaje de aciertos y la escala de puntaje del examen real | No se muestra aprobado ni desaprobado | Ninguna |
| 13 | Las explicaciones del PDF empiezan repitiendo el texto de la opción correcta ("Non-repudiation. Non-repudiation ensures…") | Se muestran tal cual, sin limpiar | Ninguna; es literal del PDF |
| 14 | La unión de renglones partidos por guion es una normalización de la extracción | El fragmento literal del modal permite contrastar con el texto original | Ninguna |
| 15 | El contenido proviene de libros con derechos de autor | La app está pensada para uso personal y local; `public/bank/` no se versiona ni se publica | Decisión del usuario antes de cualquier despliegue público |

---

## Ajustes al plan

Desvíos y precisiones introducidos durante la implementación (todo lo demás sigue el plan tal cual):

1. **Datos actuales.** Manda `data/import-report.json`/`bank.json`: 8 pendientes, 1177 puntuables, 586 unidades, 583 con copia puntuable. Las imágenes de página de Messer ahora miden **1200 × 1800 px** (no 660 × 990).
2. **Zoom del visor.** El nivel se expresa respecto del tamaño real de la imagen: 25 %–200 % en pasos de 25 %, con "Ajustar al ancho" como estado inicial y "Restablecer (100 %)" = tamaño real. La tecla `0` vuelve al 100 %. Con 1200 px de ancho, 200 % ya amplía bastante más que el 300 % previsto para 660 px.
3. **Foco al cambiar de ruta.** Se mueve al `h1` al cambiar de *pantalla*; pasar de una pregunta a otra dentro de práctica o revisión no mueve el foco (evita que Siguiente/Anterior saque al usuario del flujo con teclado). Los `h1` con foco programático no dibujan anillo (no son controles).
4. **Lista de práctica con la pregunta actual.** Si se abre `/practica/:id` con un filtro que no incluye esa pregunta (p. ej. tras recargar con "Sin responder"), la lista congelada se arma con el filtro y además la pregunta actual, en orden del banco.
5. **"Ver lo que dice el PDF" sin selección.** En una pendiente se puede revelar sin elegir opción; el intento `ungraded` solo se guarda si hubo selección.
6. **Repaso.** Las filas muestran una vista previa de 90 caracteres con el mismo corte por palabra, `title` y enlace a la pregunta completa (el plan permitía truncar solo en la lista de resultados). El rótulo de origen usa el `topic` completo y literal.
7. **i18n.** Los textos compartidos (insignias, rótulos de explicación, mensajes de corrección, filtros, atajos, avisos de almacenamiento) están en `src/i18n/es.ts`; parte del texto propio de cada pantalla quedó en el componente de la pantalla.
8. **Explicación en `ui/`.** `ExplanationPanel` recibe la referencia ya formateada (`sourceLabel`) en lugar de `source`, para que `ui/` no importe selectores de `bank/`.
9. **Fila de PBQ en la tabla extendida de Ajustes.** Se cuenta por documento a partir de `pbq.json` (todas de Messer).
10. **Contrastes.** Además de los pares de 2.1 se verifica la letra del chip sobre relleno verde/rojo (`--surface` sobre `--success-border`/`--danger-border`), que se usa en lugar de `--on-accent` porque el blanco sobre `#3BA872` no llega a 3:1 en oscuro.
11. **Tests en Node ≥ 25.** Vitest corre con `--no-experimental-webstorage` porque el `localStorage` propio de Node tapa al de jsdom.
12. **Accesibilidad verificada.** `axe-core` corre en tests de jsdom (sin `color-contrast`) y en Chromium real (con `color-contrast`) en ambos temas mediante `scripts/e2e.mjs`. No se ejecutaron Lighthouse ni una revisión con lector de pantalla real; el zoom de navegador al 200 % tampoco se probó explícitamente (sí 320–1440 px sin scroll horizontal).
13. **Router.** Se activan los *future flags* de React Router v7 (`v7_startTransition`, `v7_relativeSplatPath`) para no emitir advertencias en consola.
