import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getStudentFromRequest } from '@/lib/student-auth'

export const dynamic = 'force-dynamic'

/** GET /api/student/session - { authenticated, student? } */
export async function GET(req: NextRequest) {
  const verified = getStudentFromRequest(req)
  if (!verified) return NextResponse.json({ authenticated: false })

  const student = await db.student.findUnique({
    where: { id: verified.studentId },
    select: { id: true, name: true, email: true },
  })
  if (!student) return NextResponse.json({ authenticated: false })

  return NextResponse.json({ authenticated: true, student })
}
