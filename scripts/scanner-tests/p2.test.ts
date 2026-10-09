import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeRepository } from '../../netlify/scanner-core/analyze.ts'
import { makeSource } from './make-source.ts'

test('[P2] C10 Vite + react-router-dom with vercel.json', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'vite-vercel-app',
      dependencies: {
        vite: '^5.0.0',
        'react-router-dom': '^6.20.0',
      },
      scripts: {
        'vercel-build': 'vite build',
      },
    }),
    'vercel.json': JSON.stringify({
      rewrites: [{ source: '/(.*)', destination: '/index.html' }],
    }),
    'index.html': '<!DOCTYPE html><html><body><div id="root"></div></body></html>',
    'src/App.tsx': 'import React from "react"; export default function App() { return <div>App</div> }',
  })

  const report = await analyzeRepository(source)

  assert.ok(!report.issues.some((i) => i.severity === 'warning' && i.title.includes('netlify.toml')), 'Should have no netlify.toml warning')
  const vercelIssue = report.issues.find((i) => i.title === 'This repository looks set up for Vercel')
  assert.ok(vercelIssue, 'Should have info issue titled "This repository looks set up for Vercel"')
  assert.equal(vercelIssue.severity, 'info')
})

test('[P2] C11 Next.js without host files', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'next-app',
      dependencies: {
        next: '^14.0.0',
        react: '^18.0.0',
      },
      scripts: {
        build: 'next build',
      },
    }),
    'pages/index.tsx': 'export default function Page() { return <div>Next</div> }',
  })

  const report = await analyzeRepository(source)

  assert.ok(!report.issues.some((i) => i.severity === 'warning' && i.title.includes('netlify.toml')), 'Should not have warning for missing netlify.toml')
  const nextIssue = report.issues.find((i) => i.title === 'netlify.toml is optional for Next.js')
  assert.ok(nextIssue, 'Should have info issue "netlify.toml is optional for Next.js"')
  assert.equal(nextIssue.severity, 'info')
  assert.ok(!nextIssue.snippet.includes('.next'), 'Should never suggest publish = ".next"')
  assert.ok(!nextIssue.snippet.includes('plugin-nextjs'), 'Should never suggest plugin-nextjs')
})

test('[P2] C12 Next.js app with vercel.json', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'next-vercel-app',
      dependencies: {
        next: '^14.0.0',
      },
      scripts: {
        build: 'next build',
      },
    }),
    'vercel.json': JSON.stringify({
      framework: 'nextjs',
    }),
    'pages/index.tsx': 'export default function Page() { return <div>Next</div> }',
  })

  const report = await analyzeRepository(source)

  assert.ok(!report.issues.some((i) => i.severity === 'warning' && i.title.includes('netlify.toml')))
  const vercelIssue = report.issues.find((i) => i.title === 'This repository looks set up for Vercel')
  assert.ok(vercelIssue, 'Should have info issue for Vercel')
})

test('[P2] C13 TanStack Start without host files', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'tanstack-start-app',
      dependencies: {
        '@tanstack/react-start': '^1.0.0',
        vite: '^5.0.0',
      },
      scripts: {
        build: 'vite build',
      },
    }),
    'app/router.tsx': 'export const router = {}',
  })

  const report = await analyzeRepository(source)

  assert.ok(!report.issues.some((i) => i.severity === 'warning' && i.title.includes('netlify.toml')))
  const guideIssue = report.issues.find((i) => i.title === 'netlify.toml: follow the framework guide')
  assert.ok(guideIssue, 'Should have info issue "netlify.toml: follow the framework guide"')
  assert.equal(guideIssue.severity, 'info')
  assert.ok(!guideIssue.snippet.includes('publish = "dist"'), 'Should not suggest publish = "dist"')
})

test('[P2] C14 React Router framework mode with correct netlify.toml', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'react-router-v7-app',
      dependencies: {
        '@react-router/dev': '^7.0.0',
        react: '^18.0.0',
      },
      scripts: {
        build: 'react-router build',
      },
    }),
    'netlify.toml': '[build]\n  command = "npm run build"\n',
    'app/routes/home.tsx': 'export default function Home() { return <h1>Home</h1> }',
  })

  const report = await analyzeRepository(source)

  assert.ok(!report.issues.some((i) => i.title.includes('Missing SPA redirect rule')), 'Should not raise SPA redirect warning for server-rendered React Router')
})

test('[P2] C15 Next app with only a Dockerfile', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'dockerized-next',
      dependencies: {
        next: '^14.0.0',
      },
      scripts: {
        build: 'next build',
      },
    }),
    'Dockerfile': 'FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm run build\nCMD ["npm", "start"]',
  })

  const report = await analyzeRepository(source)

  const dockerIssue = report.issues.find((i) => i.title === 'This repository looks set up for container-based hosting')
  assert.ok(dockerIssue, 'Should have info issue "This repository looks set up for container-based hosting"')
  assert.equal(dockerIssue.severity, 'info')
})

