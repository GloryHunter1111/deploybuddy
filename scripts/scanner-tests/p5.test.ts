import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeRepository } from '../../netlify/scanner-core/analyze.ts'
import { makeSource } from './make-source.ts'

test('[P5] C36 High-priority api/ file found among 60 files', async () => {
  const files: Record<string, string> = {
    'package.json': JSON.stringify({
      name: 'large-app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    'index.html': '<html><body></body></html>',
    'api/send.js': 'export default function handler() { const url = process.env.UPSTASH_REDIS_REST_URL }',
  }

  for (let i = 1; i <= 60; i++) {
    files[`src/components/Comp${i}.tsx`] = `export const Comp${i} = () => <div>${i}</div>`
  }

  const source = makeSource(files)
  const report = await analyzeRepository(source)

  assert.ok(
    report.detectedConfig.referencedEnvVars.includes('UPSTASH_REDIS_REST_URL'),
    'Should discover UPSTASH_REDIS_REST_URL from prioritized api/ file',
  )
})

test('[P5] C37 Prioritized netlify/functions/ file found', async () => {
  const files: Record<string, string> = {
    'package.json': JSON.stringify({
      name: 'large-app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    'index.html': '<html><body></body></html>',
    'netlify/functions/webhook.js': 'const key = process.env.SUPABASE_SERVICE_ROLE_KEY',
  }

  for (let i = 1; i <= 60; i++) {
    files[`src/views/View${i}.tsx`] = `export const View${i} = () => <div>${i}</div>`
  }

  const source = makeSource(files)
  const report = await analyzeRepository(source)

  assert.ok(
    report.detectedConfig.referencedEnvVars.includes('SUPABASE_SERVICE_ROLE_KEY'),
    'Should discover SUPABASE_SERVICE_ROLE_KEY from prioritized netlify/functions/ file',
  )
})

test('[P5] C38 Graceful timeout after 7 seconds returns partial report', async () => {
  let virtualTime = 0
  const files: Record<string, string> = {
    'package.json': JSON.stringify({
      name: 'timeout-app',
      dependencies: { vite: '^5.0.0' },
      scripts: { build: 'vite build' },
    }),
    'index.html': '<html><body></body></html>',
    'src/found.ts': 'const a = process.env.MY_EARLY_VAR',
    'src/late.ts': 'const b = process.env.MY_LATE_VAR',
  }

  const source = makeSource(files, {
    now: () => {
      // Advance virtual clock beyond 7000ms after first batch
      virtualTime += 4000
      return virtualTime
    },
  })

  const report = await analyzeRepository(source)

  assert.ok(report, 'Report should be returned without throwing')
  assert.ok(
    report.issues.some((i) => i.description.includes('most relevant files') || i.snippet.includes('most relevant files')),
    'Should mention scanned the most relevant files when truncated',
  )
})
