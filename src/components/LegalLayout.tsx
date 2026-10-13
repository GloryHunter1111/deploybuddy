import type { ReactNode } from 'react'
import { LEGAL_LAST_UPDATED } from '../lib/site'

type LegalLayoutProps = {
  title: string
  children: ReactNode
}

export function LegalLayout({ title, children }: LegalLayoutProps) {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
      <p className="eyebrow">DeployBuddy</p>
      <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">{title}</h1>
      <p className="mt-5 text-sm text-zinc-500">Last updated: {LEGAL_LAST_UPDATED}</p>
      <div className="mt-12 space-y-10 text-zinc-400">{children}</div>
    </section>
  )
}
