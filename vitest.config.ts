import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // Tests under src/components opt into jsdom via a per-file
    // `// @vitest-environment jsdom` directive. Keeping the default at
    // 'node' avoids the jsdom startup cost for the bulk of the suite.
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Type-only / declaration files
        'src/**/*.d.ts',
        'src/types/**',
        // Tests themselves
        'src/**/*.test.{ts,tsx}',
        // Next.js pages and layouts — UI shells, not component-tested yet.
        // Add specific files back in once they have tests.
        'src/app/**/layout.tsx',
        'src/app/**/page.tsx',
        'src/app/**/milestones.tsx',
        // shadcn/ui primitives — vendored, covered by the upstream library.
        'src/components/ui/**',
        // Static catalogs — invariants are tested separately.
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
