import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { deleteProject, getUserPlan, getUserProjects, type ProjectRecord, rescanProject } from '../lib/projects'
import { isSupabaseConfigured, supabaseConfigurationMessage } from '../lib/supabase'

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Never'
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins === 1) return '1 minute ago'
    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours === 1) return '1 hour ago'
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateString
  }
}

export function DashboardPage() {
  const { session } = useAuth()
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [rescanningId, setRescanningId] = useState<string | null>(null)
  const [rescanStatus, setRescanStatus] = useState<string>('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  async function loadDashboardData() {
    if (!session) return

    if (!isSupabaseConfigured) {
      setError(supabaseConfigurationMessage)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const [fetchedProjects, userPlan] = await Promise.all([
        getUserProjects(session.user.id),
        getUserPlan(session.user.id),
      ])
      setProjects(fetchedProjects)
      setPlan(userPlan)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load projects.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboardData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id])

  async function handleRescan(project: ProjectRecord) {
    if (rescanningId) return
    setRescanningId(project.id)
    setRescanStatus('Connecting…')

    try {
      const { project: updated } = await rescanProject(project, (status) => {
        setRescanStatus(status)
      })

      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setToastMessage(`Re-scan completed for ${project.name}`)
      window.setTimeout(() => setToastMessage(null), 3500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Re-scan failed.'
      setError(`Re-scan failed: ${msg}`)
    } finally {
      setRescanningId(null)
      setRescanStatus('')
    }
  }

  async function handleDelete(projectId: string, name: string) {
    if (!session) return
    const confirmed = window.confirm(`Are you sure you want to remove "${name}" from your workspace?`)
    if (!confirmed) return

    try {
      await deleteProject(projectId, session.user.id)
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
      setToastMessage(`Project "${name}" removed.`)
      window.setTimeout(() => setToastMessage(null), 3000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete project.'
      setError(msg)
    }
  }

  const isFreePlan = plan === 'free'
  const isLimitReached = isFreePlan && projects.length >= 1

  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
      <p className="eyebrow">Your workspace</p>
      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-semibold tracking-tight text-white">Saved projects</h1>
            <span className={`badge ${plan === 'pro' ? 'badge-success' : 'badge-info'}`}>
              {plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
            </span>
          </div>
          <p className="mt-3 text-zinc-400">
            Signed in as <span className="text-zinc-200">{session?.user.email ?? 'your account'}</span>.
            {isFreePlan && ` • Free plan limit: ${projects.length}/1 project used`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link className="button-primary" to="/scan">
            Scan a repository <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      {toastMessage && (
        <div className="mt-6 rounded-xl border border-lime-400/20 bg-lime-400/10 p-3.5 text-sm text-lime-200 animate-in flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="font-bold">✓</span> {toastMessage}
          </span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-xs text-lime-300/80 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm leading-6 text-rose-200 animate-in" role="alert">
          <p className="font-medium text-rose-100">Workspace notice</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* Free Plan Limit Notice */}
      {isLimitReached && !isLoading && (
        <div className="mt-8 rounded-2xl border border-amber-400/20 bg-zinc-900/60 p-5 backdrop-blur">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="badge badge-warning">1/1 Free slot</span>
                <h2 className="text-base font-semibold text-white">You're using your 1 free saved project slot</h2>
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                Free plan users can save 1 project at a time. Upgrade to Pro for unlimited project tracking and automated Netlify deployments.
              </p>
            </div>
            <button
              type="button"
              onClick={() => alert("Stripe subscription billing will arrive in Phase 2.")}
              className="button-primary text-xs py-2 px-3.5 whitespace-nowrap self-start sm:self-center"
            >
              Upgrade to Pro
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      {isLoading ? (
        <div className="mt-10 rounded-2xl border border-white/10 bg-zinc-900/30 p-12 text-center">
          <svg className="mx-auto size-8 animate-spin text-lime-300" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="mt-4 text-sm text-zinc-400">Loading saved projects from Supabase…</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-white/15 bg-zinc-900/40 px-6 py-16 text-center animate-in">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-zinc-800 font-mono text-lime-300">0</div>
          <h2 className="mt-5 text-xl font-medium text-white">No projects saved yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
            Scan a repository to inspect its deployment readiness, then click “Save this project” to track it in your workspace.
          </p>
          <Link className="button-secondary mt-6" to="/scan">
            Open repository scanner
          </Link>
        </div>
      ) : (
        <div className="mt-10 space-y-4 animate-in">
          {projects.map((project) => {
            const issues = project.last_scan_result?.issues || []
            const criticalCount = issues.filter((i) => i.severity === 'critical').length
            const warningCount = issues.filter((i) => i.severity === 'warning').length
            const infoCount = issues.filter((i) => i.severity === 'info').length
            const isRescanning = rescanningId === project.id
            const lastScannedTime = project.last_scan_result?.scannedAt || project.updated_at

            return (
              <article
                key={project.id}
                className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 shadow-xl shadow-black/20 transition-all hover:border-white/20"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-semibold text-white">
                        <a
                          href={project.repo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-lime-300 hover:underline transition-colors"
                        >
                          {project.name}
                        </a>
                      </h2>
                      {project.framework && (
                        <span className="badge badge-info">{project.framework}</span>
                      )}
                    </div>

                    <p className="mt-2 text-xs text-zinc-400 font-mono">
                      Repo: <span className="text-zinc-300">{project.repo_url}</span>
                      {' • '}
                      Last scanned: <span className="text-zinc-300">{formatRelativeTime(lastScannedTime)}</span>
                    </p>
                  </div>

                  {/* Badges for Scan Status */}
                  <div className="flex flex-wrap items-center gap-2 self-start">
                    {issues.length === 0 ? (
                      <span className="badge badge-success">0 Issues • Ready</span>
                    ) : (
                      <>
                        {criticalCount > 0 && (
                          <span className="badge badge-critical">{criticalCount} Critical</span>
                        )}
                        {warningCount > 0 && (
                          <span className="badge badge-warning">
                            {warningCount} Warning{warningCount > 1 ? 's' : ''}
                          </span>
                        )}
                        {infoCount > 0 && (
                          <span className="badge badge-info">{infoCount} Info</span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Scan Summary Preview */}
                <div className="mt-5 rounded-xl border border-white/5 bg-zinc-950/70 p-4">
                  {issues.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-lime-300">
                      <span>✓</span>
                      <span>Repository is properly configured for Netlify. No action items required.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Top Action Items ({issues.length} total)
                      </p>
                      <ul className="space-y-1.5">
                        {issues.slice(0, 3).map((issue, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-xs text-zinc-300">
                            <span className={`size-1.5 rounded-full shrink-0 ${issue.severity === 'critical' ? 'bg-rose-400' : issue.severity === 'warning' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                            <span className="truncate">{issue.title}</span>
                          </li>
                        ))}
                      </ul>
                      {issues.length > 3 && (
                        <p className="text-xs text-zinc-500 pt-1">
                          + {issues.length - 3} more issue{issues.length - 3 > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions Bar */}
                <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      to={`/scan?repo=${encodeURIComponent(project.repo_url)}`}
                      className="button-primary text-xs py-2 px-3.5"
                    >
                      View full report <span aria-hidden="true">→</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => void handleRescan(project)}
                      disabled={isRescanning}
                      className="button-secondary text-xs py-2 px-3.5 flex items-center gap-2"
                    >
                      {isRescanning ? (
                        <>
                          <svg className="size-3.5 animate-spin text-lime-300" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span>{rescanStatus || 'Scanning…'}</span>
                        </>
                      ) : (
                        <>
                          <span>↻</span> Re-scan repo
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleDelete(project.id, project.name)}
                    className="text-xs text-zinc-500 hover:text-rose-300 transition-colors"
                  >
                    Remove project
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
