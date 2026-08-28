// Vitest setup file (referenced by liff/vite.config.ts's `test.setupFiles`).
// Kept minimal — KimLIFF's own current state has this test scaffolding (vitest,
// @testing-library/*, happy-dom) wired up in package.json/vite.config.ts but no
// actual *.test.tsx files yet, so this file only needs to make jest-dom's
// matchers available for whenever tests are added.
import '@testing-library/jest-dom/vitest';
