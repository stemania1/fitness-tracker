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
        // Browser-only canvas glue — exercised via the mocked component test.
        'src/lib/image-resize.ts',
        // Static PWA manifest + generated icon routes — no logic to test.
        'src/app/manifest.ts',
        'src/app/apple-icon.tsx',
      ],
      // Thresholds are set ~2 points below current coverage so noise from a
      // single new file doesn't break CI, but a meaningful drop does.
      // Ratchet these up as coverage grows.
      thresholds: {
        statements: 80,
        branches: 78,
        functions: 68,
        lines: 81,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
