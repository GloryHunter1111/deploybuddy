import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BILLING_ENABLED, buildCheckoutUrl } from '../lib/billing'
import { getUserPlan } from '../lib/projects'
import { PRO_PRICE_USD } from '../lib/site'

const freeFeatures = [
  'Scan any public GitHub repository',
  'Plain-English fix list with copyable snippets',
  '1 saved project on your dashboard',
  'Fair-use limits may apply to scans',
]

const proFeatures = [
  'Everything in Free',
  'Unlimited saved projects',
  'Saved scan history and re-scans',
  'More features planned',
]

export function PricingPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    if (!session?.user?.id) {
      setPlan('free')
      return
    }

    void getUserPlan(session.user.id).then((userPlan) => {
      if (isMounted) {
        setPlan(userPlan)
      }
    })

    return () => {
      isMounted = false
    }
  }, [session?.user?.id])

  function handleSubscribe() {
    setCheckoutMessage(null)
    if (!session) {
      navigate('/login')
      return
    }

    const checkoutUrl = buildCheckoutUrl(session.user.id, session.user.email ?? '')
    if (!checkoutUrl) {
      setCheckoutMessage('Checkout isn’t available yet.')
      return
    }

    window.location.href = checkoutUrl
  }

  const isPro = plan === 'pro'

  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
      <div className="max-w-2xl">
        <p className="eyebrow">Pricing</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
          Simple pricing, no surprises.
        </h1>
      </div>

      {BILLING_ENABLED ? (
        <>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-zinc-950/80 p-7 sm:p-8">
              <p className="text-lg font-medium text-white">Free</p>
              <p className="mt-5 text-4xl font-semibold tracking-tight text-white">$0</p>
              <ul className="mt-8 space-y-4 text-sm leading-6 text-zinc-400">
                {freeFeatures.map((feature) => (
                  <li key={feature} className="flex gap-3">
                    <span className="text-lime-300">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link to="/scan" className="button-primary mt-10 w-full">
                Scan a repository <span aria-hidden="true">→</span>
              </Link>
            </article>

            <article className="rounded-2xl border border-lime-300/30 bg-zinc-950/80 p-7 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <p className="text-lg font-medium text-white">Pro</p>
                {isPro && <span className="badge badge-success">Current plan</span>}
              </div>
              <p className="mt-5 text-4xl font-semibold tracking-tight text-white">
                ${PRO_PRICE_USD}
                <span className="text-base font-medium text-zinc-500"> per month</span>
              </p>
              <ul className="mt-8 space-y-4 text-sm leading-6 text-zinc-400">
                {proFeatures.map((feature) => (
                  <li key={feature} className="flex gap-3">
                    <span className="text-lime-300">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              {isPro ? (
                <button type="button" className="button-secondary mt-10 w-full" disabled>
                  You’re on Pro
                </button>
              ) : (
                <button type="button" onClick={handleSubscribe} className="button-primary mt-10 w-full">
                  Subscribe
                </button>
              )}
              {checkoutMessage && (
                <p className="mt-3 text-center text-sm text-amber-300" role="status">
                  {checkoutMessage}
                </p>
              )}
            </article>
          </div>

          <p className="mt-8 max-w-3xl text-sm leading-6 text-zinc-500">
            Prices are in US dollars. Subscriptions renew monthly and can be cancelled at any time.
            Payments will be handled by Lemon Squeezy, our merchant of record. See our{' '}
            <Link to="/terms" className="text-zinc-300 underline decoration-zinc-600 underline-offset-4 hover:text-white">
              Terms
            </Link>{' '}
            for refunds.
          </p>
        </>
      ) : (
        <div className="mt-12 mx-auto max-w-md">
          <article className="rounded-2xl border border-white/10 bg-zinc-950/80 p-7 sm:p-8">
            <p className="text-lg font-medium text-white">Free</p>
            <p className="mt-5 text-4xl font-semibold tracking-tight text-white">$0</p>
            <ul className="mt-8 space-y-4 text-sm leading-6 text-zinc-400">
              {freeFeatures.map((feature) => (
                <li key={feature} className="flex gap-3">
                  <span className="text-lime-300">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <Link to="/scan" className="button-primary mt-10 w-full">
              Scan a repository <span aria-hidden="true">→</span>
            </Link>
          </article>
          <p className="mt-6 text-center text-sm text-zinc-400">
            DeployBuddy is free while in early beta.
          </p>
        </div>
      )}
    </section>
  )
}
