import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { guardAdmin } from '@/lib/auth'
import { normalizeOptions, RawOption } from '@/lib/options'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** POST /api/exams/[id]/questions - add one question to an exam (admin only) */
export async function POST(req: NextRequest, ctx: Ctx) {
  const denied = guardAdmin(req)
  if (denied) return denied

  const { id } = await ctx.params

  let body: {
    text?: string
    options?: RawOption[]
    correctAnswer?: string
    explanation?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const text = (body.text ?? '').toString().trim()
  if (!text) return NextResponse.json({ error: 'Question text is required.' }, { status: 400 })

  const result = normalizeOptions(Array.isArray(body.options) ? body.options : [], body.correctAnswer ?? '')
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  const exam = await db.exam.findUnique({ where: { id }, include: { questions: { orderBy: { order: 'desc' }, take: 1 } } })
  if (!exam) return NextResponse.json({ error: 'Exam not found.' }, { status: 404 })
  const nextOrder = (exam.questions[0]?.order ?? 0) + 1

  const question = await db.question.create({
    data: {
      examId: id,
      order: nextOrder,
      text,
      optionsJson: JSON.stringify(result.options),
      correctAnswer: result.correctAnswer,
      explanation: (body.explanation ?? '').toString().trim() || null,
    },
  })

  return NextResponse.json({ question }, { status: 201 })
}
