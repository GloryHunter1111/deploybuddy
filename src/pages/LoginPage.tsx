import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured, supabase, supabaseConfigurationMessage } from '../lib/supabase'

export function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const destination = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  if (session) return <Navigate to={destination} replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) { setError(supabaseConfigurationMessage); return }
    setError('')
    setIsSubmitting(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setIsSubmitting(false)
    if (signInError) { setError('We could not sign you in. Check your email and password, then try again.'); return }
    navigate(destination, { replace: true })
  }

  return <section className="mx-auto grid min-h-[calc(100vh-65px)] max-w-md place-items-center px-5 py-12">
    <div className="w-full rounded-2xl border border-white/10 bg-zinc-900/70 p-7 shadow-2xl shadow-black/20">
      <p className="eyebrow">Workspace access</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Welcome back.</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-400">Sign in to access your saved deployment projects.</p>
      {!isSupabaseConfigured && <div className="mt-6 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm leading-6 text-amber-100">{supabaseConfigurationMessage}</div>}
      <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
        <div><label htmlFor="email" className="label">Email</label><input className="input-field mt-2" id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
        <div><label htmlFor="password" className="label">Password</label><input className="input-field mt-2" id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
        {error && <p className="text-sm text-rose-300" role="alert">{error}</p>}
        <button className="button-primary w-full" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  </section>
}
