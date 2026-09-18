import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, adminCookieOptions, checkPassword, createAdminToken } from '@/lib/auth'
import { clientIp, rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// 5 failed login attempts per minute per IP. Plenty for a single admin
// typing their password, brutal on a brute-forcer.
const LOGIN_LIMIT = 5
const LOGIN_WINDOW_MS = 60 * 1000

/** POST /api/admin/login - { password } → sets HttpOnly admin cookie */
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit({ key: `login:${ip}`, limit: LOGIN_LIMIT, windowMs: LOGIN_WINDOW_MS })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait a minute and try again.' },
      { status: 429, headers: rateLimitHeaders(rl) }
    )
  }

  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!checkPassword(body.password)) {
    return NextResponse.json(
      { error: 'Incorrect password.' },
      { status: 401, headers: rateLimitHeaders(rl) }
    )
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, createAdminToken(), adminCookieOptions())
  return res
}
