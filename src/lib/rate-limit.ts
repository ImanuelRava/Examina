/**
 * In-memory token-bucket rate limiter.
 *
 * Good enough for single-instance deployments (Vercel Hobby with one
 * serverless instance, self-hosted Node, Docker, etc.).
 *
 * For multi-instance production (Vercel Pro/Enterprise with concurrent
 * serverless invocations), replace this with a Redis-backed limiter
 * (e.g. @upstash/ratelimit) so the counter is shared across instances.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Periodically evict expired buckets to keep the Map bounded.
// (In serverless, this runs at most once per cold start; in long-running
// Node it runs once per minute.)
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      const now = Date.now()
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key)
      }
    },
    60 * 1000
  ).unref?.()
}

export interface RateLimitOptions {
  /** Identifier for the caller (typically IP or user id). */
  key: string
  /** Maximum requests allowed within the window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  /** Remaining requests in the current window. */
  remaining: number
  /** Epoch ms when the window resets. */
  resetAt: number
}

export function rateLimit(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(opts.key)

  let bucket: Bucket
  if (!existing || existing.resetAt <= now) {
    bucket = { count: 0, resetAt: now + opts.windowMs }
    buckets.set(opts.key, bucket)
  } else {
    bucket = existing
  }

  bucket.count += 1
  const allowed = bucket.count <= opts.limit
  return {
    allowed,
    remaining: Math.max(0, opts.limit - bucket.count),
    resetAt: bucket.resetAt,
  }
}

/** Extract a usable client IP from a Next.js request. */
export function clientIp(req: Request): string {
  const headers = req.headers
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  )
}

/** Standard rate-limit headers (RFC draft) attached to responses. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.allowed ? result.remaining : 0),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    'Retry-After': result.allowed ? '0' : String(Math.ceil((result.resetAt - Date.now()) / 1000)),
  }
}
