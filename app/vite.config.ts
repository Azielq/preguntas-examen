/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: false },
  preview: { port: 4173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 800 },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,mjs}'],
    testTimeout: 30000,
    // Node ≥ 25 expone un localStorage global propio que tapa el de jsdom.
    poolOptions: { forks: { execArgv: ['--no-experimental-webstorage'] }, threads: { execArgv: ['--no-experimental-webstorage'] } },
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