test('[P2] C16 [control] Vite + react-router-dom, no host files, no netlify.toml', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'vite-router-app',
      dependencies: {
        vite: '^5.0.0',
        'react-router-dom': '^6.0.0',
      },
      scripts: {
        build: 'vite build',
      },
    }),
    'index.html': '<!DOCTYPE html><html><body><div id="root"></div></body></html>',
    'src/main.tsx': 'console.log("app")',
  })

  const report = await analyzeRepository(source)

  const missingToml = report.issues.find((i) => i.title.includes('Missing netlify.toml'))
  assert.ok(missingToml, 'Should have missing netlify.toml warning')
  assert.equal(missingToml.severity, 'warning')
  assert.ok(missingToml.snippet.includes('publish = "dist"'))
  assert.ok(missingToml.snippet.includes('from = "/*"'))
})

test('[P2] C17 [control] Vite + react-router-dom, netlify.toml without a redirect', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'vite-router-app',
      dependencies: {
        vite: '^5.0.0',
        'react-router-dom': '^6.0.0',
      },
      scripts: {
        build: 'vite build',
      },
    }),
    'netlify.toml': '[build]\n  command = "npm run build"\n  publish = "dist"\n',
    'index.html': '<!DOCTYPE html><html><body><div id="root"></div></body></html>',
    'src/main.tsx': 'console.log("app")',
  })

  const report = await analyzeRepository(source)

  const redirectIssue = report.issues.find((i) => i.title.includes('Missing SPA redirect rule'))
  assert.ok(redirectIssue, 'Should flag missing SPA redirect rule')
  assert.equal(redirectIssue.severity, 'warning')
})

test('[P2] C18 Vite, no router library, netlify.toml with headers and no redirect', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'vite-single-page',
      dependencies: {
        vite: '^5.0.0',
      },
      scripts: {
        build: 'vite build',
      },
    }),
    'netlify.toml': '[build]\n  command = "npm run build"\n  publish = "dist"\n\n[[headers]]\n  for = "/*"\n  [headers.values]\n    X-Frame-Options = "DENY"\n',
    'index.html': '<!DOCTYPE html><html><body><div id="root"></div></body></html>',
    'src/main.tsx': 'console.log("app")',
  })

  const report = await analyzeRepository(source)

  assert.ok(!report.issues.some((i) => i.title.includes('Missing SPA redirect rule')), 'Single-screen app with no router needs no redirect warning')
})

test('[P2] C19 Vite served under /cp: netlify.toml has scoped redirect', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'vite-cp-app',
      dependencies: {
        vite: '^5.0.0',
        'react-router-dom': '^6.0.0',
      },
      scripts: {
        build: 'vite build',
      },
    }),
    'netlify.toml': '[build]\n  command = "npm run build"\n  publish = "dist"\n\n[[redirects]]\n  from = "/cp/*"\n  to = "/cp/index.html"\n  status = 200\n',
    'index.html': '<!DOCTYPE html><html><body><div id="root"></div></body></html>',
    'src/main.tsx': 'console.log("app")',
  })

  const report = await analyzeRepository(source)

  assert.ok(!report.issues.some((i) => i.title.includes('Missing SPA redirect rule')), 'Scoped redirect /cp/* -> /cp/index.html 200 is treated as valid')
})

test('[P2] C20 netlify.toml and vercel.json both present with redirect in both', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'dual-host-app',
      dependencies: {
        vite: '^5.0.0',
        'react-router-dom': '^6.0.0',
      },
      scripts: {
        build: 'vite build',
      },
    }),
    'netlify.toml': '[build]\n  command = "npm run build"\n  publish = "dist"\n\n[[redirects]]\n  from = "/*"\n  to = "/index.html"\n  status = 200\n',
    'vercel.json': JSON.stringify({
      rewrites: [{ source: '/(.*)', destination: '/index.html' }],
    }),
    'index.html': '<!DOCTYPE html><html><body><div id="root"></div></body></html>',
    'src/main.tsx': 'console.log("app")',
  })

  const report = await analyzeRepository(source)

  assert.ok(!report.issues.some((i) => i.severity === 'warning' && i.title.includes('netlify')), 'No netlify warnings when netlify.toml is present and valid')
})

test('[P2] C21 Monorepo with apps/web/netlify.toml', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'monorepo-root',
      private: true,
    }),
    'apps/web/package.json': JSON.stringify({
      name: 'web-app',
      dependencies: {
        vite: '^5.0.0',
      },
      scripts: {
        build: 'vite build',
      },
    }),
    'apps/web/netlify.toml': '[build]\n  command = "npm run build"\n  publish = "dist"\n',
    'apps/web/index.html': '<!DOCTYPE html><html><body><div id="root"></div></body></html>',
  })

  const report = await analyzeRepository(source)

  assert.equal(report.detectedConfig.netlifyTomlExists, true)
  assert.ok(!report.issues.some((i) => i.title.includes('Missing netlify.toml')), 'apps/web/netlify.toml should count as found')
})
