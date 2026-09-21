import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function DashboardPage() {
  const { session } = useAuth()
  return <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
    <p className="eyebrow">Your workspace</p>
    <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-4xl font-semibold tracking-tight text-white">Saved projects</h1><p className="mt-3 text-zinc-400">Signed in as {session?.user.email ?? 'your account'}.</p></div>
      <Link className="button-primary" to="/scan">Scan a repository <span aria-hidden="true">→</span></Link>
    </div>
    <div className="mt-10 rounded-2xl border border-dashed border-white/15 bg-zinc-900/40 px-6 py-16 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-xl bg-zinc-800 font-mono text-lime-300">0</div>
      <h2 className="mt-5 text-xl font-medium text-white">No projects saved yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">Project saving will arrive with the Supabase database phase. For now, run a readiness preview and explore the workflow.</p>
      <Link className="button-secondary mt-6" to="/scan">Open repository scanner</Link>
    </div>
  </section>
}
