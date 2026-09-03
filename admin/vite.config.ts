import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

const commitHash = execSync('git rev-parse --short HEAD').toString().trim();

export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  server: {
    port: 3001,
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } },
  },
  build: { outDir: '../public/admin-app', emptyOutDir: true },
  define: { __COMMIT_HASH__: JSON.stringify(commitHash) },
});
