import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC compiles tests so NestJS decorator metadata (required for DI) is emitted,
// which Vitest's default esbuild/oxc transform does not do.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/**/*.int-spec.ts'],
          // First run downloads the mongod binary for mongodb-memory-server.
          testTimeout: 30_000,
          hookTimeout: 180_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
