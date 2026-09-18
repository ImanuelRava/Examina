import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStudentFromRequest } from '@/lib/student-auth'
import { clientIp, rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

// 20 submissions per 5 minutes per IP.
const SUBMIT_LIMIT = 20
const SUBMIT_WINDOW_MS = 5 * 60 * 1000

/**
 * POST /api/exams/[id]/submit - grade a submission server-side.
 * Body: { studentName?: string, answers: Record<questionId, optionKey | ""> }
 * If the student is logged in, the attempt is linked to their account.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params

  const ip = clientIp(req)
  const rl = rateLimit({
    key: `submit:${ip}`,
    limit: SUBMIT_LIMIT,
    windowMs: SUBMIT_WINDOW_MS,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many submissions. Please wait a few minutes and try again.' },
      { status: 429, headers: rateLimitHeaders(rl) }
    )
  }

  let body: { studentName?: string; answers?: Record<string, string>; timeSpentSeconds?: number; autoSubmitted?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  // If logged in, use the student's account name; otherwise use the provided name.
  const student = getStudentFromRequest(req)
  const studentName = student
    ? null // will be set via the student relation; studentName column defaults
    : (body.studentName ?? '').toString().trim().slice(0, 80) || 'Anonymous'
  const submitted = body.answers ?? {}

  const rawTime = Number(body.timeSpentSeconds)
  const timeSpentSeconds = Number.isFinite(rawTime) && rawTime >= 0 ? Math.min(Math.round(rawTime), 60 * 60 * 24) : null
  const autoSubmitted = body.autoSubmitted === true

  const exam = await db.exam.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: 'asc' } } },
  })
  if (!exam) return NextResponse.json({ error: 'Exam not found.' }, { status: 404 })
  if (exam.questions.length === 0) {
    return NextResponse.json({ error: 'This exam has no questions yet.' }, { status: 400 })
  }

  // Grade server-side.
  let score = 0
  const graded: { questionId: string; selected: string; isCorrect: boolean }[] = []

  for (const q of exam.questions) {
    const raw = (submitted[q.id] ?? '').toString().toUpperCase()
    const options = JSON.parse(q.optionsJson) as { key: string; text: string }[]
    const valid = options.some((o) => o.key === raw)
    const selected = valid ? raw : ''
    const isCorrect = selected !== '' && selected === q.correctAnswer
    if (isCorrect) score += 1
    graded.push({ questionId: q.id, selected, isCorrect })
  }

  // Resolve the student name if logged in (for the denormalized column).
  let resolvedStudentName = studentName
  let studentId: string | null = null
  if (student) {
    const studentRow = await db.student.findUnique({
      where: { id: student.studentId },
      select: { id: true, name: true },
    })
    if (studentRow) {
      studentId = studentRow.id
      resolvedStudentName = studentRow.name
    }
  }

  const attempt = await db.attempt.create({
    data: {
      examId: exam.id,
      studentId,
      studentName: resolvedStudentName ?? 'Anonymous',
      score,
      total: exam.questions.length,
      timeSpentSeconds,
      autoSubmitted,
      answers: {
        create: graded.map((g) => ({
          questionId: g.questionId,
          selected: g.selected,
          isCorrect: g.isCorrect,
        })),
      },
    },
  })

  return NextResponse.json(
    { attemptId: attempt.id, score, total: exam.questions.length },
    { status: 201 }
  )
}
