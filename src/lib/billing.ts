export function buildCheckoutUrl(userId: string, email: string): string | null {
  const baseUrl = import.meta.env.VITE_LEMONSQUEEZY_CHECKOUT_URL
  if (!baseUrl || typeof baseUrl !== 'string' || !baseUrl.trim()) {
    return null
  }

  try {
    const url = new URL(baseUrl.trim())
    url.searchParams.set('checkout[email]', email)
    url.searchParams.set('checkout[custom][user_id]', userId)
    return url.toString()
  } catch {
    const separator = baseUrl.includes('?') ? '&' : '?'
    const params = new URLSearchParams()
    params.set('checkout[email]', email)
    params.set('checkout[custom][user_id]', userId)
    return `${baseUrl.trim()}${separator}${params.toString()}`
  }
}

