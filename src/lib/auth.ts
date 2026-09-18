import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Lightweight admin authentication:
 * HMAC-signed expiry token stored in an HttpOnly cookie.
 *
 * Required environment variables:
 *   - ADMIN_PASSWORD  (plaintext password the admin types at /admin)
 *   - ADMIN_SECRET    (>= 32-char random string used to sign the session cookie)
 *
 * The app REFUSES TO BOOT in production if either is missing or weak.
 * In development, a clearly-marked dev fallback is used so first-run DX still works.
 */

export const ADMIN_COOKIE = 'examina_admin'
const WEEK_SECONDS = 60 * 60 * 24 * 7

const isProduction = process.env.NODE_ENV === 'production'

// -- Secret resolution -------------------------------------------------------
// In production: hard-fail if env vars are missing or weak.
// In dev: fall back to a clearly-marked dev secret so `next dev` still works.

function resolveSecret(): string {
  const raw = process.env.ADMIN_SECRET
  if (!raw) {
    if (isProduction) {
      throw new Error(
        'ADMIN_SECRET environment variable is required in production. ' +
          'Generate one with `openssl rand -hex 32` and set it in your deployment env.'
      )
    }
    return 'examina-dev-secret-change-me'
  }
  if (isProduction && raw.length < 32) {
    throw new Error(
      'ADMIN_SECRET must be at least 32 characters in production. ' +
        'Generate one with `openssl rand -hex 32`.'
    )
  }
  return raw
}

function resolvePassword(): string {
  const raw = process.env.ADMIN_PASSWORD
  if (!raw) {
    if (isProduction) {
      throw new Error(
        'ADMIN_PASSWORD environment variable is required in production.'
      )
    }
    return 'examina-admin'
  }
  if (isProduction && raw.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters in production.')
  }
  return raw
}

// Eager resolution: if envs are missing in prod, the very first request
// throws and the deployment shows a clear error instead of silently running
// with weak defaults.
const SECRET = resolveSecret()
const ADMIN_PASSWORD = resolvePassword()

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
    // On Vercel, `VERCEL` env var is set; we also respect `HTTPS=1`.
    secure: isProduction,
  }
}

// -- HMAC token primitives ---------------------------------------------------

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('hex')
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
  const b = Buffer.from(ADMIN_PASSWORD)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Returns a 401 response when the requester is not an authenticated admin, otherwise null. */
export function guardAdmin(req: NextRequest): NextResponse | null {
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  if (verifyAdminToken(token)) return null
  return NextResponse.json({ error: 'Admin login required.' }, { status: 401 })
}
