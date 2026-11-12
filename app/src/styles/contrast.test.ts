import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, 'tokens.css'), 'utf8');

function block(selectorStart: string): Record<string, string> {
  const i = css.indexOf(selectorStart);
  const body = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]!] = m[2]!;
  return out;
}

const themes = {
  light: block(":root,\n:root[data-theme='light']"),
  dark: block(":root[data-theme='dark']"),
};

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
export function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

/** Pares de PLAN 2.1 (texto/fondo o componente/fondo) con su mínimo. */
const PAIRS: [string, string, number][] = [
  ...['bg', 'surface', 'surface-2'].flatMap((bg) => [
    ['text', bg, 4.5] as [string, string, number],
    ['text-muted', bg, 4.5] as [string, string, number],
    ['text-subtle', bg, 4.5] as [string, string, number],
    ['border-strong', bg, 3] as [string, string, number],
    ['focus', bg, 3] as [string, string, number],
  ]),
  ['on-accent', 'accent', 4.5],
  ['on-accent', 'accent-hover', 4.5],
  ['accent-text', 'surface', 4.5],
  ['accent-text', 'bg', 4.5],
  ['accent-text', 'accent-soft', 4.5],
  ['text', 'accent-soft', 4.5],
  ['success', 'surface', 4.5],
  ['success', 'success-soft', 4.5],
  ['danger', 'surface', 4.5],
  ['danger', 'danger-soft', 4.5],
  ['warning', 'surface', 4.5],
  ['warning', 'warning-soft', 4.5],
  ['info', 'surface', 4.5],
  ['info', 'info-soft', 4.5],
  ['text', 'success-soft', 4.5],
  ['text', 'danger-soft', 4.5],
  ['text', 'warning-soft', 4.5],
  ['text', 'info-soft', 4.5],
  ['success-border', 'success-soft', 3],
  ['danger-border', 'danger-soft', 3],
  ['warning-border', 'warning-soft', 3],
  ['info-border', 'info-soft', 3],
  ['accent', 'surface', 3],
  ['accent', 'bg', 3],
  // agregados por la implementación: letra del chip sobre relleno verde/rojo (OptionItem)
  ['surface', 'success-border', 3],
  ['surface', 'danger-border', 3],
];

describe('contraste de tokens (WCAG 2.x)', () => {
  for (const [name, t] of Object.entries(themes)) {
    it(`tema ${name}: todos los pares cumplen el mínimo`, () => {
      expect(Object.keys(t).length).toBeGreaterThan(20);
      const fails = PAIRS.filter(([a, b, min]) => contrast(t[a]!, t[b]!) < min).map(([a, b, min]) => `${a}/${b}=${contrast(t[a]!, t[b]!).toFixed(2)}<${min}`);
      expect(fails).toEqual([]);
    });
  }
});
