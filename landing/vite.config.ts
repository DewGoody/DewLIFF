import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/landingpage/',
  build: {
    outDir: '../public/landing-app',
    emptyOutDir: true,
  },
})
