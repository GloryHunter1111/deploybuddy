import { type FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { parseGitHubUrl, scanRepository, type ScanReport } from '../lib/scanner'

export function ScanPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialRepo = searchParams.get('repo') || ''

  const [repoUrl, setRepoUrl] = useState(initialRepo)
  const [error, setError] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState('')
  const [report, setReport] = useState<ScanReport | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  async function performScan(targetUrl: string) {
    const parsed = parseGitHubUrl(targetUrl)
    if (!parsed) {
      setError('Enter a valid GitHub repository URL, such as https://github.com/owner/repository.')
      setReport(null)
      return
    }

    setError('')
    setIsScanning(true)
    setScanStatus('Connecting to GitHub…')

    try {
      const result = await scanRepository(targetUrl, (status) => {
        setScanStatus(status)
      })
      setReport(result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred while scanning the repository.'
      setError(message)
      setReport(null)
    } finally {
      setIsScanning(false)
      setScanStatus('')
    }
  }

  // If a repo URL was passed in the query param on initial load, trigger scan
  useEffect(() => {
    if (initialRepo) {
      void performScan(initialRepo)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = repoUrl.trim()
    if (!trimmed) {
      setError('Please provide a GitHub repository URL.')
      return
    }

    // Update query param
    setSearchParams({ repo: trimmed })
    void performScan(trimmed)
  }

  async function handleCopy(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      window.setTimeout(() => setCopiedIndex(null), 2000)
    } catch {
      // Fallback
    }
  }

  const criticalCount = report?.issues.filter((i) => i.severity === 'critical').length ?? 0
  const warningCount = report?.issues.filter((i) => i.severity === 'warning').length ?? 0
  const infoCount = report?.issues.filter((i) => i.severity === 'info').length ?? 0

  return (
    <section className="mx-auto max-w-4xl px-5 py-16 sm:py-24">
      <p className="eyebrow">Repository readiness scanner</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        Scan your repository.
      </h1>
      <p className="mt-4 max-w-2xl leading-7 text-zinc-400">
        Enter any public GitHub repository URL to inspect framework setup, detect missing Netlify configs, spot hardcoded credentials, and check environment variables before launching.
      </p>

      <form
        className="mt-10 rounded-2xl border border-white/10 bg-zinc-900/70 p-4 shadow-2xl shadow-black/20 sm:flex sm:gap-3"
        onSubmit={handleSubmit}
        noValidate
      >
        <label className="sr-only" htmlFor="repo-url">GitHub repository URL</label>
        <input
          id="repo-url"
          className="input-field"
          value={repoUrl}
          onChange={(event) => setRepoUrl(event.target.value)}
          placeholder="https://github.com/owner/repository"
          inputMode="url"
          disabled={isScanning}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          className="button-primary mt-3 w-full sm:mt-0 sm:w-auto whitespace-nowrap shrink-0"
          disabled={isScanning || !repoUrl.trim()}
          type="submit"
        >
          {isScanning ? 'Scanning…' : 'Scan repository'}
        </button>
      </form>

      {isScanning && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-lime-400/20 bg-zinc-900/50 p-4 animate-in">
          <svg className="size-5 animate-spin text-lime-300" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-sm font-medium text-zinc-300">{scanStatus || 'Inspecting repository…'}</p>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm leading-6 text-rose-200 animate-in" role="alert">
          <p className="font-medium text-rose-100">Scan failed</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {report && !isScanning && (
        <div className="mt-10 animate-in">
          {/* Header Summary */}
          <div className="mb-6 rounded-2xl border border-white/10 bg-zinc-900/80 p-5 backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-white">
                    <a
                      href={`https://github.com/${report.owner}/${report.repo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline hover:text-lime-300 transition-colors"
                    >
                      {report.owner}/{report.repo}
                    </a>
                  </h2>
                  <span className="badge badge-info">{report.detectedConfig.frameworkName}</span>
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                  Default branch: <span className="font-mono text-zinc-300">{report.defaultBranch}</span>
                  {' • '}
                  Scanned {report.detectedConfig.scannedFilesCount} files
                  {report.stars > 0 && ` • ★ ${report.stars}`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {report.issues.length === 0 ? (
                  <span className="badge badge-success">0 Issues • Ready to deploy</span>
                ) : (
                  <>
                    {criticalCount > 0 && <span className="badge badge-critical">{criticalCount} Critical</span>}
                    {warningCount > 0 && <span className="badge badge-warning">{warningCount} Warning{warningCount > 1 ? 's' : ''}</span>}
                    {infoCount > 0 && <span className="badge badge-info">{infoCount} Info</span>}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Issues List or Pass State */}
          {report.issues.length === 0 ? (
            <div className="rounded-2xl border border-lime-400/20 bg-zinc-900/50 p-8 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-xl bg-lime-400/10 font-mono text-lime-300">
                ✓
              </div>
              <h3 className="mt-4 text-xl font-medium text-white">All checks passed!</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
                Your repository has a detected framework of <strong className="text-zinc-200">{report.detectedConfig.frameworkName}</strong>, valid configuration, and no detected credential leaks.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {report.issues.map((issue, index) => (
                <article
                  className="rounded-xl border border-white/10 bg-zinc-900/60 p-5 shadow-lg shadow-black/10"
                  key={`${issue.title}-${index}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`badge badge-${issue.severity}`}>{issue.severity}</span>
                    <h3 className="font-medium text-white">{issue.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">{issue.description}</p>
                  {issue.snippet && (
                    <div className="relative mt-4">
                      <div className="flex items-center justify-between rounded-t-lg border-x border-t border-white/5 bg-zinc-900/90 px-3 py-1.5 text-xs text-zinc-400">
                        <span className="font-mono">Suggested fix</span>
                        <button
                          type="button"
                          onClick={() => void handleCopy(issue.snippet, index)}
                          className="font-mono text-xs text-zinc-300 hover:text-lime-300 transition-colors"
                        >
                          {copiedIndex === index ? 'Copied ✓' : 'Copy snippet'}
                        </button>
                      </div>
                      <pre className="overflow-x-auto rounded-b-lg border border-white/5 bg-zinc-950 p-3 text-xs text-lime-200 font-mono">
                        <code>{issue.snippet}</code>
                      </pre>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
