export type IssueSeverity = 'critical' | 'warning' | 'info'

export interface ScanIssue {
  severity: IssueSeverity
  title: string
  description: string
  snippet: string
  filePath?: string
}

export interface DetectedConfig {
  framework: 'vite' | 'next' | 'cra' | 'astro' | 'remix' | 'vue' | 'nuxt' | 'svelte' | 'static' | 'unknown'
  frameworkName: string
  defaultPublishDir: string
  defaultBuildCommand: string
  packageJsonExists: boolean
  hasBuildScript: boolean
  buildScriptCommand?: string
  netlifyTomlExists: boolean
  hasSpaRedirect: boolean
  envExampleExists: boolean
  referencedEnvVars: string[]
  documentedEnvVars: string[]
  scannedFilesCount: number
}

export interface ScanReport {
  repoUrl: string
  owner: string
  repo: string
  defaultBranch: string
  stars: number
  description: string | null
  detectedConfig: DetectedConfig
  issues: ScanIssue[]
  scannedAt: string
}

export interface RepoTreeItem {
  path: string
  mode?: string
  type: 'blob' | 'tree'
  sha?: string
  size?: number
  url?: string
}

export interface RepoSource {
  tree: Array<RepoTreeItem>
  getFile(path: string): Promise<string | null>
  now?(): number
}

export interface AnalyzeOptions {
  repoUrl?: string
  owner?: string
  repo?: string
  defaultBranch?: string
  stars?: number
  description?: string | null
}

const STANDARD_SYSTEM_ENV_VARS = new Set([
  'NODE_ENV',
  'MODE',
  'BASE_URL',
  'PROD',
  'DEV',
  'SSR',
  'PUBLIC_URL',
])

const PLACEHOLDER_ENV_NAMES = new Set([
  'X',
  'Y',
  'Z',
  'I',
  'K',
  'V',
  'ENV',
  'VARS',
  'VAR',
  'KEY',
  'SOME_KEY',
  'YOUR_KEY',
  'API_KEY',
  'SECRET',
  'TOKEN',
  'FOO',
  'BAR',
  'BAZ',
  'EXAMPLE',
  'PLACEHOLDER',
  'UNDEFINED',
  'NULL',
  'TRUE',
  'FALSE',
])

function isValidEnvVarName(name: string): boolean {
  if (!name || name.length < 2) return false
  if (name.endsWith('_')) return false
  if (STANDARD_SYSTEM_ENV_VARS.has(name)) return false
  if (PLACEHOLDER_ENV_NAMES.has(name)) return false
  return /^[A-Z][A-Z0-9_]*[A-Z0-9]$/.test(name)
}

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
}

function decodeBase64Utf8(base64: string): string {
  try {
    const clean = base64.replace(/\s/g, '')
    const binary = Buffer.from(clean, 'base64').toString('utf-8')
    return binary
  } catch {
    return Buffer.from(base64, 'base64').toString('utf-8')
  }
}

