import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Student authentication: email + password accounts.
 *
 * Strategy: bcrypt-hashed passwords stored in the Student table. Session is
 * an HMAC-signed cookie containing the student ID + expiry (stateless — no
 * session table needed).
 *
 * Required env vars (shared with admin auth):
 *   - ADMIN_SECRET  (used as the HMAC key for both admin + student sessions)
 *
 * In production, the first auth call throws if ADMIN_SECRET is missing or
 * weak. In dev, a clearly-marked fallback is used.
 */

export const STUDENT_COOKIE = 'examina_student'
const DAY_SECONDS = 60 * 60 * 24
const STUDENT_SESSION_DAYS = 30

const isProduction = process.env.NODE_ENV === 'production'

let cachedSecret: string | null = null

function resolveSecret(): string {
  if (cachedSecret !== null) return cachedSecret
  const raw = process.env.ADMIN_SECRET
  if (!raw) {
    if (isProduction) {
      throw new Error(
        'ADMIN_SECRET environment variable is required in production. ' +
          'Generate one with `openssl rand -hex 32`.'
      )
    }
    cachedSecret = 'examina-dev-secret-change-me'
    return cachedSecret
  }
  if (isProduction && raw.length < 32) {
    throw new Error('ADMIN_SECRET must be at least 32 characters in production.')
  }
  cachedSecret = raw
  return cachedSecret
}

export function studentCookieOptions(maxAgeSeconds: number = DAY_SECONDS * STUDENT_SESSION_DAYS) {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
    secure: isProduction,
  }
}

function sign(payload: string): string {
  return createHmac('sha256', resolveSecret()).update(payload).digest('hex')
}

/**
 * Create a signed session token: `${studentId}.${exp}.${hmac(studentId.exp)}`.
 */
export function createStudentToken(studentId: string): string {
  const exp = Date.now() + DAY_SECONDS * STUDENT_SESSION_DAYS * 1000
  const payload = `${studentId}.${exp}`
  return `${payload}.${sign(payload)}`
}

export interface VerifiedStudent {
  studentId: string
  exp: number
}

export function verifyStudentToken(token: string | undefined | null): VerifiedStudent | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [studentId, expStr, sig] = parts
  if (!studentId || !expStr || !sig) return null
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Date.now()) return null
  const payload = `${studentId}.${expStr}`
  const expected = sign(payload)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return { studentId, exp }
}

/** Returns a 401 response when the requester is not a logged-in student, otherwise null. */
export function requireStudent(req: NextRequest): NextResponse | null {
  const token = req.cookies.get(STUDENT_COOKIE)?.value
  if (verifyStudentToken(token)) return null
  return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
}

/** Returns the verified student payload or null (no error response — use for optional auth). */
export function getStudentFromRequest(req: NextRequest): VerifiedStudent | null {
  const token = req.cookies.get(STUDENT_COOKIE)?.value
  return verifyStudentToken(token)
}
