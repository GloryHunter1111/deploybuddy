import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeRepository } from '../../netlify/scanner-core/analyze.ts'
import { makeSource } from './make-source.ts'

test('[P6] C39 Predictable default for secret variable', async () => {
  const fakeSecretLiteral = 'k9Zq2xTt8LmN4vB7cR1w'
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    'src/server/auth.ts': `const JWT_SECRET = process.env.JWT_SECRET || '${fakeSecretLiteral}'`,
    'index.html': '<html><body></body></html>',
  })

  const report = await analyzeRepository(source)

  const defaultIssue = report.issues.find((i) => i.title === 'Predictable default for JWT_SECRET')
  assert.ok(defaultIssue, 'Should flag warning "Predictable default for JWT_SECRET"')
  assert.equal(defaultIssue.severity, 'warning')
  assert.ok(defaultIssue.description.includes('src/server/auth.ts'))

  const jsonReport = JSON.stringify(report)
  assert.ok(!jsonReport.includes(fakeSecretLiteral), 'Secret literal default must not appear anywhere in report')
})

test('[P6] C40 Short, empty or placeholder defaults ignored', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    'src/config.ts': `
      const a = process.env.API_KEY || ''
      const b = process.env.SECRET || 'changeme'
      const c = process.env.TOKEN || 'your_token'
      const d = process.env.PASSWORD || 'http://localhost:3000'
    `,
    'index.html': '<html><body></body></html>',
  })

  const report = await analyzeRepository(source)

  assert.ok(
    !report.issues.some((i) => i.title.startsWith('Predictable default for')),
    'Short, empty or placeholder defaults should be ignored',
  )
})

test('[P6] C41 Predictable default inside test file ignored', async () => {
  const fakeSecretLiteral = 'k9Zq2xTt8LmN4vB7cR1w'
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    'tests/auth.test.ts': `const JWT_SECRET = process.env.JWT_SECRET || '${fakeSecretLiteral}'`,
    'index.html': '<html><body></body></html>',
  })

  const report = await analyzeRepository(source)

  assert.ok(
    !report.issues.some((i) => i.title.startsWith('Predictable default for')),
    'Test files should be excluded from predictable default checks',
  )
})
