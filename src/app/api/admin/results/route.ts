import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { guardAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** GET /api/admin/results - all attempts with exam titles (admin only) */
export async function GET(req: NextRequest) {
  const denied = guardAdmin(req)
  if (denied) return denied

  const attempts = await db.attempt.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { exam: { select: { id: true, title: true } } },
  })

  return NextResponse.json({
    attempts: attempts.map((a) => ({
      id: a.id,
      studentName: a.studentName,
      score: a.score,
      total: a.total,
      timeSpentSeconds: a.timeSpentSeconds,
      autoSubmitted: a.autoSubmitted,
      createdAt: a.createdAt,
      examId: a.exam.id,
      examTitle: a.exam.title,
    })),
  })
}
