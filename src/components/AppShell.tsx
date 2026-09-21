import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function AppShell() {
  const { session, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-grid text-zinc-100">
      <header className="border-b border-white/10 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight text-white">
            <span className="grid size-8 place-items-center rounded-lg bg-lime-300 text-sm font-black text-zinc-950">D</span>
            deploybuddy
          </Link>
          <nav className="flex items-center gap-1 text-sm" aria-label="Primary navigation">
            <NavLink to="/scan" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>Scan repo</NavLink>
            {session ? (
              <>
                <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>Dashboard</NavLink>
                <button type="button" className="nav-link" onClick={() => void signOut()}>Sign out</button>
              </>
            ) : (
              <NavLink to="/login" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>Sign in</NavLink>
            )}
          </nav>
        </div>
      </header>
      <main><Outlet /></main>
    </div>
  )
}
