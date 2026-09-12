import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET /api/exams/[id]/take - student view of an exam.
 * Correct answers are intentionally NOT included.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const exam = await db.exam.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: 'asc' } } },
  })
  if (!exam) return NextResponse.json({ error: 'Exam not found.' }, { status: 404 })

  return NextResponse.json({
    exam: {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      durationMinutes: exam.durationMinutes,
      questions: exam.questions.map((q) => ({
        id: q.id,
        order: q.order,
        text: q.text,
        options: JSON.parse(q.optionsJson) as { key: string; text: string }[],
      })),
    },
  })
}
