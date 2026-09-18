import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireStudent } from '@/lib/student-auth'

export const dynamic = 'force-dynamic'

/** GET /api/student/attempts - all attempts by the logged-in student */
export async function GET(req: NextRequest) {
  const denied = requireStudent(req)
  if (denied) return denied

  // Re-read verified student id (requireStudent returns null on success)
  // We need to parse the token again to get the id.
  const token = req.cookies.get('examina_student')?.value
  const parts = token?.split('.')
  const studentId = parts?.[0]

  if (!studentId) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  const attempts = await db.attempt.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    include: {
      exam: { select: { id: true, title: true, description: true, durationMinutes: true } },
    },
  })

  return NextResponse.json({
    attempts: attempts.map((a) => ({
      id: a.id,
      score: a.score,
      total: a.total,
      timeSpentSeconds: a.timeSpentSeconds,
      autoSubmitted: a.autoSubmitted,
      createdAt: a.createdAt.toISOString(),
      exam: {
        id: a.exam.id,
        title: a.exam.title,
        description: a.exam.description,
        durationMinutes: a.exam.durationMinutes,
      },
    })),
  })
}
