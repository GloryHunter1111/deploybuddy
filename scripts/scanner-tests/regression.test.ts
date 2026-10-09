import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeRepository } from '../../netlify/scanner-core/analyze.ts'
import { makeSource } from './make-source.ts'

test('[Regression] C43 Complete, well-configured Vite + Supabase app has ZERO issues', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'well-configured-app',
      dependencies: {
        vite: '^5.0.0',
        'react-router-dom': '^6.0.0',
        '@supabase/supabase-js': '^2.0.0',
      },
      scripts: {
        build: 'vite build',
      },
    }),
    'netlify.toml': `[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`,
    '.env.example': `VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
`,
    '.gitignore': `.env
.env.local
node_modules
`,
    'index.html': '<!DOCTYPE html><html><body><div id="root"></div></body></html>',
    'src/main.tsx': `
      import { createClient } from '@supabase/supabase-js'
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      )
    `,
  })

  const report = await analyzeRepository(source)

  assert.equal(report.issues.length, 0, `Expected 0 issues, but got: ${report.issues.map((i) => i.title).join(', ')}`)
})

test('[Regression] C44 Hardcoded secret in source file is still flagged', async () => {
  // Using an obviously fake OpenAI Project API Key structure
  const fakeKey = 'sk-proj-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6'
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    'index.html': '<html><body></body></html>',
    'src/api.ts': `const apiKey = '${fakeKey}'`,
  })

  const report = await analyzeRepository(source)

  const secretIssue = report.issues.find((i) => i.title.includes('Hardcoded') || i.title.includes('OpenAI'))
  assert.ok(secretIssue, 'Should flag hardcoded OpenAI key in source file')
  assert.equal(secretIssue.severity, 'warning')
})
