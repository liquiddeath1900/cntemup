// Upstash-backed rate limiter — fail-open if not configured or Upstash errors.
// Safe to deploy BEFORE the Upstash env vars are set: callers will see
// { allowed: true, skipped: true } and let the request through.
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let limiter = null
let limiterInitTried = false

function getLimiter() {
  if (limiter) return limiter
  if (limiterInitTried) return null
  limiterInitTried = true

  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    console.warn('Ratelimit: UPSTASH env vars missing — skipping (fail-open)')
    return null
  }

  limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    // 10 requests per hour per identifier. Tune in one place.
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    analytics: true,
    prefix: 'cnt:checkout',
  })
  return limiter
}

export function clientIp(req) {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}

export async function checkRateLimit(identifier) {
  const lim = getLimiter()
  if (!lim) return { allowed: true, skipped: true }

  try {
    const r = await lim.limit(identifier)
    return {
      allowed: r.success,
      limit: r.limit,
      remaining: r.remaining,
      reset: r.reset, // ms epoch when bucket resets
    }
  } catch (err) {
    // Upstash outage → fail open. Better to let legit users through than block everyone.
    console.error('Ratelimit check failed (fail-open):', err.message)
    return { allowed: true, error: err.message }
  }
}
