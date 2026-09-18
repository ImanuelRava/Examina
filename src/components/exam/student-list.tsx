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
      <div className="rounded-xl border border-zinc-200 p-10 text-center text-sm text-zinc-500">{error}</div>
    )
  }

  if (exams === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading exams…
      </div>
    )
  }

  if (exams.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center">
        <FileText className="mx-auto h-8 w-8 text-zinc-300" aria-hidden="true" />
        <p className="mt-4 text-sm font-medium text-zinc-900">No tests available yet</p>
        <p className="mt-1 text-sm text-zinc-500">
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
          className="group flex w-full items-center justify-between gap-4 rounded-xl border border-zinc-200 p-5 text-left transition-colors hover:border-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-zinc-200 sm:p-6"
        >
          <span className="min-w-0">
            <span className="block truncate text-base font-medium text-zinc-900">{exam.title}</span>
            <span className="mt-0.5 block truncate text-sm text-zinc-500">
              {exam.description || 'No description'}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-4">
            <span className="hidden text-sm text-zinc-400 sm:block">
              {exam.questionCount} {exam.questionCount === 1 ? 'question' : 'questions'}
            </span>
            <ArrowRight
              className="h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-900"
              aria-hidden="true"
            />
          </span>
        </button>
      ))}
    </div>
  )
}
