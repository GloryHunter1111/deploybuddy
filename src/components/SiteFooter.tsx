import { Link } from 'react-router-dom'
import { CONTACT_EMAIL } from '../lib/site'

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-zinc-950/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-6 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} DeployBuddy</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer navigation">
          <Link to="/pricing" className="transition-colors hover:text-white">Pricing</Link>
          <Link to="/terms" className="transition-colors hover:text-white">Terms</Link>
          <Link to="/privacy" className="transition-colors hover:text-white">Privacy</Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="transition-colors hover:text-white">Contact</a>
        </nav>
      </div>
    </footer>
  )
}
