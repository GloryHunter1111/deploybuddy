import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isSupabaseConfigured, supabase, supabaseConfigurationMessage } from '../lib/supabase'

export function ResetPasswordPage() {
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [hasValidSession, setHasValidSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setIsCheckingSession(false)
      return
    }

    let isMounted = true

    // 1. Listen for the PASSWORD_RECOVERY event or an active session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return
      if (event === 'PASSWORD_RECOVERY' || (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION'))) {
        setHasValidSession(true)
        setIsCheckingSession(false)
      }
    })

    // 2. Check for an existing session
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!isMounted) return
      if (data?.session && !sessionError) {
        setHasValidSession(true)
        setIsCheckingSession(false)
      } else {
        const hash = window.location.hash
        const search = window.location.search
        const hasParams =
          hash.includes('access_token') ||
          hash.includes('type=recovery') ||
          search.includes('code=')

        if (!hasParams || hash.includes('error=')) {
          setIsCheckingSession(false)
        } else {
          // Allow time for Supabase client to parse URL tokens if present
          const timer = setTimeout(() => {
            if (isMounted) setIsCheckingSession(false)
          }, 1500)
          return () => clearTimeout(timer)
        }
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) {
      setError(supabaseConfigurationMessage)
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      setIsSubmitting(false)

      if (updateError) {
        setError(updateError.message || 'Failed to update password. Please try again.')
        return
      }

      setIsSuccess(true)
    } catch {
      setIsSubmitting(false)
      setError('An unexpected error occurred. Please try again.')
    }
  }

  return (
    <section className="mx-auto grid min-h-[calc(100vh-65px)] max-w-md place-items-center px-5 py-12">
      <div className="w-full rounded-2xl border border-white/10 bg-zinc-900/70 p-7 shadow-2xl shadow-black/20">
        <p className="eyebrow">Password recovery</p>

        {!isSupabaseConfigured && (
          <div className="mt-6 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm leading-6 text-amber-100">
            {supabaseConfigurationMessage}
          </div>
        )}

        {isCheckingSession ? (
          <div className="py-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Checking recovery session…
            </h1>
            <p className="mt-3 text-sm text-zinc-400">
              Please wait while we verify your password reset link.
            </p>
          </div>
        ) : !hasValidSession ? (
          <div className="mt-3">
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Invalid or expired link.
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              This reset link is invalid or has expired.
            </p>
            <div className="mt-6">
              <Link to="/forgot-password" className="button-primary w-full text-center">
                Request a new reset link
              </Link>
            </div>
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-zinc-400">
              <Link to="/forgot-password" className="hover:text-lime-300 hover:underline">
                Forgot password
              </Link>
              <span aria-hidden="true">•</span>
              <Link to="/login" className="hover:text-lime-300 hover:underline">
                Back to sign in
              </Link>
            </div>
          </div>
        ) : isSuccess ? (
          <div className="mt-3 space-y-6">
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Password updated.
            </h1>
            <div
              className="rounded-lg border border-lime-400/20 bg-lime-400/10 p-4 text-sm leading-6 text-lime-200"
              role="status"
            >
              Your password has been reset successfully.
            </div>
            <div>
              <Link to="/login" className="button-primary w-full text-center">
                Sign in
              </Link>
            </div>
            <div className="text-center text-sm text-zinc-400">
              <Link
                to="/login"
                className="font-medium text-lime-300 hover:text-lime-200 hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Set new password.
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Please choose a new password that is at least 8 characters long.
            </p>
            <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="new-password" className="label">
                  New password
                </label>
                <input
                  className="input-field mt-2"
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="label">
                  Confirm password
                </label>
                <input
                  className="input-field mt-2"
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={8}
                />
              </div>
              {error && (
                <p className="text-sm text-rose-300" role="alert">
                  {error}
                </p>
              )}
              <button className="button-primary w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating password…' : 'Update password'}
              </button>
              <div className="pt-2 text-center text-sm text-zinc-400">
                <Link
                  to="/login"
                  className="font-medium text-lime-300 hover:text-lime-200 hover:underline"
                >
                  Back to sign in
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  )
}
