'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, FileText, GraduationCap, Loader2, Lock, Sparkles } from 'lucide-react'
import { api, ExamSummary } from './types'

interface StudentInfo {
  id: string
  name: string
  email: string
}

export function StudentExamList() {
  const [exams, setExams] = useState<ExamSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [student, setStudent] = useState<StudentInfo | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([
      api<{ exams: (ExamSummary & { _count: { questions: number; attempts: number } })[] }>('/api/exams'),
      api<{ authenticated: boolean; student?: StudentInfo }>('/api/student/session').catch(
        (): { authenticated: boolean; student?: StudentInfo } => ({ authenticated: false })
      ),
    ])
      .then(([examsRes, sessionRes]) => {
        if (!alive) return
        setExams(
          examsRes.exams.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            createdAt: e.createdAt,
            questionCount: e._count.questions,
            attemptCount: e._count.attempts,
          }))
        )
        setStudent(sessionRes.authenticated ? sessionRes.student ?? null : null)
        setAuthChecked(true)
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

  if (exams === null || !authChecked) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading…
      </div>
    )
  }

  // ── Signed-out: show a welcoming auth gate ─────────────────────────────
  if (!student) {
    return (
      <div className="mx-auto max-w-md py-8">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GraduationCap className="h-7 w-7" aria-hidden="true" />
          </span>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight">Take a test</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Everyone needs an account to take exams on Examina. Sign in to browse
            available tests and track your scores in one place.
          </p>

          <div className="mt-6 space-y-2">
            <Link
              href="/register"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Create a free account
            </Link>
            <Link
              href="/login"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
            >
              I already have an account
            </Link>
          </div>

          {exams.length > 0 && (
            <p className="mt-6 text-xs text-muted-foreground">
              {exams.length} {exams.length === 1 ? 'exam is' : 'exams are'} waiting for you inside.
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── Signed-in: show the exam list ──────────────────────────────────────
  if (exams.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
        <p className="mt-4 text-sm font-medium">No tests available yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Check back later — the admin sets up exams in the Admin Portal.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {exams.map((exam) => {
        const disabled = exam.questionCount === 0
        return (
          <Link
            key={exam.id}
            href={disabled ? '#' : `/exams/${exam.id}/take`}
            aria-disabled={disabled}
            className={`group flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-6 ${
              disabled ? 'pointer-events-none opacity-50' : ''
            }`}
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
          </Link>
        )
      })}
    </div>
  )
}
