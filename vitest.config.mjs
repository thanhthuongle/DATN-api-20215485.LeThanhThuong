import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const sourceRoot = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '~': sourceRoot
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 120000,
    hookTimeout: 120000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/api/v2/**/*.js', 'src/v2/**/*.js']
    }
  }
})
