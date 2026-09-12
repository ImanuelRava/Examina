import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** GET /api/admin/session - { authenticated: boolean } */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  return NextResponse.json({ authenticated: verifyAdminToken(token) })
}
