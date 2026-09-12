import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { guardAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** GET /api/exams — list all exams with counts */
export async function GET() {
  const exams = await db.exam.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { questions: true, attempts: true } } },
  })
  return NextResponse.json({ exams })
}

/** POST /api/exams — create a new exam (admin only) */
export async function POST(req: NextRequest) {
  const denied = guardAdmin(req)
  if (denied) return denied

  let body: { title?: string; description?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const title = (body.title ?? '').toString().trim()
  const description = (body.description ?? '').toString().trim() || null

  if (!title) {
    return NextResponse.json({ error: 'Exam title is required.' }, { status: 400 })
  }

  const exam = await db.exam.create({ data: { title, description } })
  return NextResponse.json({ exam }, { status: 201 })
}
