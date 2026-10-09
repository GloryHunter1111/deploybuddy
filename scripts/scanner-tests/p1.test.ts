import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeRepository } from '../../netlify/scanner-core/analyze.ts'
import { makeSource } from './make-source.ts'

test('[P1] C01 Markdown-only repo', async () => {
  const source = makeSource({
    'README.md': '# My Notes\nJust documentation.',
    'SKILL.md': '# Instructions\nSkill documentation.',
    '.gitignore': 'node_modules\n.DS_Store',
  })

  const report = await analyzeRepository(source)

  assert.equal(report.detectedConfig.framework, 'unknown')
  assert.equal(report.detectedConfig.frameworkName, 'No web app detected')
  
  // App checks skipped: no netlify.toml, build script or .env.example issues
  const appIssues = report.issues.filter((i) => i.title !== 'No deployable web app detected')
  assert.equal(appIssues.length, 0)

  const noAppIssue = report.issues.find((i) => i.title === 'No deployable web app detected')
  assert.ok(noAppIssue, 'Should have "No deployable web app detected" issue')
  assert.equal(noAppIssue.severity, 'info')
  assert.ok(noAppIssue.snippet.includes('# Nothing to fix here. Scan the repository of the app you want to deploy.'))
})

test('[P1] C02 List repo: 150 .md files, 2 .yml, no package.json', async () => {
  const files: Record<string, string> = {
    'config.yml': 'key: value',
    'deploy.yml': 'key: value',
  }
  for (let i = 1; i <= 150; i++) {
    files[`docs/item-${i}.md`] = `# Item ${i}\nDescription here.`
  }

  const source = makeSource(files)
  const report = await analyzeRepository(source)

  assert.equal(report.detectedConfig.framework, 'unknown')
  assert.equal(report.detectedConfig.frameworkName, 'No web app detected')
  assert.equal(report.issues.length, 1)
  assert.equal(report.issues[0].title, 'No deployable web app detected')
  assert.equal(report.issues[0].severity, 'info')
})

test('[P1] C03 Library package.json with no framework dependency', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'my-awesome-lib',
      main: './dist/index.js',
      module: './dist/index.mjs',
      files: ['dist'],
      peerDependencies: {
        react: '^18.0.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
      },
    }),
    'src/index.ts': 'export const add = (a: number, b: number) => a + b',
  })

  const report = await analyzeRepository(source)

  assert.equal(report.detectedConfig.framework, 'unknown')
  assert.equal(report.detectedConfig.frameworkName, 'No web app detected')
  assert.equal(report.issues.length, 1)
  assert.equal(report.issues[0].title, 'No deployable web app detected')
})

test('[P1] C04 Large monorepo root with fixtures excluded', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'tooling-monorepo',
      private: true,
      workspaces: ['packages/*'],
    }),
    'packages/core/package.json': JSON.stringify({
      name: '@tooling/core',
      main: './index.js',
    }),
    'fixtures/app-a/package.json': JSON.stringify({
      name: 'fixture-app',
      dependencies: {
        vite: '^5.0.0',
      },
      scripts: {
        build: 'vite build',
      },
    }),
    'fixtures/app-a/index.html': '<!DOCTYPE html><html><body>Test</body></html>',
  })

  const report = await analyzeRepository(source)

  assert.equal(report.detectedConfig.framework, 'unknown')
  assert.equal(report.detectedConfig.frameworkName, 'No web app detected')
  assert.equal(report.issues.length, 1)
  assert.equal(report.issues[0].title, 'No deployable web app detected')
})

test('[P1] C05 Monorepo with web app in frontend directory', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'n8n-monorepo',
      private: true,
    }),
    'frontend/package.json': JSON.stringify({
      name: 'frontend-app',
      dependencies: {
        next: '^14.0.0',
        react: '^18.0.0',
      },
      scripts: {
        build: 'next build',
      },
    }),
    'frontend/pages/index.tsx': 'export default function Home() { return <div>Hello</div> }',
  })

  const report = await analyzeRepository(source)

  assert.equal(report.detectedConfig.framework, 'next')
  assert.equal(report.detectedConfig.hasBuildScript, true)
  assert.ok(!report.issues.some((i) => i.title.includes('Missing "build" script')))

  const dirIssue = report.issues.find((i) => i.title === 'Your web app is in "frontend"')
  assert.ok(dirIssue, 'Should have issue titled: Your web app is in "frontend"')
  assert.equal(dirIssue.severity, 'info')
  assert.ok(dirIssue.description.includes('frontend'))
})

test('[P1] C06 Turborepo with apps/web as primary app', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'turbo-repo',
      private: true,
      devDependencies: {
        turbo: '^1.10.0',
      },
    }),
    'apps/web/package.json': JSON.stringify({
      name: 'web',
      dependencies: {
        next: '^14.0.0',
      },
      scripts: {
        build: 'next build',
      },
    }),
    'packages/backend/package.json': JSON.stringify({
      name: 'backend',
      dependencies: {
        express: '^4.18.0',
      },
    }),
  })

  const report = await analyzeRepository(source)

  assert.equal(report.detectedConfig.framework, 'next')
  const dirIssue = report.issues.find((i) => i.title === 'Your web app is in "apps/web"')
  assert.ok(dirIssue, 'Should detect primary app in apps/web')
})

test('[P1] C07 [control] Plain Vite app at the root', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'vite-app',
      dependencies: {
        vite: '^5.0.0',
      },
      scripts: {
        build: 'vite build',
      },
    }),
    'index.html': '<!DOCTYPE html><html><body><div id="root"></div></body></html>',
    'src/main.ts': 'console.log("vite")',
  })

  const report = await analyzeRepository(source)

  assert.equal(report.detectedConfig.framework, 'vite')
  assert.equal(report.detectedConfig.frameworkName, 'Vite')
})

test('[P1] C08 [control] index.html only, no package.json', async () => {
  const source = makeSource({
    'index.html': '<!DOCTYPE html><html><body><h1>Static</h1></body></html>',
    'style.css': 'body { color: red; }',
  })

  const report = await analyzeRepository(source)

  assert.equal(report.detectedConfig.framework, 'static')
  assert.equal(report.detectedConfig.frameworkName, 'Static HTML')
})

test('[P1] C09 Next app with no build script', async () => {
  const source = makeSource({
    'package.json': JSON.stringify({
      name: 'next-app-no-build',
      dependencies: {
        next: '^14.0.0',
      },
    }),
    'pages/index.tsx': 'export default function Home() { return <h1>Home</h1> }',
  })

  const report = await analyzeRepository(source)

  assert.equal(report.detectedConfig.framework, 'next')
  const buildIssue = report.issues.find((i) => i.title.includes('Missing "build" script'))
  assert.ok(buildIssue, 'Should flag missing build script')
  assert.ok(buildIssue.snippet.includes('next build'), 'Snippet should recommend "next build"')
  assert.ok(!buildIssue.snippet.includes('vite'), 'Snippet should not mention vite')
})
