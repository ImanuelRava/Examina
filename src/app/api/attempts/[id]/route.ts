import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/attempts/[id] - full report card data for one attempt */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const attempt = await db.attempt.findUnique({
    where: { id },
    include: {
      exam: { select: { id: true, title: true } },
      answers: { include: { question: true } },
    },
  })
  if (!attempt) return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 })

  const questions = attempt.answers
    .map((a) => ({ a, q: a.question }))
    .sort((x, y) => x.q.order - y.q.order)
    .map(({ a, q }) => ({
      id: q.id,
      order: q.order,
      text: q.text,
      options: JSON.parse(q.optionsJson) as { key: string; text: string }[],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      selected: a.selected,
      isCorrect: a.isCorrect,
    }))

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      studentName: attempt.studentName,
      score: attempt.score,
      total: attempt.total,
      timeSpentSeconds: attempt.timeSpentSeconds,
      autoSubmitted: attempt.autoSubmitted,
      createdAt: attempt.createdAt,
      examId: attempt.exam.id,
      examTitle: attempt.exam.title,
      questions,
    },
  })
}
