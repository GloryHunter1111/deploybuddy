import {
  analyzeRepository,
  RepoSource,
  RepoTreeItem,
  ScanReport,
  ScanIssue,
  DetectedConfig,
  IssueSeverity,
} from '../scanner-core/analyze'

export type { IssueSeverity, ScanIssue, DetectedConfig, ScanReport }

interface GitHubTreeItem {
  path: string
  mode?: string
  type: 'blob' | 'tree'
  sha?: string
  size?: number
  url?: string
}

function parseGitHubUrl(input: string): { owner: string; repo: string } | null {
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

function decodeBase64Utf8(base64: string): string {
  try {
    const clean = base64.replace(/\s/g, '')
    const binary = Buffer.from(clean, 'base64').toString('utf-8')
    return binary
  } catch {
    return Buffer.from(base64, 'base64').toString('utf-8')
  }
}

function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'DeployBuddy-Scanner-Function',
  }

  const token = process.env.GITHUB_TOKEN
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`
  }

  return headers
}

async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string | null> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(ref)}`

  try {
    const headers = getGitHubHeaders()
    headers.Accept = 'application/vnd.github.raw+json'

    const response = await fetch(apiUrl, { headers })

    if (!response.ok) {
      if (response.status === 404) return null

      const rawHeaders = getGitHubHeaders()
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`
      const rawRes = await fetch(rawUrl, { headers: rawHeaders })
      if (rawRes.ok) {
        return await rawRes.text()
      }
      return null
    }

    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const data = await response.json()
      if (typeof data === 'string') return data
      if (data && data.content && data.encoding === 'base64') {
        return decodeBase64Utf8(data.content)
      }
      if (data && typeof data === 'object' && 'message' in data) {
        return null
      }
      return JSON.stringify(data, null, 2)
    }

    return await response.text()
  } catch {
    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`
      const rawRes = await fetch(rawUrl, { headers: getGitHubHeaders() })
      if (rawRes.ok) return await rawRes.text()
    } catch {
      // ignore
    }
    return null
  }
}

async function performServerScan(repoUrlInput: string): Promise<ScanReport> {
  const parsed = parseGitHubUrl(repoUrlInput)
  if (!parsed) {
    throw new Error('Enter a valid GitHub repository URL, such as https://github.com/owner/repository.')
  }

  const { owner, repo } = parsed
  const githubHeaders = getGitHubHeaders()

  // 1. Fetch Repository Details
  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: githubHeaders,
  })

  if (!repoRes.ok) {
    if (repoRes.status === 404) {
      throw new Error(`Repository "${owner}/${repo}" was not found or is private. Make sure the URL is correct and the repository is publicly accessible.`)
    }
    if (repoRes.status === 403 || repoRes.status === 429) {
      throw new Error('GitHub API rate limit exceeded. Please wait a few moments before trying again.')
    }
    throw new Error(`Unable to scan repository (GitHub API returned status ${repoRes.status}).`)
  }

  const repoData = await repoRes.json()
  const defaultBranch: string = repoData.default_branch || 'main'
  const stars: number = repoData.stargazers_count ?? 0
  const description: string | null = repoData.description ?? null

  // 2. Fetch Git Tree recursively
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
    { headers: githubHeaders },
  )

  let fileTree: GitHubTreeItem[] = []
  if (treeRes.ok) {
    const treeData = await treeRes.json()
    if (Array.isArray(treeData.tree)) {
      fileTree = treeData.tree.filter((item: GitHubTreeItem) => item.type === 'blob')
    }
  } else {
    const contentsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, {
      headers: githubHeaders,
    })
    if (contentsRes.ok) {
      const contents = await contentsRes.json()
      if (Array.isArray(contents)) {
        fileTree = contents.map((item) => ({
          path: item.path || item.name,
          type: item.type === 'dir' ? 'tree' : 'blob',
          size: item.size,
        }))
      }
    }
  }

  if (fileTree.length === 0) {
    throw new Error(`The repository "${owner}/${repo}" appears to be empty or has no accessible files on branch "${defaultBranch}".`)
  }

  const source: RepoSource = {
    tree: fileTree as RepoTreeItem[],
    getFile: (path: string) => fetchFileContent(owner, repo, path, defaultBranch),
    now: () => Date.now(),
  }

  return analyzeRepository(source, {
    repoUrl: repoUrlInput,
    owner,
    repo,
    defaultBranch,
    stars,
    description,
  })
}

/**
 * Netlify Function Handler
 */
export const handler = async (event: {
  httpMethod: string
  body?: string | null
  queryStringParameters?: Record<string, string | undefined>
}) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    }
  }

  try {
    let repoUrl = ''

    if (event.body) {
      try {
        const parsedBody = JSON.parse(event.body)
        repoUrl = parsedBody.repoUrl || parsedBody.repo || ''
      } catch {
        // body not json
      }
    }

    if (!repoUrl && event.queryStringParameters) {
      repoUrl = event.queryStringParameters.repoUrl || event.queryStringParameters.repo || ''
    }

    if (!repoUrl) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Please provide a repository URL in repoUrl.' }),
      }
    }

    const report = await performServerScan(repoUrl)

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(report),
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal scanner error.'
    const statusCode = message.includes('not found') ? 404 : message.includes('rate limit') ? 429 : 400

    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({ error: message }),
    }
  }
}
