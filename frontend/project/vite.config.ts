/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
let appVersion = process.env.COMMIT_REF || '';
try { appVersion ||= execSync('git rev-parse --short HEAD').toString().trim(); } catch { appVersion ||= 'local'; }

// https://vitejs.dev/config/
export default defineConfig({
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion) },
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  publicDir: 'public',
  build: {
    outDir: 'dist',
    copyPublicDir: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/tests/**', '**/playwright/**'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
});
