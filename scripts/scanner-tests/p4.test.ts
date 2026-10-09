import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeRepository } from '../../netlify/scanner-core/analyze.ts'
import { makeSource } from './make-source.ts'

test('[P4] C28 Monorepo with multiple .env.example files', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'monorepo',
      private: true,
    }),
    'apps/web/package.json': JSON.stringify({
      name: 'web',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    'apps/web/.env.example': 'VITE_API_URL=\n',
    'packages/backend/.env.example': 'DATABASE_URL=\n',
    'apps/web/index.html': '<html><body></body></html>',
    'apps/web/src/main.ts': 'const url = import.meta.env.VITE_API_URL',
  })

  const report = await analyzeRepository(source)

  assert.equal(report.detectedConfig.envExampleExists, true)
  assert.ok(!report.issues.some((i) => i.title.includes('Missing .env.example')), 'Should not raise Missing .env.example')
})

test('[P4] C29 Code reads only Vite built-ins', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'vite-app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    'index.html': '<html><body></body></html>',
    'src/main.ts': `
      const isDev = import.meta.env.DEV
      const isProd = import.meta.env.PROD
      const mode = import.meta.env.MODE
      const base = import.meta.env.BASE_URL
      const ssr = import.meta.env.SSR
    `,
  })

  const report = await analyzeRepository(source)

  assert.equal(report.detectedConfig.referencedEnvVars.length, 0)
  assert.ok(!report.issues.some((i) => i.title.includes('.env.example')), 'No env issue should be raised for Vite built-ins')
})

test('[P4] C30 Code reads system env vars and config-only vars', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    'vite.config.ts': 'export default { define: { hmr: process.env.DISABLE_HMR } }',
    'src/main.ts': 'const tmp = process.env.TMPDIR',
    'index.html': '<html><body></body></html>',
  })

  const report = await analyzeRepository(source)

  assert.equal(report.detectedConfig.referencedEnvVars.length, 0)
  assert.ok(!report.issues.some((i) => i.title.includes('.env.example')), 'System and config-only vars should not trigger env issues')
})

test('[P4] C31 Optional variable with inline fallback', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    'src/ai.ts': "const model = process.env.NVIDIA_CHAT_MODEL || 'a-default'",
    'index.html': '<html><body></body></html>',
  })

  const report = await analyzeRepository(source)

  assert.equal(report.detectedConfig.referencedEnvVars.length, 0)
  assert.ok(!report.issues.some((i) => i.title.includes('.env.example')), 'Optional variable with inline default is not required')
})

test('[P4] C32 Alias chain with documented variable', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    '.env.example': 'VITE_SUPABASE_URL=\n',
    'src/db.ts': 'const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL',
    'index.html': '<html><body></body></html>',
  })

  const report = await analyzeRepository(source)

  assert.ok(!report.issues.some((i) => i.title.includes('Undocumented environment variables')), 'Documenting one alias resolves the chain')
})

test('[P4] C33 [control] Vite + Supabase without .env.example', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    'src/main.ts': `
      const url = import.meta.env.VITE_SUPABASE_URL
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    `,
    'index.html': '<html><body></body></html>',
  })

  const report = await analyzeRepository(source)

  const envIssue = report.issues.find((i) => i.title.includes('Missing .env.example'))
  assert.ok(envIssue, 'Should raise Missing .env.example')
  assert.ok(envIssue.snippet.includes('VITE_SUPABASE_URL='))
  assert.ok(envIssue.snippet.includes('VITE_SUPABASE_ANON_KEY='))
})

test('[P4] C34 Server and client variables read separately are both listed', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    'src/client.ts': 'const url = import.meta.env.VITE_SUPABASE_URL',
    'src/server.ts': 'const sUrl = process.env.SUPABASE_URL',
    'index.html': '<html><body></body></html>',
  })

  const report = await analyzeRepository(source)

  assert.deepEqual(report.detectedConfig.referencedEnvVars.sort(), ['SUPABASE_URL', 'VITE_SUPABASE_URL'])
})

test('[P4] C35 Standard hosting system variables ignored', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    'src/main.ts': 'const u = process.env.URL; const d = process.env.DEPLOY_PRIME_URL',
    'index.html': '<html><body></body></html>',
  })

  const report = await analyzeRepository(source)

  assert.equal(report.detectedConfig.referencedEnvVars.length, 0)
})
