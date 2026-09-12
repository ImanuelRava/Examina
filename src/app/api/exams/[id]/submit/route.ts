import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/exams/[id]/submit - grade a submission server-side.
 * Body: { studentName?: string, answers: Record<questionId, optionKey | ""> }
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params

  let body: { studentName?: string; answers?: Record<string, string>; timeSpentSeconds?: number; autoSubmitted?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const studentName = (body.studentName ?? '').toString().trim() || 'Anonymous'
  const submitted = body.answers ?? {}

  // Optional timer metadata sent by the client
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

  // Grade server-side - the client never sees the correct answers before submit.
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

  const attempt = await db.attempt.create({
    data: {
      examId: exam.id,
      studentName,
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
