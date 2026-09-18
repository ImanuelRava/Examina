import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { STUDENT_COOKIE, createStudentToken, studentCookieOptions } from '@/lib/student-auth'
import { clientIp, rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// 10 login attempts per 10 minutes per IP.
const LOGIN_LIMIT = 10
const LOGIN_WINDOW_MS = 10 * 60 * 1000

/** POST /api/student/login - { email, password } → sets session cookie */
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit({ key: `student-login:${ip}`, limit: LOGIN_LIMIT, windowMs: LOGIN_WINDOW_MS })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      { status: 429, headers: rateLimitHeaders(rl) }
    )
  }

  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const email = (body.email ?? '').toString().trim().toLowerCase()
  const password = (body.password ?? '').toString()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  const student = await db.student.findUnique({ where: { email } })
  // Always run bcrypt.compare to avoid timing-based user enumeration.
  const passwordHash = student?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidin'
  const match = await bcrypt.compare(password, passwordHash)

  if (!student || !match) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true, student: { id: student.id, name: student.name, email: student.email } })
  res.cookies.set(STUDENT_COOKIE, createStudentToken(student.id), studentCookieOptions())
  return res
}
