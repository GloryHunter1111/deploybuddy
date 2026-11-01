import { type FormEvent, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { isSupabaseConfigured, supabase, supabaseConfigurationMessage } from '../lib/supabase'

type Step = 'verify' | 'password' | 'success'

export function ResetPasswordPage() {
  const location = useLocation()
  const routerEmail = (location.state as { email?: string } | null)?.email || ''

  const [step, setStep] = useState<Step>('verify')
  const [email, setEmail] = useState(routerEmail)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [resendMessage, setResendMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  useEffect(() => {
    if (step === 'success' && supabase) {
      void supabase.auth.signOut()
    }
  }, [step])

  async function handleVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) {
      setError(supabaseConfigurationMessage)
      return
    }

    const trimmedEmail = email.trim()
    const trimmedCode = code.trim()

    if (!trimmedEmail) {
      setError('Please enter your email address.')
      return
    }

    if (trimmedCode.length !== 6) {
      setError('That code is invalid or has expired.')
      return
    }

    setError('')
    setResendMessage('')
    setIsSubmitting(true)

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedCode,
        type: 'recovery',
      })

      if (verifyError || (!data?.user && !data?.session)) {
        setIsSubmitting(false)
        setError('That code is invalid or has expired.')
        return
      }

      setIsSubmitting(false)
      setError('')
      setStep('password')
    } catch {
      setIsSubmitting(false)
      setError('That code is invalid or has expired.')
    }
  }

  async function handleResendCode() {
    if (resendCooldown > 0 || isResending) return
    if (!supabase) {
      setError(supabaseConfigurationMessage)
      return
    }

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Please enter your email address to receive a code.')
      return
    }

    setError('')
    setResendMessage('')
    setIsResending(true)

    try {
      const { error: resendError } = await supabase.auth.resetPasswordForEmail(trimmedEmail)
      if (resendError) {
        const msg = (resendError.message || '').toLowerCase()
        const status = (resendError as { status?: number }).status
        const isRateLimit =
          status === 429 ||
          msg.includes('rate limit') ||
          msg.includes('too many requests') ||
          msg.includes('security purposes')

        if (isRateLimit) {
          setError('Too many requests. Please wait a few moments before trying again.')
          setIsResending(false)
          return
        }
      }

      setResendMessage('A new 6-digit code has been sent to your email.')
      setResendCooldown(60)
    } catch {
      setError('Failed to resend code. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
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
      if (updateError) {
        setIsSubmitting(false)
        setError(updateError.message || 'Failed to update password. Please try again.')
        return
      }

      await supabase.auth.signOut()
      setPassword('')
      setConfirmPassword('')
      setIsSubmitting(false)
      setStep('success')
    } catch {
      setIsSubmitting(false)
      setError('Failed to update password. Please try again.')
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

        {step === 'verify' && (
          <div className="mt-3">
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Enter reset code.
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Check your email for a 6-digit verification code.
            </p>

            <form className="mt-7 space-y-4" onSubmit={handleVerifySubmit}>
              <div>
                <label htmlFor="email" className="label">
                  Email
                </label>
                <input
                  className="input-field mt-2"
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="code" className="label">
                  6-digit code
                </label>
                <input
                  className="input-field mt-2 tracking-widest text-lg font-mono placeholder:tracking-normal placeholder:font-sans"
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => {
                    const nextValue = event.target.value.replace(/\D/g, '').slice(0, 6)
                    setCode(nextValue)
                  }}
                  placeholder="123456"
                  required
                />
              </div>

              {resendMessage && (
                <div
                  className="rounded-lg border border-lime-400/20 bg-lime-400/10 p-3 text-sm leading-6 text-lime-200"
                  role="status"
                >
                  {resendMessage}
                </div>
              )}

              {error && (
                <p className="text-sm text-rose-300" role="alert">
                  {error}
                </p>
              )}

              <button className="button-primary w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Verifying code…' : 'Verify code'}
              </button>

              <div>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || isResending}
                  className="button-secondary w-full"
                >
                  {resendCooldown > 0
                    ? `Resend code (${resendCooldown}s)`
                    : isResending
                      ? 'Resending…'
                      : 'Resend code'}
                </button>
              </div>

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

        {step === 'password' && (
          <div className="mt-3">
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Set new password.
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Please choose a new password that is at least 8 characters long.
            </p>

            <form className="mt-7 space-y-4" onSubmit={handlePasswordSubmit}>
              <div>
                <label htmlFor="new-password" className="label">
                  New password
                </label>
                <input
                  className="input-field mt-2"
                  id="new-password"
                  name="new-password"
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
                  name="confirm-password"
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

        {step === 'success' && (
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
        )}
      </div>
    </section>
  )
}
