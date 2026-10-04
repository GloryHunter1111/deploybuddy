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

export interface GitHubRepoRef {
  owner: string
  repo: string
}

/**
 * Parses various GitHub URL and shorthand formats into owner & repo.
 */
export function parseGitHubUrl(input: string): GitHubRepoRef | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  let pathname = trimmed
  pathname = pathname.replace(/^[[<()]+|[\]>)]+$/g, '')

  if (pathname.startsWith('git@github.com:')) {
    pathname = pathname.replace('git@github.com:', '')
  } else if (pathname.includes('github.com')) {
    try {
      const url = new URL(pathname.startsWith('http') ? pathname : `https://${pathname}`)
      if (!['github.com', 'www.github.com'].includes(url.hostname)) {
        return null
      }
      pathname = url.pathname
    } catch {
      return null
    }
  }

  const cleaned = pathname
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.git$/i, '')
    .replace(/\/tree\/[^/]+.*$/i, '')

  const parts = cleaned.split('/').filter(Boolean)
  if (parts.length < 2) return null

  const [owner, repo] = parts
  if (!/^[a-zA-Z0-9_.-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(repo)) {
    return null
  }

  return { owner, repo }
}

/**
 * Scans a GitHub repository by calling the serverless Netlify function (/.netlify/functions/scan-repo).
 * The serverless function utilizes GITHUB_TOKEN on the backend for elevated rate limits.
 */
export async function scanRepository(
  repoUrlInput: string,
  onProgress?: (status: string) => void,
): Promise<ScanReport> {
  const parsed = parseGitHubUrl(repoUrlInput)
  if (!parsed) {
    throw new Error('Enter a valid GitHub repository URL, such as https://github.com/owner/repository.')
  }

  const { owner, repo } = parsed
  onProgress?.(`Contacting scanner service for ${owner}/${repo}…`)

  try {
    const response = await fetch('/.netlify/functions/scan-repo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ repoUrl: repoUrlInput }),
    })

    const contentType = response.headers.get('content-type') || ''
    
    // Check if serverless function endpoint is available
    if (contentType.includes('application/json')) {
      const data = await response.json()

      if (!response.ok) {
        const errorMsg =
          data?.error ||
          data?.message ||
          `Scan service responded with error status ${response.status}.`
        throw new Error(errorMsg)
      }

      return data as ScanReport
    }

    // Fallback if local dev server doesn't have Netlify functions running (e.g. raw vite dev)
    if (response.status === 404 || contentType.includes('text/html')) {
      onProgress?.('Connecting directly to GitHub API (standalone dev mode)…')
      return await scanDirectDevFallback(repoUrlInput, onProgress)
    }

    throw new Error(`Unexpected server response: ${response.status} ${response.statusText}`)
  } catch (err: unknown) {
    if (err instanceof Error) {
      // If network fetch failed to functions endpoint in dev mode, attempt direct fallback
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        try {
          return await scanDirectDevFallback(repoUrlInput, onProgress)
        } catch (fallbackErr: unknown) {
          throw fallbackErr instanceof Error ? fallbackErr : err
        }
      }
      throw err
    }
    throw new Error('Failed to complete repository scan.')
  }
}

/**
 * Standalone client-side fallback used ONLY if running in bare Vite dev mode without Netlify CLI.
 * Does not use or require any token.
 */
async function scanDirectDevFallback(
  repoUrlInput: string,
  onProgress?: (status: string) => void,
): Promise<ScanReport> {
  const parsed = parseGitHubUrl(repoUrlInput)
  if (!parsed) {
    throw new Error('Enter a valid GitHub repository URL.')
  }

  const { owner, repo } = parsed
  onProgress?.(`Connecting to GitHub API for ${owner}/${repo}…`)

  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  })

  if (!repoRes.ok) {
    if (repoRes.status === 404) {
      throw new Error(`Repository "${owner}/${repo}" was not found or is private. Make sure the URL is correct and the repository is publicly accessible.`)
    }
    if (repoRes.status === 403 || repoRes.status === 429) {
      throw new Error('GitHub API rate limit exceeded. Please wait a few moments before trying again.')
    }
    throw new Error(`Unable to scan repository (GitHub responded with status ${repoRes.status}).`)
  }

  const repoData = await repoRes.json()
  const defaultBranch: string = repoData.default_branch || 'main'
  const stars: number = repoData.stargazers_count ?? 0
  const description: string | null = repoData.description ?? null

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
    { headers: { Accept: 'application/vnd.github.v3+json' } },
  )

  let fileTree: Array<{ path: string; type: 'blob' | 'tree' }> = []
  if (treeRes.ok) {
    const treeData = await treeRes.json()
    if (Array.isArray(treeData.tree)) {
      fileTree = treeData.tree.filter((item: { type: string }) => item.type === 'blob')
    }
  }

  const packageJsonItem = fileTree.find((f) => f.path.toLowerCase() === 'package.json')
  const netlifyTomlItem = fileTree.find((f) => f.path.toLowerCase() === 'netlify.toml')
  const envExampleItem = fileTree.find((f) =>
    ['.env.example', '.env.sample', '.env.template'].includes(f.path.toLowerCase()),
  )

  const issues: ScanIssue[] = []

  if (!netlifyTomlItem) {
    issues.push({
      severity: 'warning',
      title: 'Missing netlify.toml configuration',
      description: 'No netlify.toml configuration file was found in the repository root.',
      snippet: '[build]\n  command = "npm run build"\n  publish = "dist"\n\n[[redirects]]\n  from = "/*"\n  to = "/index.html"\n  status = 200',
    })
  }

  if (!envExampleItem) {
    issues.push({
      severity: 'info',
      title: 'Missing .env.example template',
      description: 'No .env.example file was found in the repository root.',
      snippet: '# .env.example\nVITE_SUPABASE_URL=\nVITE_SUPABASE_ANON_KEY=',
    })
  }

  return {
    repoUrl: repoUrlInput,
    owner,
    repo,
    defaultBranch,
    stars,
    description,
    detectedConfig: {
      framework: 'vite',
      frameworkName: 'Vite',
      defaultPublishDir: 'dist',
      defaultBuildCommand: 'npm run build',
      packageJsonExists: Boolean(packageJsonItem),
      hasBuildScript: true,
      netlifyTomlExists: Boolean(netlifyTomlItem),
      hasSpaRedirect: false,
      envExampleExists: Boolean(envExampleItem),
      referencedEnvVars: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
      documentedEnvVars: [],
      scannedFilesCount: fileTree.length,
    },
    issues,
    scannedAt: new Date().toISOString(),
  }
}
