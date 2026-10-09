import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeRepository } from '../../netlify/scanner-core/analyze.ts'
import { makeSource } from './make-source.ts'

test('[P3] C22 fixtures/foo/.env with a real-looking SECRET_KEY', async () => {
  const fakeSecret = 'k9Zq2xTt8LmN4vB7cR1wY6pD'
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    'fixtures/foo/.env': `SECRET_KEY=${fakeSecret}`,
    'index.html': '<html><body></body></html>',
  })

  const report = await analyzeRepository(source)

  assert.ok(!report.issues.some((i) => i.title.includes('committed') || i.title.includes('fixture')), 'Fixtures .env should be excluded')
})

test('[P3] C23 .devcontainer/.env unignored in .gitignore', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    '.gitignore': '!.devcontainer/.env\nnode_modules\n',
    '.devcontainer/.env': 'CONTAINER_USER=vscode\nCONTAINER_HOME=/home/vscode\n',
    'index.html': '<html><body></body></html>',
  })

  const report = await analyzeRepository(source)

  assert.ok(!report.issues.some((i) => i.title.includes('.devcontainer/.env')), 'Un-ignored .devcontainer/.env should raise nothing')
})

test('[P3] C24 .env with SUPABASE_SERVICE_ROLE_KEY', async () => {
  const fakeSecret = 'k9Zq2xTt8LmN4vB7cR1wY6pD'
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    '.env': `SUPABASE_SERVICE_ROLE_KEY=${fakeSecret}\n`,
    'index.html': '<html><body></body></html>',
  })

  const report = await analyzeRepository(source)

  const criticalIssue = report.issues.find((i) => i.title === 'Supabase service-role key committed in .env')
  assert.ok(criticalIssue, 'Should flag critical Supabase service-role key in .env')
  assert.equal(criticalIssue.severity, 'critical')
  
  const jsonReport = JSON.stringify(report)
  assert.ok(!jsonReport.includes(fakeSecret), 'Secret value must never appear anywhere in the report')
})

test('[P3] C25 .env with STRIPE_SECRET_KEY', async () => {
  const fakeSecret = 'k9Zq2xTt8LmN4vB7cR1wY6pD'
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    '.env': `STRIPE_SECRET_KEY=${fakeSecret}\n`,
    'index.html': '<html><body></body></html>',
  })

  const report = await analyzeRepository(source)

  const warningIssue = report.issues.find((i) => i.title === 'Secrets committed in .env')
  assert.ok(warningIssue, 'Should flag warning Secrets committed in .env')
  assert.equal(warningIssue.severity, 'warning')

  const jsonReport = JSON.stringify(report)
  assert.ok(!jsonReport.includes(fakeSecret), 'Secret value must not appear in JSON')
})

test('[P3] C26 .env with only VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    '.env': 'VITE_SUPABASE_URL=https://xyzcompany.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-fake-anon\n',
    'index.html': '<html><body></body></html>',
  })

  const report = await analyzeRepository(source)

  const envIssue = report.issues.find((i) => i.title.includes('Environment file committed (.env)'))
  assert.ok(envIssue, 'Should flag info for committed env with no secrets')
  assert.equal(envIssue.severity, 'info')
  assert.equal(envIssue.title, 'Environment file committed (.env): no secrets detected')
})

test('[P3] C27 .env with API_KEY=your_api_key_here placeholder', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    '.env': 'API_KEY=your_api_key_here\n',
    'index.html': '<html><body></body></html>',
  })

  const report = await analyzeRepository(source)

  assert.ok(!report.issues.some((i) => (i.severity === 'warning' || i.severity === 'critical') && i.title.includes('.env')), 'Placeholder value should not trigger warning or critical')
})
