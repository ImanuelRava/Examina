import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { guardAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/exams/[id] - full exam detail for the admin console (admin only, includes answers) */
export async function GET(req: NextRequest, ctx: Ctx) {
  const denied = guardAdmin(req)
  if (denied) return denied

  const { id } = await ctx.params
  const exam = await db.exam.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: 'asc' } },
      _count: { select: { attempts: true } },
    },
  })
  if (!exam) return NextResponse.json({ error: 'Exam not found.' }, { status: 404 })

  return NextResponse.json({
    exam: {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      durationMinutes: exam.durationMinutes,
      attemptCount: exam._count.attempts,
      questions: exam.questions.map((q) => ({
        id: q.id,
        order: q.order,
        text: q.text,
        options: JSON.parse(q.optionsJson) as { key: string; text: string }[],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      })),
    },
  })
}

/** PATCH /api/exams/[id] - rename / edit description / set time limit (admin only) */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const denied = guardAdmin(req)
  if (denied) return denied

  const { id } = await ctx.params
  let body: { title?: string; description?: string; durationMinutes?: number | string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const title = (body.title ?? '').toString().trim()
  if (!title) return NextResponse.json({ error: 'Exam title is required.' }, { status: 400 })

  // Time limit: null/empty = untimed, otherwise clamp to 1-600 minutes
  let durationMinutes: number | null = null
  const rawDuration = body.durationMinutes
  if (rawDuration !== null && rawDuration !== undefined && rawDuration !== '') {
    const n = Math.round(Number(rawDuration))
    if (!Number.isFinite(n) || n < 1 || n > 600) {
      return NextResponse.json({ error: 'Time limit must be between 1 and 600 minutes.' }, { status: 400 })
    }
    durationMinutes = n
  }

  try {
    const exam = await db.exam.update({
      where: { id },
      data: {
        title,
        description: (body.description ?? '').toString().trim() || null,
        durationMinutes,
      },
    })
    return NextResponse.json({ exam })
  } catch {
    return NextResponse.json({ error: 'Exam not found.' }, { status: 404 })
  }
}

/** DELETE /api/exams/[id] - delete exam and everything attached to it (admin only) */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = guardAdmin(req)
  if (denied) return denied

  const { id } = await ctx.params
  try {
    await db.exam.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Exam not found.' }, { status: 404 })
  }
}
