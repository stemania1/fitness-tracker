import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      // Coverage currently only tracks .ts files. Component tests need
      // @testing-library/react + jsdom; until those land, .tsx files have
      // no path to coverage and would only inflate the denominator.
      // Re-include 'src/**/*.tsx' here when component tests come online.
      exclude: [
        // Type-only / declaration files
        'src/**/*.d.ts',
        'src/types/**',
        // Tests themselves
        'src/**/*.test.ts',
        // Static catalogs — invariants are tested in exercises.test.ts;
        // the data itself is just literals.
        'src/data/**',
        // Thin Next.js middleware shim — logic lives in lib/supabase/middleware.ts.
        'src/middleware.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
