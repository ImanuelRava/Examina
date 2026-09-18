import { NextResponse } from 'next/server'
import { ADMIN_COOKIE, adminCookieOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** POST /api/admin/logout - clears the admin cookie */
export async function POST() {
  const res = NextResponse.json({ ok: true })
  // maxAge: 0 immediately expires the cookie. We still pass the full
  // options object (including `secure` in production) so the browser
  // accepts the Set-Cookie over the same scheme that set it.
  res.cookies.set(ADMIN_COOKIE, '', { ...adminCookieOptions(0), maxAge: 0 })
  return res
}
