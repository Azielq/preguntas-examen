/** Textos de interfaz (español rioplatense, voseo). El contenido del PDF nunca pasa por aquí. */
export const es = {
  appName: 'Sec+ Práctica',
  skipLink: 'Saltar al contenido',
  nav: {
    label: 'Principal',
    home: 'Inicio',
    practice: 'Práctica',
    exam: 'Examen',
    review: 'Repaso',
    pbq: 'PBQ',
    settings: 'Ajustes',
    examRunningHidden: 'examen en curso',
  },
  theme: {
    toDark: 'Cambiar a tema oscuro',
    toLight: 'Cambiar a tema claro',
    system: 'Sistema',
    light: 'Claro',
    dark: 'Oscuro',
  },
  common: {
    loading: 'Cargando…',
    retry: 'Reintentar',
    reload: 'Recargar',
    cancel: 'Cancelar',
    close: 'Cerrar',
    previous: 'Anterior',
    next: 'Siguiente',
    finish: 'Terminar',
    open: 'Abrir',
    see: 'Ver',
  },
  bank: {
    loadError: 'No se pudo cargar el banco de preguntas.',
    technicalDetail: 'Detalle técnico',
  },
  badge: {
    pdf: 'Respuesta del PDF',
    ai_proposed: 'Respuesta propuesta por IA — requiere validación',
    pending: 'Pendiente de revisión',
    unknown: 'Estado de respuesta desconocido',
  },
  explanation: {
    pdf: 'Explicación del PDF (en inglés)',
    ai: 'Explicación generada por IA — no es del PDF',
    aiWarning: 'Puede contener errores. La respuesta correcta sí proviene del PDF.',
    perOption: 'Por qué las otras opciones son incorrectas',
    yourChoice: 'Tu elección',
    loadError: 'No se pudo cargar la explicación.',
    unreliable: 'Explicación del PDF — figura con este número, pero no corresponde a esta pregunta',
  },
  question: {
    optionsLegend: 'Opciones de respuesta',
    chooseN: (n: number) => `Elegí ${n}`,
    multipleHelp: (n: number, k: number) => `Elegí ${n} respuestas (${k} de ${n})`,
    multipleRule: 'Puntúa solo si marcás exactamente las correctas.',
    multipleRuleReview: 'Selección múltiple: todo o nada.',
    tooMany: (n: number) => `Ya elegiste ${n}. Desmarcá una para cambiar.`,
    chooseOne: 'Elegí una opción',
    check: 'Comprobar',
    retry: 'Reintentar',
    revealPdf: 'Ver lo que dice el PDF',
    viewFragment: 'Ver fragmento del PDF',
    alsoIn: 'También aparece en:',
    extractionNote: 'Nota de extracción',
    favoriteOn: 'Quitar de favoritas',
    favoriteOff: 'Agregar a favoritas',
    flagOn: 'Quitar marca de repaso',
    flagOff: 'Marcar para repasar',
    flagShort: 'Marcar',
    yourAnswerCorrect: 'Tu respuesta · Correcta',
    yourAnswerIncorrect: 'Tu respuesta · Incorrecta',
    correctAnswer: 'Respuesta correcta',
    yourAnswer: 'Tu respuesta',
    correct: 'Correcto',
    incorrect: 'Incorrecto',
    omitted: 'Omitida',
    resultCorrect: (sel: string) => `Elegiste ${sel}. Es la respuesta correcta.`,
    resultIncorrect: (sel: string, cor: string) => `Elegiste ${sel}. La respuesta correcta es ${cor}.`,
    resultOmitted: (cor: string) => `No respondiste. La respuesta correcta es ${cor}.`,
    pendingNotGraded: 'Esta pregunta no se corrige ni cuenta para la nota.',
    pendingReason: 'Motivo:',
    pendingReveal: (letters: string) =>
      `El PDF indica la letra ${letters}, pero la explicación asociada parece pertenecer a otra pregunta. No está validada.`,
    contentChanged: 'Esta pregunta cambió en el banco desde tu último intento; se reinició su historial.',
    clearAnswer: 'Borrar respuesta',
    examLabel: (n: number) => `Pregunta ${n}`,
    position: (i: number, n: number) => `${i} / ${n}`,
    positionLong: (i: number, n: number) => `Pregunta ${i} de ${n}`,
    lastTime: 'Última vez:',
    leavesFailed: 'Acertada: va a salir de Falladas.',
  },
  fragment: {
    title: (label: string) => `Fragmento del PDF · ${label}`,
    tabQuestion: (p: string) => `Pregunta (${p})`,
    tabAnswer: (p: string) => `Respuesta (${p})`,
    answerLocked: 'Disponible después de comprobar',
    textNotice: 'Texto extraído literal del PDF. No hay imagen de esta página.',
    copy: 'Copiar texto',
    copied: 'Texto copiado',
    loadError: 'No se pudo cargar el fragmento.',
  },
  image: {
    zoomIn: 'Acercar',
    zoomOut: 'Alejar',
    fit: 'Ajustar al ancho',
    reset: 'Restablecer (100 %)',
    level: (n: number) => `Zoom ${n} %`,
    loadError: 'No se pudo cargar la imagen de la página.',
  },
  filter: {
    doc: 'Documento',
    section: 'Sección',
    state: 'Estado',
    all: 'Todos',
    allF: 'Todas',
    unanswered: 'Sin responder',
    failed: 'Falladas',
    flagged: 'Marcadas',
    pendingReview: 'Pendientes de revisión',
    onlyFavorites: 'Solo favoritas',
    clear: 'Quitar filtros',
    count: (n: number) => (n === 1 ? '1 pregunta' : `${n} preguntas`),
    mobileButton: (n: number) => (n > 0 ? `Filtros (${n})` : 'Filtros'),
    apply: 'Aplicar',
    empty: 'Ninguna pregunta coincide con estos filtros',
    groupCap: 'Capítulos',
    groupSim: 'Simuladores',
    groupMesser: 'Messer',
  },
  navigator: {
    label: 'Preguntas',
    legend: 'Leyenda',
    unseen: 'sin ver',
    seen: 'vista',
    correct: 'acertada',
    incorrect: 'fallada',
    ungraded: 'pendiente de revisión, sin corregir',
    flagged: 'marcada',
    answered: 'respondida',
    unanswered: 'sin responder',
    partial: 'incompleta',
    omitted: 'omitida',
    current: 'actual',
    range: 'Rango',
    open: 'Abrir navegador de preguntas',
  },
  timer: {
    hide: 'Ocultar',
    show: 'Mostrar tiempo',
    five: 'Quedan 5 minutos',
    one: 'Queda 1 minuto',
    low: 'Queda poco tiempo',
    label: 'Tiempo restante',
  },
  shortcuts: {
    title: 'Atajos de teclado',
    open: 'Ver atajos',
    rows: [
      ['1–9', 'Elegir o alternar la opción n'],
      ['A–E', 'Elegir o alternar la opción por letra'],
      ['↑ / ↓', 'Moverse entre opciones'],
      ['Espacio', 'Marcar la opción enfocada'],
      ['Enter', 'Práctica: Comprobar, o Siguiente si ya está comprobada. Examen: Siguiente'],
      ['← / →', 'Pregunta anterior / siguiente'],
      ['P / N', 'Anterior / siguiente'],
      ['R', 'Reintentar (práctica comprobada)'],
      ['F', 'Favorita (no en examen)'],
      ['M', 'Marcar para repasar'],
      ['V', 'Ver fragmento del PDF (no en examen)'],
      ['G', 'Abrir el navegador de preguntas'],
      ['?', 'Esta ayuda'],
      ['Esc', 'Cerrar modal, hoja o panel'],
    ] as [string, string][],
    singleKeyNote: 'Los atajos de una sola tecla (letras, números y ?) se pueden desactivar en Ajustes.',
  },
  study: {
    unseen: 'Sin ver',
    seen: 'Vista, sin responder',
    ungraded: 'Respondida, sin corregir',
    correct: 'Acertada',
    incorrect: 'Fallada',
  },
  notFound: {
    title: 'No encontramos esta página',
    description: 'La dirección no corresponde a ninguna pantalla de la app.',
    action: 'Ir al inicio',
    question: 'Esa pregunta no existe en el banco actual',
  },
  storage: {
    corrupt: 'No se pudo leer tu progreso guardado; se guardó una copia.',
    quota: 'No hay espacio para guardar el progreso. Exportalo desde Ajustes para no perderlo.',
    unavailable: 'Este navegador no permite guardar datos: el progreso se perderá al cerrar la pestaña.',
    examDiscarded: 'El examen en curso se descartó porque el banco cambió.',
    otherTab: 'El examen se está rindiendo en otra pestaña.',
  },
};

export type Es = typeof es;

export function relTime(ts: number, now = Date.now()): string {
  const d = Math.floor((now - ts) / 1000);
  if (d < 60) return 'hace un momento';
  const m = Math.floor(d / 60);
  if (m < 60) return m === 1 ? 'hace 1 minuto' : `hace ${m} minutos`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? 'hace 1 hora' : `hace ${h} horas`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  return formatDate(ts);
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function joinLetters(ls: string[]): string {
  const s = ls.slice().sort();
  if (s.length <= 1) return s.join('');
  return `${s.slice(0, -1).join(', ')} y ${s[s.length - 1]}`;
}
