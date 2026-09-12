import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Lightweight admin authentication:
 * HMAC-signed expiry token stored in an HttpOnly cookie.
 * Configure ADMIN_PASSWORD / ADMIN_SECRET via environment variables.
 */

const SECRET = process.env.ADMIN_SECRET ?? 'examina-dev-secret-change-me'
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'examina-admin'
export const ADMIN_COOKIE = 'examina_admin'
const WEEK_SECONDS = 60 * 60 * 24 * 7

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
