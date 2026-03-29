import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: false, // preserve bas.js + bas.wasm from WASM build step
    lib: {
      entry: resolve(__dirname, 'src/main.js'),
      name: 'BasicApp',
      fileName: 'bundle',
      formats: ['iife'], // single self-executing bundle, no module system needed
    },
    rollupOptions: {
      output: {
        // Keep CSS in dist/ too
        assetFileNames: '[name][extname]',
      },
    },
  },
  base: './',
});
