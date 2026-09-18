import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { STUDENT_COOKIE, createStudentToken, studentCookieOptions } from '@/lib/student-auth'
import { clientIp, rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// 5 registrations per hour per IP — plenty for legitimate use, hard on spam.
const REGISTER_LIMIT = 5
const REGISTER_WINDOW_MS = 60 * 60 * 1000

/** POST /api/student/register - { name, email, password } → creates account, sets session cookie */
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = rateLimit({ key: `register:${ip}`, limit: REGISTER_LIMIT, windowMs: REGISTER_WINDOW_MS })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please try again later.' },
      { status: 429, headers: rateLimitHeaders(rl) }
    )
  }

  let body: { name?: string; email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const name = (body.name ?? '').toString().trim().slice(0, 80)
  const email = (body.email ?? '').toString().trim().toLowerCase().slice(0, 200)
  const password = (body.password ?? '').toString()

  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }
  if (password.length > 200) {
    return NextResponse.json({ error: 'Password is too long.' }, { status: 400 })
  }

  const existing = await db.student.findUnique({ where: { email } })
  if (existing) {
    // Don't leak whether the email exists — return a generic message.
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const student = await db.student.create({
    data: { name, email, passwordHash },
  })

  const res = NextResponse.json({ ok: true, student: { id: student.id, name: student.name, email: student.email } })
  res.cookies.set(STUDENT_COOKIE, createStudentToken(student.id), studentCookieOptions())
  return res
}
