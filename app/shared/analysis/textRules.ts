/**
 * Reglas sobre el texto que genera la IA (PLAN-IA 6.1.4). Puro y compartido por servidor y cliente.
 * Un texto que incumple alguna regla invalida toda la salida (no se repara).
 */
export type TextViolation = 'url' | 'domain' | 'html' | 'page' | 'option_letter' | 'control_char';

const RULES: [TextViolation, RegExp][] = [
  ['url', /https?:\/\/|\bwww\./i],
  // dominio con TLD frecuente: example.com, docs.vendor.io, sitio.com.ar
  ['domain', /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|edu|gov|dev|app|ai|co|info|biz|me|ly|tv|us|uk|es|ar|mx)\b/i],
  // "<" seguido de letra, "/" o "!" (etiqueta, cierre o comentario HTML)
  ['html', /<[A-Za-z/!]/],
  // pág. 51, página 12, page 3, pages 4-5, p. 7 (siempre con número: "página web" no es una referencia)
  // ("p." exige el punto para no confundir "P2P").
  ['page', /(?:^|[^\p{L}\p{N}])(?:p[aá]g(?:ina)?s?\.?|pages?|p\.)\s*\d/iu],
  // "opción B", "option C", "letra A", "respuesta D", "opciones A y C"; la letra va aislada y en mayúscula
  ['option_letter', /(?:^|[^\p{L}\p{N}])(?:[Oo]pci[oó]n(?:es)?|[Oo]ptions?|[Ll]etras?|[Rr]espuestas?)\s+\(?[A-H]\)?(?![\p{L}\p{N}/])/u],
];

/** Caracteres de control (se permiten salto de línea, retorno de carro y tabulación). */
function hasControlChar(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0x7f) return true;
  }
  return false;
}

export function textViolations(text: string): TextViolation[] {
  const out: TextViolation[] = [];
  for (const [code, re] of RULES) if (re.test(text)) out.push(code);
  if (hasControlChar(text)) out.push('control_char');
  return out;
}

export function isCleanText(text: string): boolean {
  return textViolations(text).length === 0;
}
