import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

const commitHash = execSync('git rev-parse --short HEAD').toString().trim();

export default defineConfig({
  plugins: [react()],
  base: '/liff-app/',
  server: { port: 3000 },
  build: { outDir: '../public/liff-app', emptyOutDir: true },
  define: { __COMMIT_HASH__: JSON.stringify(commitHash) },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
});
