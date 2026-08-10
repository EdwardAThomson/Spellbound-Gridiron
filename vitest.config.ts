import path from 'path';
import { defineConfig } from 'vitest/config';

// Vitest owns the unit layer. Tests live beside the code as `*.test.ts` and
// exercise the pure logic in `services/rules.ts`. The Playwright e2e specs
// (`e2e/*.spec.ts`) are excluded so the two runners never collide.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', 'dist/**', 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
