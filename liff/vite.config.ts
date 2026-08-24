import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/liff-app/',
  server: { port: 3000 },
  build: { outDir: '../public/liff-app', emptyOutDir: true },
});
