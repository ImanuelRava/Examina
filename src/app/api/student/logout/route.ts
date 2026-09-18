import { NextResponse } from 'next/server'
import { STUDENT_COOKIE, studentCookieOptions } from '@/lib/student-auth'

export const dynamic = 'force-dynamic'

/** POST /api/student/logout - clears the student session cookie */
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(STUDENT_COOKIE, '', { ...studentCookieOptions(0), maxAge: 0 })
  return res
}
