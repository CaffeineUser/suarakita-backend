import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    fileParallelism: false,
    maxWorkers: 1,
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
});
