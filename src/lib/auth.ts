import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Lightweight admin authentication:
 * HMAC-signed expiry token stored in an HttpOnly cookie.
 *
 * Required environment variables (set in your Vercel project settings,
 * scoped to Production / Preview environments):
 *   - ADMIN_PASSWORD  (plaintext password the admin types at /admin)
 *   - ADMIN_SECRET    (>= 32-char random string used to sign the session cookie)
 *
 * In production, the FIRST REQUEST that touches auth will fail with a clear
 * error if either env var is missing or weak. We do NOT throw at module-load
 * time, because Vercel runs `next build` without runtime env vars injected,
 * and an eager throw would break the build.
 *
 * In development, clearly-marked dev fallbacks are used so `next dev` works
 * out of the box without any env setup.
 */

export const ADMIN_COOKIE = 'examina_admin'
const WEEK_SECONDS = 60 * 60 * 24 * 7

const isProduction = process.env.NODE_ENV === 'production'

// -- Lazy secret resolution --------------------------------------------------
// Vercel only injects runtime env vars at request time, NOT at build time.
// So we must NOT call resolveSecret() at module top-level — otherwise the
// "Collecting page data" build step would throw on every deploy that hasn't
// added ADMIN_SECRET as a build env var (which is the correct setup: secrets
// should be runtime-only).
//
// We resolve once per cold start (the first request), then cache.

let cachedSecret: string | null = null
let cachedPassword: string | null = null

function resolveSecret(): string {
  if (cachedSecret !== null) return cachedSecret

  const raw = process.env.ADMIN_SECRET
  if (!raw) {
    if (isProduction) {
      throw new Error(
        'ADMIN_SECRET environment variable is required in production. ' +
          'Generate one with `openssl rand -hex 32` and set it in your Vercel project ' +
          '(Settings → Environment Variables), scoped to Production + Preview. ' +
          'Make sure it is NOT marked as a build-only var.'
      )
    }
    cachedSecret = 'examina-dev-secret-change-me'
    return cachedSecret
  }
  if (isProduction && raw.length < 32) {
    throw new Error(
      'ADMIN_SECRET must be at least 32 characters in production. ' +
        'Generate one with `openssl rand -hex 32`.'
    )
  }
  cachedSecret = raw
  return cachedSecret
}

function resolvePassword(): string {
  if (cachedPassword !== null) return cachedPassword

  const raw = process.env.ADMIN_PASSWORD
  if (!raw) {
    if (isProduction) {
      throw new Error(
        'ADMIN_PASSWORD environment variable is required in production. ' +
          'Set it in your Vercel project (Settings → Environment Variables), ' +
          'scoped to Production + Preview. Make sure it is NOT marked as a build-only var.'
      )
    }
    cachedPassword = 'examina-admin'
    return cachedPassword
  }
  if (isProduction && raw.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters in production.')
  }
  cachedPassword = raw
  return cachedPassword
}

// -- Cookie options ----------------------------------------------------------

export interface CookieOptions {
  httpOnly: true
  sameSite: 'lax'
  path: '/'
  maxAge: number
  /** True in production (HTTPS only). False on localhost / plain HTTP dev. */
  secure: boolean
}

export function adminCookieOptions(maxAgeSeconds: number = WEEK_SECONDS): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds,
    // In production we require HTTPS. `secure: true` prevents the cookie
    // from being sent over plain HTTP, mitigating accidental cleartext leaks.
    secure: isProduction,
  }
}

// -- HMAC token primitives ---------------------------------------------------

function sign(payload: string): string {
  return createHmac('sha256', resolveSecret()).update(payload).digest('hex')
}

export function createAdminToken(): string {
  const exp = Date.now() + WEEK_SECONDS * 1000
  return `${exp}.${sign(String(exp))}`
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token) return false
  const dot = token.indexOf('.')
  if (dot === -1) return false
  const expStr = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  const expected = sign(expStr)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  // Length check first to avoid timingSafeEqual throwing on mismatched lengths.
  return a.length === b.length && timingSafeEqual(a, b)
}

export function checkPassword(input: unknown): boolean {
  const given = typeof input === 'string' ? input : ''
  const a = Buffer.from(given)
  const b = Buffer.from(resolvePassword())
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Returns a 401 response when the requester is not an authenticated admin, otherwise null. */
export function guardAdmin(req: NextRequest): NextResponse | null {
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  if (verifyAdminToken(token)) return null
  return NextResponse.json({ error: 'Admin login required.' }, { status: 401 })
}
