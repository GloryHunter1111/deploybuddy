import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase, supabaseConfigurationMessage } from '../lib/supabase'

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) {
      setError(supabaseConfigurationMessage)
      return
    }

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Please enter your email address.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail)

      if (resetError) {
        const msg = (resetError.message || '').toLowerCase()
        const status = (resetError as { status?: number }).status
        const isRateLimit =
          status === 429 ||
          msg.includes('rate limit') ||
          msg.includes('too many requests') ||
          msg.includes('security purposes')
        const isNetwork =
          status === 0 ||
          msg.includes('fetch') ||
          msg.includes('network') ||
          msg.includes('failed to fetch')

        if (isRateLimit) {
          setIsSubmitting(false)
          setError('Too many requests. Please wait a few moments before trying again.')
          return
        }

        if (isNetwork) {
          setIsSubmitting(false)
          setError('Network error. Please check your connection and try again.')
          return
        }

        // For all other errors (such as email not found), show neutral behavior and navigate
      }

      setIsSubmitting(false)
      navigate('/reset-password', { state: { email: trimmedEmail } })
    } catch (err: unknown) {
      setIsSubmitting(false)
      const errorObj = err as { message?: string }
      const msg = (errorObj?.message || '').toLowerCase()
      if (msg.includes('rate limit') || msg.includes('too many requests')) {
        setError('Too many requests. Please wait a few moments before trying again.')
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
        setError('Network error. Please check your connection and try again.')
      } else {
        navigate('/reset-password', { state: { email: trimmedEmail } })
      }
    }
  }

  return (
    <section className="mx-auto grid min-h-[calc(100vh-65px)] max-w-md place-items-center px-5 py-12">
      <div className="w-full rounded-2xl border border-white/10 bg-zinc-900/70 p-7 shadow-2xl shadow-black/20">
        <p className="eyebrow">Account recovery</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          Reset password.
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Enter your email address and we'll send you a 6-digit code to reset your password.
        </p>

        {!isSupabaseConfigured && (
          <div className="mt-6 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm leading-6 text-amber-100">
            {supabaseConfigurationMessage}
          </div>
        )}

        <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              className="input-field mt-2"
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-rose-300" role="alert">
              {error}
            </p>
          )}
          <button className="button-primary w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending code…' : 'Send reset code'}
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
    </section>
  )
}
