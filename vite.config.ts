import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps the build portable: it runs from any sub-path
// (GitHub Pages, a NAS, a TV box web view or a Capacitor/Electron shell).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
});
