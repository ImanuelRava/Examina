'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, FileText, Loader2 } from 'lucide-react'
import { api, ExamSummary } from './types'

export function StudentExamList() {
  const router = useRouter()
  const [exams, setExams] = useState<ExamSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api<{ exams: (ExamSummary & { _count: { questions: number; attempts: number } })[] }>('/api/exams')
      .then(({ exams: data }) => {
        if (!alive) return
        setExams(
          data.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            createdAt: e.createdAt,
            questionCount: e._count.questions,
            attemptCount: e._count.attempts,
          }))
        )
      })
      .catch((err: Error) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [])

  if (error) {
    return (
      <div className="rounded-xl border border-border p-10 text-center text-sm text-muted-foreground">{error}</div>
    )
  }

  if (exams === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading exams…
      </div>
    )
  }

  if (exams.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
        <p className="mt-4 text-sm font-medium">No tests available yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Check back later - the admin sets up exams in the Admin Portal.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {exams.map((exam) => (
        <button
          key={exam.id}
          onClick={() => router.push(`/exams/${exam.id}/take`)}
          disabled={exam.questionCount === 0}
          className="group flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:p-6"
        >
          <span className="min-w-0">
            <span className="block truncate text-base font-medium">{exam.title}</span>
            <span className="mt-0.5 block truncate text-sm text-muted-foreground">
              {exam.description || 'No description'}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:block">
              {exam.questionCount} {exam.questionCount === 1 ? 'question' : 'questions'}
            </span>
            <ArrowRight
              className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
              aria-hidden="true"
            />
          </span>
        </button>
      ))}
    </div>
  )
}
