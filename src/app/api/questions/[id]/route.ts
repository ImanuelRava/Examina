import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { guardAdmin } from '@/lib/auth'
import { normalizeOptions, RawOption } from '@/lib/answer-key'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** PATCH /api/questions/[id] — edit a question (admin only) */
export async function PATCH(req: NextRequest, ctx: Ctx) {
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

  try {
    const question = await db.question.update({
      where: { id },
      data: {
        text,
        optionsJson: JSON.stringify(result.options),
        correctAnswer: result.correctAnswer,
        explanation: (body.explanation ?? '').toString().trim() || null,
      },
    })
    return NextResponse.json({ question })
  } catch {
    return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
  }
}

/** DELETE /api/questions/[id] — remove question and renumber the rest (admin only) */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = guardAdmin(req)
  if (denied) return denied

  const { id } = await ctx.params
  try {
    const existing = await db.question.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })

    await db.question.delete({ where: { id } })

    // Renumber remaining questions to keep a clean 1..N order
    const remaining = await db.question.findMany({
      where: { examId: existing.examId },
      orderBy: { order: 'asc' },
    })
    await db.$transaction(
      remaining.map((q, i) => db.question.update({ where: { id: q.id }, data: { order: i + 1 } }))
    )

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
  }
}
