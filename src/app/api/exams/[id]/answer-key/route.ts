import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { guardAdmin } from '@/lib/auth'
import { parseAnswerKeyText } from '@/lib/answer-key'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET /api/exams/[id]/answer-key - download a CSV template (admin only)
 * listing every question number with its current answer.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const denied = guardAdmin(req)
  if (denied) return denied

  const { id } = await ctx.params
  const exam = await db.exam.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: 'asc' } } },
  })
  if (!exam) return NextResponse.json({ error: 'Exam not found.' }, { status: 404 })

  const lines = ['no,answer']
  for (const q of exam.questions) {
    lines.push(`${q.order},${q.correctAnswer}`)
  }
  const csv = lines.join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="answer-key-${exam.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv"`,
    },
  })
}

/**
 * POST /api/exams/[id]/answer-key
 * Accepts either:
 *  - multipart/form-data with a `file` field (CSV / TXT / JSON)
 *  - JSON body { text: "..." } (pasted key)
 * Parses the key and applies it to the exam questions by question number. (admin only)
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const denied = guardAdmin(req)
  if (denied) return denied

  const { id } = await ctx.params

  const contentType = req.headers.get('content-type') ?? ''
  let rawText = ''
  let fileName = 'pasted-text'

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')
      if (file instanceof File) {
        rawText = await file.text()
        fileName = file.name || fileName
      } else if (typeof form.get('text') === 'string') {
        rawText = form.get('text') as string
      }
    } else {
      const body = (await req.json()) as { text?: string }
      rawText = (body.text ?? '').toString()
    }
  } catch {
    return NextResponse.json({ error: 'Could not read the uploaded file.' }, { status: 400 })
  }

  if (!rawText.trim()) {
    return NextResponse.json({ error: 'The file is empty.' }, { status: 400 })
  }

  const parsed = parseAnswerKeyText(rawText)
  const parsedCount = Object.keys(parsed.answers).length
  if (parsedCount === 0) {
    return NextResponse.json(
      { error: 'No answer pairs found. Expected lines like "1. A" or "1,A" (or JSON).' },
      { status: 400 }
    )
  }

  const exam = await db.exam.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: 'asc' } } },
  })
  if (!exam) return NextResponse.json({ error: 'Exam not found.' }, { status: 404 })
  if (exam.questions.length === 0) {
    return NextResponse.json({ error: 'Add questions to this exam before applying an answer key.' }, { status: 400 })
  }

  const issues: string[] = []
  const applied: { no: number; answer: string }[] = []
  const updates: { id: string; answer: string }[] = []

  for (const q of exam.questions) {
    const letter = parsed.answers[q.order]
    if (!letter) {
      issues.push(`Q${q.order}: no answer provided - kept "${q.correctAnswer}".`)
      continue
    }
    const options = JSON.parse(q.optionsJson) as { key: string; text: string }[]
    if (!options.some((o) => o.key === letter)) {
      issues.push(`Q${q.order}: option "${letter}" does not exist on this question - kept "${q.correctAnswer}".`)
      continue
    }
    if (q.correctAnswer !== letter) {
      updates.push({ id: q.id, answer: letter })
    }
    applied.push({ no: q.order, answer: letter })
  }

  await db.$transaction(
    updates.map((u) => db.question.update({ where: { id: u.id }, data: { correctAnswer: u.answer } }))
  )

  // Numbers in the key that point beyond the question list
  const maxOrder = exam.questions.length
  for (const no of Object.keys(parsed.answers).map(Number)) {
    if (no > maxOrder) issues.push(`Q${no}: exam only has ${maxOrder} questions - skipped.`)
  }

  return NextResponse.json({
    ok: true,
    fileName,
    format: parsed.format,
    parsedCount,
    appliedCount: applied.length,
    updatedCount: updates.length,
    applied,
    issues,
    warnings: parsed.warnings,
  })
}
