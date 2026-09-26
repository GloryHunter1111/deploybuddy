import { type FormEvent, useState } from 'react'

type Issue = { severity: 'critical' | 'warning' | 'info'; title: string; description: string; snippet: string }

const previewIssues: Issue[] = [
  { severity: 'warning', title: 'Deployment configuration', description: 'A future live scan will verify your build command, output folder, and SPA redirects.', snippet: 'netlify.toml\n[build]\n  command = "npm run build"\n  publish = "dist"' },
  { severity: 'info', title: 'Environment variables', description: 'A future live scan will identify required environment variables without exposing their values.', snippet: 'VITE_SUPABASE_URL=\nVITE_SUPABASE_ANON_KEY=' },
]

export function ScanPage() {
  const [repoUrl, setRepoUrl] = useState('')
  const [error, setError] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      const url = new URL(repoUrl)
      if (!['github.com', 'www.github.com'].includes(url.hostname)) throw new Error()
    } catch {
      setError('Enter a valid GitHub repository URL, such as https://github.com/owner/repository.')
      return
    }
    setError('')
    setIsScanning(true)
    window.setTimeout(() => { setIsScanning(false); setShowPreview(true) }, 700)
  }

  return <section className="mx-auto max-w-4xl px-5 py-16 sm:py-24">
    <p className="eyebrow">Repository readiness</p>
    <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">See the path to deployment.</h1>
    <p className="mt-4 max-w-2xl leading-7 text-zinc-400">Paste a public GitHub URL to preview the DeployBuddy readiness report. Live repository scanning is the next planned phase.</p>
    <form className="mt-10 rounded-2xl border border-white/10 bg-zinc-900/70 p-4 shadow-2xl shadow-black/20 sm:flex sm:gap-3" onSubmit={handleSubmit} noValidate>
      <label className="sr-only" htmlFor="repo-url">GitHub repository URL</label>
      <input id="repo-url" className="input-field" value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/owner/repository" inputMode="url" />
      <button className="button-primary mt-3 w-full sm:mt-0 sm:w-auto" disabled={isScanning} type="submit">{isScanning ? 'Preparing preview…' : 'Preview report'}</button>
    </form>
    {error && <p className="mt-3 text-sm text-rose-300" role="alert">{error}</p>}
    {showPreview && <div className="mt-10 animate-in">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-medium text-white">Readiness preview</h2><span className="badge badge-info">Demo results</span></div>
      <p className="mb-5 text-sm text-zinc-400">These are illustrative checks only. DeployBuddy has not accessed or saved your repository.</p>
      <div className="space-y-3">{previewIssues.map((issue) => <article className="rounded-xl border border-white/10 bg-zinc-900/60 p-5" key={issue.title}>
        <div className="flex flex-wrap items-center gap-3"><span className={`badge badge-${issue.severity}`}>{issue.severity}</span><h3 className="font-medium text-white">{issue.title}</h3></div>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{issue.description}</p>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-white/5 bg-zinc-950 p-3 text-xs text-lime-200"><code>{issue.snippet}</code></pre>
      </article>)}</div>
    </div>}
  </section>
}