function isSupabaseServiceRoleJwt(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonStr = Buffer.from(base64, 'base64').toString('utf-8')
    const payload = JSON.parse(jsonStr) as { role?: string }
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

function maskSecret(secret: string): string {
  if (secret.length <= 10) return '••••••••'
  const prefix = secret.slice(0, 7)
  const suffix = secret.slice(-4)
  return `${prefix}••••${suffix}`
}

function detectFramework(
  pkgJson: Record<string, unknown> | null,
  fileTree: RepoTreeItem[],
): {
  framework: DetectedConfig['framework']
  frameworkName: string
  defaultPublishDir: string
  defaultBuildCommand: string
} {
  const allDeps: Record<string, string> = {
    ...((pkgJson?.dependencies as Record<string, string>) || {}),
    ...((pkgJson?.devDependencies as Record<string, string>) || {}),
  }

  const filePaths = new Set(fileTree.map((f) => f.path.toLowerCase()))

  if (allDeps['next'] || filePaths.has('next.config.js') || filePaths.has('next.config.mjs') || filePaths.has('next.config.ts')) {
    return {
      framework: 'next',
      frameworkName: 'Next.js',
      defaultPublishDir: '.next',
      defaultBuildCommand: 'npm run build',
    }
  }

  if (allDeps['vite'] || filePaths.has('vite.config.js') || filePaths.has('vite.config.ts') || filePaths.has('vite.config.mjs')) {
    return {
      framework: 'vite',
      frameworkName: 'Vite',
      defaultPublishDir: 'dist',
      defaultBuildCommand: 'npm run build',
    }
  }

  if (allDeps['astro'] || filePaths.has('astro.config.mjs') || filePaths.has('astro.config.ts')) {
    return {
      framework: 'astro',
      frameworkName: 'Astro',
      defaultPublishDir: 'dist',
      defaultBuildCommand: 'npm run build',
    }
  }

  if (allDeps['@remix-run/react'] || allDeps['@remix-run/netlify'] || allDeps['remix'] || filePaths.has('remix.config.js')) {
    return {
      framework: 'remix',
      frameworkName: 'Remix',
      defaultPublishDir: 'build/client',
      defaultBuildCommand: 'npm run build',
    }
  }

  if (allDeps['nuxt'] || allDeps['nuxt3'] || filePaths.has('nuxt.config.js') || filePaths.has('nuxt.config.ts')) {
    return {
      framework: 'nuxt',
      frameworkName: 'Nuxt',
      defaultPublishDir: '.output/public',
      defaultBuildCommand: 'npm run build',
    }
  }

  if (allDeps['react-scripts']) {
    return {
      framework: 'cra',
      frameworkName: 'Create React App',
      defaultPublishDir: 'build',
      defaultBuildCommand: 'npm run build',
    }
  }

  if (allDeps['@sveltejs/kit'] || allDeps['svelte']) {
    return {
      framework: 'svelte',
      frameworkName: 'Svelte',
      defaultPublishDir: 'dist',
      defaultBuildCommand: 'npm run build',
    }
  }

  if (allDeps['vue']) {
    return {
      framework: 'vue',
      frameworkName: 'Vue.js',
      defaultPublishDir: 'dist',
      defaultBuildCommand: 'npm run build',
    }
  }

  if (filePaths.has('index.html') && !pkgJson) {
    return {
      framework: 'static',
      frameworkName: 'Static HTML',
      defaultPublishDir: '.',
      defaultBuildCommand: '',
    }
  }

  return {
    framework: 'unknown',
    frameworkName: pkgJson ? 'Node.js App' : 'Generic Web App',
    defaultPublishDir: 'dist',
    defaultBuildCommand: 'npm run build',
  }
}

function generateRecommendedNetlifyToml(
  framework: DetectedConfig['framework'],
  buildCommand = 'npm run build',
): string {
  switch (framework) {
    case 'next':
      return `[build]\n  command = "${buildCommand}"\n  publish = ".next"\n\n[[plugins]]\n  package = "@netlify/plugin-nextjs"`
    case 'cra':
      return `[build]\n  command = "${buildCommand}"\n  publish = "build"\n\n[[redirects]]\n  from = "/*"\n  to = "/index.html"\n  status = 200`
    case 'astro':
      return `[build]\n  command = "${buildCommand}"\n  publish = "dist"`
    case 'remix':
      return `[build]\n  command = "${buildCommand}"\n  publish = "build/client"`
    case 'nuxt':
      return `[build]\n  command = "${buildCommand}"\n  publish = ".output/public"`
    case 'static':
      return `[build]\n  publish = "."\n\n[[redirects]]\n  from = "/*"\n  to = "/index.html"\n  status = 200`
    case 'vite':
    case 'vue':
    case 'svelte':
    default:
      return `[build]\n  command = "${buildCommand}"\n  publish = "dist"\n\n[[redirects]]\n  from = "/*"\n  to = "/index.html"\n  status = 200`
  }
}

export async function analyzeRepository(
  source: RepoSource,
  options?: AnalyzeOptions,
): Promise<ScanReport> {
  const repoUrl = options?.repoUrl || 'https://github.com/owner/repo'
  const owner = options?.owner || 'owner'
  const repo = options?.repo || 'repo'
  const defaultBranch = options?.defaultBranch || 'main'
  const stars = options?.stars ?? 0
  const description = options?.description ?? null

  const fileTree = source.tree.filter((item) => item.type === 'blob')

  // 3. Locate Key Configuration Files
  const packageJsonItem = fileTree.find((f) => f.path.toLowerCase() === 'package.json')
  const netlifyTomlItem = fileTree.find((f) => f.path.toLowerCase() === 'netlify.toml')
  const envExampleItem = fileTree.find((f) =>
    ['.env.example', '.env.sample', '.env.template', '.env.local.example'].includes(f.path.toLowerCase()),
  )
  const committedEnvItems = fileTree.filter((f) => {
    const lower = f.path.toLowerCase()
    return (
      lower === '.env' ||
      lower === '.env.local' ||
      lower === '.env.production' ||
      lower === '.env.staging' ||
      lower === '.env.development' ||
      lower.endsWith('/.env') ||
      lower.endsWith('/.env.local')
    )
  })

  // 4. Filter Source Files for scanning
  const ignoredPatterns = [
    /node_modules\//i,
    /dist\//i,
    /build\//i,
    /\.next\//i,
    /\.output\//i,
    /\.git\//i,
    /\.github\//i,
    /coverage\//i,
    /test(s)?\//i,
    /__tests__\//i,
    /\.(test|spec)\.[a-z0-9]+$/i,
    /\.d\.ts$/i,
    /(^|\/)(scanner|scanner\.test|repo-scanner)\.(ts|js|tsx|jsx)$/i,
    /package-lock\.json$/i,
    /pnpm-lock\.yaml$/i,
    /yarn\.lock$/i,
    /bun\.lockb$/i,
    /\.min\.(js|css)$/i,
    /\.(png|jpe?g|gif|svg|ico|webp|pdf|mp4|woff2?|ttf|eot|zip|tar|gz|map)$/i,
  ]

  const sourceFiles = fileTree
    .filter((f) => !ignoredPatterns.some((pattern) => pattern.test(f.path)))
    .filter((f) => /\.(jsx?|tsx?|vue|svelte|mjs|cjs|html|json)$/i.test(f.path))

  const prioritizedSourceFiles = [...sourceFiles].sort((a, b) => {
    const score = (p: string) => {
      const lp = p.toLowerCase()
      if (lp.includes('supabase') || lp.includes('client') || lp.includes('auth')) return 10
      if (lp.startsWith('src/lib') || lp.startsWith('src/services') || lp.startsWith('src/api')) return 8
      if (lp.startsWith('src/app') || lp.startsWith('src/pages') || lp.startsWith('src/routes')) return 6
      if (lp.startsWith('src/components') || lp === 'src/app.tsx' || lp === 'src/main.tsx') return 5
      if (lp.endsWith('.ts') || lp.endsWith('.tsx') || lp.endsWith('.js') || lp.endsWith('.jsx')) return 3
      return 1
    }
    return score(b.path) - score(a.path)
  })

  const selectedSourceFiles = prioritizedSourceFiles.slice(0, 20)

  // 5. Read Key Files
  let pkgJsonContent: Record<string, unknown> | null = null
  let pkgJsonRaw = ''
  if (packageJsonItem) {
    const raw = await source.getFile(packageJsonItem.path)
    if (raw) {
      pkgJsonRaw = raw
      try {
        pkgJsonContent = JSON.parse(raw)
      } catch {
        // ignore
      }
    }
  }

  let netlifyTomlRaw: string | null = null
  if (netlifyTomlItem) {
    netlifyTomlRaw = await source.getFile(netlifyTomlItem.path)
  }

  let envExampleRaw: string | null = null
  if (envExampleItem) {
    envExampleRaw = await source.getFile(envExampleItem.path)
  }

  // 6. Read Source Files in Parallel Batches
  const fileContentsMap = new Map<string, string>()
  const BATCH_SIZE = 5
  for (let i = 0; i < selectedSourceFiles.length; i += BATCH_SIZE) {
    const batch = selectedSourceFiles.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (file) => {
        if (file.path === 'package.json' && pkgJsonRaw) {
          fileContentsMap.set(file.path, pkgJsonRaw)
          return
        }
        const content = await source.getFile(file.path)
        if (content) {
          fileContentsMap.set(file.path, content)
        }
      }),
    )
  }

  // 7. Diagnostics
  const issues: ScanIssue[] = []

  const { framework, frameworkName, defaultPublishDir, defaultBuildCommand } = detectFramework(
    pkgJsonContent,
    fileTree,
  )

  const scripts = (pkgJsonContent?.scripts as Record<string, string>) || {}
  const hasBuildScript = Boolean(scripts.build)
  const buildScriptCommand = scripts.build

  const referencedEnvVarsSet = new Set<string>()

  const secretPatterns = [
    { name: 'OpenAI Project API Key', regex: /\b(sk-proj-[a-zA-Z0-9_-]{48,})\b/g },
    { name: 'OpenAI API Key', regex: /\b(sk-[a-zA-Z0-9]{32,48})\b/g },
    { name: 'Stripe Live Secret Key', regex: /\b(sk_live_[0-9a-zA-Z]{24,}|rk_live_[0-9a-zA-Z]{24,})\b/g },
    { name: 'Anthropic API Key', regex: /\b(sk-ant-api03-[a-zA-Z0-9_-]{50,})\b/g },
    { name: 'GitHub Personal Access Token', regex: /\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{50,})\b/g },
    { name: 'Supabase Management Token', regex: /\b(sbp_[a-zA-Z0-9]{40,})\b/g },
    { name: 'AWS Access Key ID', regex: /\b(AKIA[0-9A-Z]{16})\b/g },
    { name: 'Google API Key', regex: /\b(AIza[0-9A-Za-z-_]{35})\b/g },
  ]

  fileContentsMap.forEach((rawContent, filePath) => {
    const cleanedContent = stripComments(rawContent)

    const dotImportMatches = cleanedContent.matchAll(/\bimport\.meta\.env\.([A-Z][A-Z0-9_]*[A-Z0-9])\b/g)
    for (const match of dotImportMatches) {
      if (isValidEnvVarName(match[1])) {
        referencedEnvVarsSet.add(match[1])
      }
    }

    const dotProcessMatches = cleanedContent.matchAll(/\bprocess\.env\.([A-Z][A-Z0-9_]*[A-Z0-9])\b/g)
    for (const match of dotProcessMatches) {
      if (isValidEnvVarName(match[1])) {
        referencedEnvVarsSet.add(match[1])
      }
    }

    const bracketMatches = cleanedContent.matchAll(/\b(?:import\.meta\.env|process\.env)\[['"]([A-Z][A-Z0-9_]*[A-Z0-9])['"]\]/g)
    for (const match of bracketMatches) {
      if (isValidEnvVarName(match[1])) {
        referencedEnvVarsSet.add(match[1])
      }
    }

    if (filePath.endsWith('.md') || filePath.endsWith('.json') || filePath.endsWith('.txt')) {
      return
    }

    for (const pattern of secretPatterns) {
      pattern.regex.lastIndex = 0
      const match = pattern.regex.exec(cleanedContent)
      if (match && match[1]) {
        const detectedKey = match[1]
        if (
          /^sk(-proj)?-[xX0]+$/.test(detectedKey) ||
          detectedKey.includes('example') ||
          detectedKey.includes('placeholder') ||
          detectedKey.includes('your_') ||
          detectedKey === 'AKIAIOSFODNN7EXAMPLE'
        ) {
          continue
        }

        issues.push({
          severity: 'warning',
          title: `Hardcoded ${pattern.name} found in ${filePath}`,
          description: `A credential shaped like a ${pattern.name} (${maskSecret(detectedKey)}) was detected directly in source code. Hardcoded keys in repositories can be publicly indexed, leading to compromised security and unexpected API charges.`,
          snippet: `// Move secret from ${filePath} to your environment variables:\n// In .env.local:\nVITE_${pattern.name.toUpperCase().replace(/\s+/g, '_')}=your_actual_key_here\n\n// In ${filePath}:\nconst apiKey = import.meta.env.VITE_${pattern.name.toUpperCase().replace(/\s+/g, '_')}`,
          filePath,
        })
      }
    }

    const rawJwtMatches = cleanedContent.matchAll(/createClient\s*\(\s*['"][^'"]+['"]\s*,\s*['"](eyJ[a-zA-Z0-9._-]{50,})['"]/g)
    for (const match of rawJwtMatches) {
      if (match[1]) {
        const rawToken = match[1]
        const isServiceRole = isSupabaseServiceRoleJwt(rawToken)
        issues.push({
          severity: 'warning',
          title: isServiceRole
            ? `Exposed Supabase service-role key found in ${filePath}`
            : `Hardcoded Supabase API key found in ${filePath}`,
          description: isServiceRole
            ? `A hardcoded Supabase service_role JWT key (${maskSecret(rawToken)}) was found in createClient(). The service-role key bypasses all Row Level Security (RLS) policies and must NEVER be exposed in frontend client code.`
            : `A hardcoded Supabase API token (${maskSecret(rawToken)}) was found in createClient(). Keys should be loaded from environment variables rather than hardcoded in source code.`,
          snippet: `// In ${filePath}, load Supabase keys from environment variables:\nimport { createClient } from '@supabase/supabase-js'\n\nconst supabaseUrl = import.meta.env.VITE_SUPABASE_URL\nconst supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY\n\nexport const supabase = createClient(supabaseUrl, supabaseAnonKey)`,
          filePath,
        })
      }
    }

    const serviceRoleVarRegex = /\b(?:import\.meta\.env|process\.env)(?:\.(?:VITE_|NEXT_PUBLIC_)|\[['"](?:VITE_|NEXT_PUBLIC_))SUPABASE_SERVICE_ROLE_KEY\b/
    if (serviceRoleVarRegex.test(cleanedContent)) {
      issues.push({
        severity: 'warning',
        title: `Supabase service-role key exposed in client code (${filePath})`,
        description: `The Supabase service-role key was found referenced with a client-exposed environment prefix (VITE_ / NEXT_PUBLIC_). The service-role key bypasses all Row Level Security (RLS) policies and must NEVER be loaded into frontend code.`,
        snippet: `// In frontend code, only use the public anon key:\nconst supabase = createClient(\n  import.meta.env.VITE_SUPABASE_URL,\n  import.meta.env.VITE_SUPABASE_ANON_KEY\n)`,
        filePath,
      })
    }
  })

  if (committedEnvItems.length > 0) {
    const committedNames = committedEnvItems.map((f) => f.path).join(', ')
    issues.push({
      severity: 'warning',
      title: `Sensitive environment file committed to git (${committedNames})`,
      description: `The repository contains committed environment file(s) (${committedNames}). Actual environment files containing secrets or project credentials should be listed in .gitignore and never committed to version control.`,
      snippet: `# Add environment files to your .gitignore:\n.env\n.env.local\n.env.*.local\n*.env`,
    })
  }

  // Check 1: netlify.toml Checks
  let hasSpaRedirect = false
  if (!netlifyTomlItem) {
    issues.push({
      severity: 'warning',
      title: 'Missing netlify.toml configuration',
      description: `No netlify.toml configuration file was found in the repository root. Without it, Netlify may fail to build your project or return 404 errors when users refresh client-side routes.`,
      snippet: generateRecommendedNetlifyToml(framework, buildScriptCommand ? 'npm run build' : defaultBuildCommand),
    })
  } else if (netlifyTomlRaw) {
    const hasRedirectBlock = /\[\[redirects\]\]/i.test(netlifyTomlRaw)
    const hasIndexRedirect = /from\s*=\s*['"]\/\*['"][\s\S]*?to\s*=\s*['"]\/index\.html['"]/i.test(netlifyTomlRaw) ||
      /from\s*=\s*['"]\/\*['"][\s\S]*?status\s*=\s*200/i.test(netlifyTomlRaw)

    hasSpaRedirect = hasRedirectBlock && hasIndexRedirect

    const isSpa = ['vite', 'cra', 'vue', 'svelte'].includes(framework)
    if (isSpa && !hasSpaRedirect) {
      issues.push({
        severity: 'warning',
        title: 'Missing SPA redirect rule in netlify.toml',
        description: `Single-page applications (SPAs) require a wildcard redirect rule (/* -> /index.html) so Netlify serves index.html for client-side routes instead of returning a 404 on page refresh.`,
        snippet: `[[redirects]]\n  from = "/*"\n  to = "/index.html"\n  status = 200`,
      })
    }

    const commandMatch = netlifyTomlRaw.match(/command\s*=\s*['"]([^'"]+)['"]/i)
    const publishMatch = netlifyTomlRaw.match(/publish\s*=\s*['"]([^'"]+)['"]/i)

    if (commandMatch && commandMatch[1] && pkgJsonContent) {
      const tomlCmd = commandMatch[1].trim()
      const runMatch = tomlCmd.match(/^(?:npm run|pnpm run|yarn run|yarn)\s+([a-zA-Z0-9_:-]+)/i)
      if (runMatch && runMatch[1]) {
        const targetScript = runMatch[1]
        if (!scripts[targetScript]) {
          issues.push({
            severity: 'warning',
            title: 'Build command mismatch between netlify.toml and package.json',
            description: `netlify.toml specifies command = "${tomlCmd}", but the script "${targetScript}" does not exist in package.json scripts.`,
            snippet: `[build]\n  command = "${hasBuildScript ? 'npm run build' : 'npm run ' + Object.keys(scripts)[0]}"\n  publish = "${publishMatch?.[1] || defaultPublishDir}"`,
          })
        }
      }
    }

    if (publishMatch && publishMatch[1]) {
      const publishDir = publishMatch[1].trim()
      if (framework === 'vite' && publishDir === 'build') {
        issues.push({
          severity: 'warning',
          title: 'Publish directory mismatch in netlify.toml',
          description: `netlify.toml specifies publish = "${publishDir}", but Vite builds to "dist" by default. Netlify will not find your built HTML/JS assets.`,
          snippet: `[build]\n  command = "${commandMatch?.[1] || 'npm run build'}"\n  publish = "dist"`,
        })
      } else if (framework === 'cra' && publishDir === 'dist') {
        issues.push({
          severity: 'warning',
          title: 'Publish directory mismatch in netlify.toml',
          description: `netlify.toml specifies publish = "${publishDir}", but Create React App builds to "build" by default.`,
          snippet: `[build]\n  command = "${commandMatch?.[1] || 'npm run build'}"\n  publish = "build"`,
        })
      }
    }
  }

  // Check 2: Missing build script in package.json
  if (pkgJsonContent && !hasBuildScript && framework !== 'static') {
    issues.push({
      severity: 'warning',
      title: 'Missing "build" script in package.json',
      description: `package.json does not define a "build" script under "scripts". Netlify and other CI/CD platforms expect "npm run build" to generate production assets.`,
      snippet: `"scripts": {\n  "build": "${framework === 'vite' ? 'vite build' : 'tsc -b && vite build'}"\n}`,
    })
  }

  // Check 3: Missing or incomplete .env.example
  const referencedEnvVars = Array.from(referencedEnvVarsSet).sort()
  const documentedEnvVars: string[] = []

  if (envExampleRaw) {
    const lines = envExampleRaw.split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const key = trimmed.split('=')[0]?.trim()
        if (key && isValidEnvVarName(key)) {
          documentedEnvVars.push(key)
        }
      }
    }

    const missingInExample = referencedEnvVars.filter((v) => !documentedEnvVars.includes(v))
    if (missingInExample.length > 0) {
      issues.push({
        severity: 'info',
        title: 'Undocumented environment variables in .env.example',
        description: `Your source code references environment variable${missingInExample.length > 1 ? 's that are' : ' that is'} missing from .env.example: ${missingInExample.join(', ')}.`,
        snippet: `# Add missing variables to .env.example:\n${missingInExample.map((v) => `${v}=`).join('\n')}`,
      })
    }
  } else {
    const envSnippet = referencedEnvVars.length > 0
      ? `# .env.example — Copy to .env.local and populate\n${referencedEnvVars.map((v) => `${v}=`).join('\n')}`
      : `# .env.example — Copy to .env.local and populate\nVITE_SUPABASE_URL=\nVITE_SUPABASE_ANON_KEY=`

    issues.push({
      severity: 'info',
      title: 'Missing .env.example template',
      description: referencedEnvVars.length > 0
        ? `Your codebase references ${referencedEnvVars.length} environment variable${referencedEnvVars.length > 1 ? 's' : ''} (${referencedEnvVars.join(', ')}), but no .env.example file was found in the repository root. Adding one helps deployment platforms and collaborators identify required values.`
        : `No .env.example template file was found. Adding one provides a documented template for environment variables required by your app.`,
      snippet: envSnippet,
    })
  }

  const severityOrder: Record<IssueSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  }
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return {
    repoUrl,
    owner,
    repo,
    defaultBranch,
    stars,
    description,
    detectedConfig: {
      framework,
      frameworkName,
      defaultPublishDir,
      defaultBuildCommand,
      packageJsonExists: Boolean(packageJsonItem),
      hasBuildScript,
      buildScriptCommand,
      netlifyTomlExists: Boolean(netlifyTomlItem),
      hasSpaRedirect,
      envExampleExists: Boolean(envExampleItem),
      referencedEnvVars,
      documentedEnvVars,
      scannedFilesCount: selectedSourceFiles.length + (packageJsonItem ? 1 : 0) + (netlifyTomlItem ? 1 : 0),
    },
    issues,
    scannedAt: new Date().toISOString(),
  }
}
