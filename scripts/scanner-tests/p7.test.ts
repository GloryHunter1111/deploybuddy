import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeRepository } from '../../netlify/scanner-core/analyze.ts'
import { makeSource } from './make-source.ts'

test('[P7] C42 Turborepo grouping variables and tooling separation', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'turborepo',
      private: true,
    }),
    'apps/web/package.json': JSON.stringify({
      name: 'web',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    'apps/web/index.html': '<html><body></body></html>',
    'apps/web/src/main.ts': 'const webKey = import.meta.env.VITE_FRONTEND_KEY',
    'packages/backend/src/server.ts': 'const backendDb = process.env.BACKEND_DB_URL',
    'scripts/seed.ts': 'const seedKey = process.env.SUPABASE_SERVICE_ROLE_KEY',
  })

  const report = await analyzeRepository(source)

  const envIssue = report.issues.find((i) => i.title.includes('.env.example'))
  assert.ok(envIssue, 'Should have .env.example issue')
  assert.ok(envIssue.snippet.includes('apps/web') || envIssue.snippet.includes('web'), 'Snippet should group by workspace folder')
  assert.ok(
    envIssue.snippet.includes('# Used only by scripts or tooling (probably not needed on your web host)'),
    'Tooling variable should be under tooling header',
  )
})
