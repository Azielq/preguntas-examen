import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const restrict = (patterns) => ['error', { patterns }];

export default tseslint.config(
  { ignores: ['dist', 'public/bank', 'node_modules', 'data', 'scripts/__pycache__'] },
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
    files: ['src/grading/**'],
    rules: {
      'no-restricted-imports': restrict([
        { group: ['**/storage/**', '**/state/**', '**/ui/**', 'react', 'react-dom'], message: 'grading/ es lógica pura.' },
      ]),
    },
  },
  {
    files: ['src/bank/**'],
    rules: {
      'no-restricted-imports': restrict([{ group: ['**/storage/**', '**/state/**'], message: 'bank/ no depende de storage/ ni state/.' }]),
    },
  },
  {
    files: ['src/ui/**'],
    rules: {
      'no-restricted-imports': restrict([
        { group: ['**/state/**', '**/storage/**', '**/bank/loadBank', '**/bank/BankProvider', '**/bank/indexes', '**/bank/selectors'], message: 'ui/ solo recibe datos por props (y tipos de bank/types).' },
      ]),
    },
  },
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.{js,ts}'],
    // e2e.mjs evalúa funciones dentro del navegador (page.evaluate)
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
