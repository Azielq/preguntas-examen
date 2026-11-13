import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const restrict = (patterns) => ['error', { patterns }];

// src/ (navegador) nunca importa código del servidor ni el SDK del proveedor de IA (PLAN-IA 2.1).
const SRC_BASE = [
  { group: ['**/server', '**/server/**', '**/api', '**/api/**', '@anthropic-ai/*', '@anthropic-ai/**'], message: 'src/ no importa server/, api/ ni @anthropic-ai/sdk (solo servidor).' },
];

export default tseslint.config(
  { ignores: ['dist', 'public/bank', 'node_modules', 'data', 'scripts/__pycache__', 'server/_generated/*.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-syntax': [
        'error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'Prohibido: el banco se muestra siempre como texto.' },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**'],
    rules: { 'no-restricted-imports': restrict(SRC_BASE) },
  },
  {
    files: ['src/grading/**'],
    rules: {
      'no-restricted-imports': restrict([
        ...SRC_BASE,
        { group: ['**/storage/**', '**/state/**', '**/ui/**', 'react', 'react-dom'], message: 'grading/ es lógica pura.' },
      ]),
    },
  },
  {
    files: ['src/bank/**'],
    rules: {
      'no-restricted-imports': restrict([...SRC_BASE, { group: ['**/storage/**', '**/state/**'], message: 'bank/ no depende de storage/ ni state/.' }]),
    },
  },
  {
    files: ['src/ui/**'],
    rules: {
      'no-restricted-imports': restrict([
        ...SRC_BASE,
        { group: ['**/state/**', '**/storage/**', '**/bank/loadBank', '**/bank/BankProvider', '**/bank/indexes', '**/bank/selectors'], message: 'ui/ solo recibe datos por props (y tipos de bank/types).' },
      ]),
    },
  },
  {
    // Servidor: solo Node. Puede usar shared/, src/grading y src/bank/types (puros).
    files: ['server/**/*.ts', 'api/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-restricted-imports': restrict([
        { group: ['react', 'react-dom', 'react-router-dom', 'zustand', 'lucide-react'], message: 'server/ y api/ no usan librerías de interfaz.' },
        { group: ['**/src/ui/**', '**/src/state/**', '**/src/storage/**', '**/src/features/**', '**/src/hooks/**', '**/src/i18n/**'], message: 'server/ y api/ solo importan shared/, src/grading y src/bank/types.' },
      ]),
    },
  },
  {
    // shared/: puro, sin dependencias fuera de shared/ salvo los tipos de src/bank/types.
    files: ['shared/**/*.ts'],
    ignores: ['shared/**/*.test.ts'],
    rules: {
      'no-restricted-imports': restrict([
        { regex: '(^|/)src/(?!bank/types(\\.js)?$)', message: 'shared/ solo importa tipos de src/bank/types.' },
        { group: ['**/server/**', '**/api/**', 'react', 'react-dom', 'zustand', '@anthropic-ai/*', 'node:*'], message: 'shared/ es puro y sin dependencias.' },
      ]),
    },
  },
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.{js,ts}'],
    // e2e.mjs evalúa funciones dentro del navegador (page.evaluate)
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
