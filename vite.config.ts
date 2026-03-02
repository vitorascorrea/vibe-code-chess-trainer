import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/vibe-code-chess-trainer/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.test.ts'],
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
