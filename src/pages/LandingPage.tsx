import { Link } from 'react-router-dom'

const features = [
  ['01', 'Read the signals', 'Turn unclear deployment errors into a simple, prioritized checklist.'],
  ['02', 'Ship prepared', 'Spot missing configs, environment variables, and routing setup before launch day.'],
  ['03', 'Keep moving', 'A calm workspace for the parts between “it works locally” and “it’s live.”'],
]

export function LandingPage() {
  return (
    <div>
      <section className="mx-auto max-w-6xl px-5 pb-20 pt-20 sm:pt-28">
        <p className="eyebrow">Deployment clarity for builders</p>
        <div className="mt-6 max-w-4xl">
          <h1 className="text-balance text-5xl font-semibold tracking-[-0.055em] text-white sm:text-7xl">Go from repository to ready.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">DeployBuddy translates deployment setup into a focused next step. Start with a repository URL; leave the guesswork behind.</p>
        </div>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link to="/scan" className="button-primary">Scan a repository <span aria-hidden="true">→</span></Link>
          <Link to="/login" className="button-secondary">Sign in to your workspace</Link>
        </div>
        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3">
          {features.map(([number, title, description]) => <article key={number} className="bg-zinc-950 p-6">
            <span className="font-mono text-xs text-lime-300">{number}</span>
            <h2 className="mt-8 text-lg font-medium text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
          </article>)}
        </div>
      </section>
    </div>
  )
}
