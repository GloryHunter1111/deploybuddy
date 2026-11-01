import * as crypto from 'crypto'

interface NetlifyEvent {
  httpMethod?: string
  body?: string | null
  isBase64Encoded?: boolean
  headers?: Record<string, string | undefined>
  requestContext?: {
    http?: {
      method?: string
    }
  }
}

interface WebhookResult {
  statusCode: number
  body: string
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function processWebhook(
  rawBody: string,
  signature: string | undefined,
  httpMethod: string,
): Promise<WebhookResult> {
  if (httpMethod.toUpperCase() !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secret || !signature) {
    return { statusCode: 401, body: 'Unauthorized' }
  }

  const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const hmacBuffer = Buffer.from(hmac, 'utf-8')
  const sigBuffer = Buffer.from(signature, 'utf-8')

  if (hmacBuffer.length !== sigBuffer.length || !crypto.timingSafeEqual(hmacBuffer, sigBuffer)) {
    return { statusCode: 401, body: 'Invalid signature' }
  }

  let payload: {
    meta?: {
      event_name?: string
      custom_data?: {
        user_id?: string
      }
    }
    data?: {
      attributes?: {
        status?: string
        ends_at?: string | null
      }
    }
  }

  try {
    payload = JSON.parse(rawBody)
  } catch {
    return { statusCode: 200, body: 'Ignored: invalid JSON' }
  }

  const eventName = payload?.meta?.event_name || 'unknown'
  const userId = payload?.meta?.custom_data?.user_id
  const status = payload?.data?.attributes?.status
  const endsAt = payload?.data?.attributes?.ends_at

  if (typeof userId !== 'string' || !UUID_REGEX.test(userId.trim())) {
    console.log(`Event: ${eventName} - Success`)
    return { statusCode: 200, body: 'Ignored: invalid or missing user_id' }
  }

  if (typeof eventName !== 'string' || !eventName.startsWith('subscription_')) {
    console.log(`Event: ${eventName} - Success`)
    return { statusCode: 200, body: 'Ignored: non-subscription event' }
  }

  let plan: 'pro' | 'free' | null = null

  if (status === 'active' || status === 'on_trial') {
    plan = 'pro'
  } else if (status === 'cancelled') {
    const isFuture = Boolean(
      endsAt && !isNaN(Date.parse(endsAt)) && Date.parse(endsAt) > Date.now(),
    )
    plan = isFuture ? 'pro' : 'free'
  } else if (status === 'expired' || status === 'unpaid' || status === 'paused') {
    plan = 'free'
  } else if (status === 'past_due') {
    console.log(`Event: ${eventName} - Success`)
    return { statusCode: 200, body: 'Ignored: past_due status requires no plan change' }
  } else {
    console.log(`Event: ${eventName} - Success`)
    return { statusCode: 200, body: 'Ignored: unhandled status' }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '')
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(`Event: ${eventName} - Failure`)
    return { statusCode: 500, body: 'Database configuration missing' }
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId.trim())}`,
      {
        method: 'PATCH',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ plan }),
      },
    )

    if (!response.ok) {
      console.error(`Event: ${eventName} - Failure`)
      return { statusCode: 500, body: 'Database update failed' }
    }

    console.log(`Event: ${eventName} - Success`)
    return { statusCode: 200, body: 'Plan updated' }
  } catch {
    console.error(`Event: ${eventName} - Failure`)
    return { statusCode: 500, body: 'Database update failed' }
  }
}

export const handler = async (event: NetlifyEvent | Request) => {
  if (typeof Request !== 'undefined' && event instanceof Request) {
    const rawBody = await event.text()
    const signature = event.headers.get('x-signature') ?? undefined
    const result = await processWebhook(rawBody, signature, event.method)
    return new Response(result.body, { status: result.statusCode })
  }

  const netlifyEvent = event as NetlifyEvent
  const rawBody =
    netlifyEvent.isBase64Encoded && netlifyEvent.body
      ? Buffer.from(netlifyEvent.body, 'base64').toString('utf-8')
      : (netlifyEvent.body ?? '')

  const headers = netlifyEvent.headers || {}
  const signature =
    headers['x-signature'] ||
    headers['X-Signature'] ||
    Object.entries(headers).find(([k]) => k.toLowerCase() === 'x-signature')?.[1]

  const method =
    netlifyEvent.httpMethod || (netlifyEvent.requestContext?.http?.method ?? 'GET')

  return await processWebhook(rawBody, signature, method)
}

export default handler

