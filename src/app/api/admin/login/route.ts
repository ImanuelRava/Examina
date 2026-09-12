import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, checkPassword, createAdminToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** POST /api/admin/login - { password } → sets HttpOnly admin cookie */
export async function POST(req: NextRequest) {
  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!checkPassword(body.password)) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, createAdminToken(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return res
}
