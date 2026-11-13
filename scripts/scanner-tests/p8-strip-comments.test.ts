import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeRepository } from '../../netlify/scanner-core/analyze.ts'
import { makeSource } from './make-source.ts'

test('[P8] Supabase URL is preserved while stripping comments', async () => {
  const fakeSupabaseKey = `eyJ${'a'.repeat(60)}`
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'vite-app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    'index.html': '<html><body></body></html>',
    'src/lib/supabase.js': `// a comment
export const supabase = createClient(
  'https://demo-fake-project.supabase.co',
  '${fakeSupabaseKey}'
)`,
  })

  const report = await analyzeRepository(source)

  assert.ok(
    report.issues.some((issue) => issue.title.startsWith('Hardcoded Supabase API key')),
    'Should report a hardcoded Supabase API key when the URL contains //',
  )
})

test('[P8] Line comments containing Supabase-shaped keys are ignored', async () => {
  const fakeSupabaseKey = `eyJ${'a'.repeat(60)}`
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'vite-app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    'index.html': '<html><body></body></html>',
    'src/lib/supabase.js': `// createClient('https://demo-fake-project.supabase.co', '${fakeSupabaseKey}')`,
  })

  const report = await analyzeRepository(source)

  assert.ok(
    !report.issues.some((issue) => issue.title.startsWith('Hardcoded Supabase API key')),
    'Should not report a key-shaped string inside a line comment',
  )
})
