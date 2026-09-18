'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, ArrowRight, Award, Clock, Loader2 } from 'lucide-react'
import { api, StudentExam } from './types'
import { MathText } from './math-text'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

interface ExamTakerProps {
  examId: string
}

interface StudentInfo {
  id: string
  name: string
  email: string
}

interface PreviousAttempt {
  id: string
  score: number
  total: number
  createdAt: string
}

function fmtClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function ExamTaker({ examId }: ExamTakerProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [exam, setExam] = useState<StudentExam | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'intro' | 'running'>('intro')
  const [student, setStudent] = useState<StudentInfo | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [previousAttempts, setPreviousAttempts] = useState<PreviousAttempt[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [idx, setIdx] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const submitLockRef = useRef(false)

  // Auth check + load exam + load previous attempts
  useEffect(() => {
    let alive = true

    // 1. Check auth — redirect to login if not signed in
    api<{ authenticated: boolean; student?: StudentInfo }>('/api/student/session')
      .then((data) => {
        if (!alive) return
        if (!data.authenticated || !data.student) {
          router.replace(`/login?redirect=/exams/${examId}/take`)
          return
        }
        setStudent(data.student)
        setAuthChecked(true)

        // 2. Load exam (only after auth passes, since /take is public but we want to gate the UX)
        api<{ exam: StudentExam }>(`/api/exams/${examId}/take`)
          .then(({ exam: data }) => alive && setExam(data))
          .catch((err: Error) => alive && setLoadError(err.message))

        // 3. Load previous attempts for this exam by this student
        api<{ attempts: PreviousAttempt[] }>('/api/student/attempts')
          .then((data) => {
            if (!alive) return
            setPreviousAttempts(
              data.attempts
                .filter((a) => a.id !== undefined)
                .map((a) => ({
                  id: a.id,
                  score: a.score,
                  total: a.total,
                  createdAt: a.createdAt,
                }))
                .filter((_) => true)
            )
          })
          .catch(() => {
            // Non-fatal — just don't show history
          })
      })
      .catch(() => {
        if (alive) {
          router.replace(`/login?redirect=/exams/${examId}/take`)
        }
      })

    return () => {
      alive = false
    }
  }, [examId, router])

  const questions = exam?.questions ?? []
  const current = questions[idx]
  const answeredCount = useMemo(() => questions.filter((q) => answers[q.id]).length, [questions, answers])
  const unansweredCount = questions.length - answeredCount

  async function doSubmit(auto = false) {
    if (!exam || submitLockRef.current) return
    submitLockRef.current = true
    setSubmitting(true)
    const timeSpentSeconds = startedAt != null ? Math.round((Date.now() - startedAt) / 1000) : null
    try {
      const { attemptId } = await api<{ attemptId: string }>(`/api/exams/${exam.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers, timeSpentSeconds, autoSubmitted: auto }),
      })
      if (auto) {
        toast({ title: "Time's up", description: 'Your exam was submitted automatically.' })
      }
      router.push(`/attempts/${attemptId}`)
    } catch (err) {
      toast({ title: 'Submission failed', description: (err as Error).message, variant: 'destructive' })
      submitLockRef.current = false
      setSubmitting(false)
    }
  }

  // Countdown: tick every second while running; auto-submit at zero.
  useEffect(() => {
    if (phase !== 'running' || remaining === null) return
    if (remaining <= 0) {
      const submitTimer = setTimeout(() => doSubmit(true), 0)
      return () => clearTimeout(submitTimer)
    }
    const t = setTimeout(() => setRemaining((r) => (r === null ? null : r - 1)), 1000)
    return () => clearTimeout(t)
  }, [phase, remaining])

  function startExam() {
    setPhase('running')
    setStartedAt(Date.now())
    if (exam?.durationMinutes) setRemaining(exam.durationMinutes * 60)
  }

  function handleSubmitClick() {
    if (unansweredCount > 0) setConfirmOpen(true)
    else doSubmit(false)
  }

  if (loadError) {
    return <div className="rounded-xl border border-border p-10 text-center text-sm text-muted-foreground">{loadError}</div>
  }

  // Auth gate: show loading while checking session, before deciding to render
  if (!authChecked) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Checking your session…
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading exam…
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <p className="text-sm font-medium">This exam has no questions yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Please check back later.</p>
      </div>
    )
  }

  // Previous attempts stats
  const bestPct =
    previousAttempts.length > 0
      ? Math.round(Math.max(...previousAttempts.map((a) => (a.total > 0 ? (a.score / a.total) * 100 : 0))))
      : null

  // ---------- Intro screen ----------
  if (phase === 'intro') {
    return (
      <div className="mx-auto max-w-xl py-6">
        <div className="rounded-2xl border border-border bg-card p-7 sm:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">Examination</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{exam.title}</h1>
          {exam.description && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{exam.description}</p>}

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{questions.length}</span> multiple-choice{' '}
              {questions.length === 1 ? 'question' : 'questions'}
            </span>
            {exam.durationMinutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Time limit:{' '}
                <span className="font-medium text-foreground">{exam.durationMinutes} min</span>
              </span>
            ) : null}
            <span>Graded instantly</span>
          </div>

          {/* Signed-in student banner */}
          {student && (
            <div className="mt-6 flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                {student.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{student.name}</p>
                <p className="truncate text-xs text-muted-foreground">{student.email}</p>
              </div>
            </div>
          )}

          {/* Previous attempts */}
          {previousAttempts.length > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-muted/20 p-4 text-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Award className="h-3 w-3" aria-hidden="true" />
                Your history with this exam
              </p>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span>
                  <span className="font-medium text-foreground">{previousAttempts.length}</span>{' '}
                  {previousAttempts.length === 1 ? 'attempt' : 'attempts'}
                </span>
                {bestPct !== null && (
                  <span>
                    Best score:{' '}
                    <span className={`font-medium ${bestPct >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {bestPct}%
                    </span>
                  </span>
                )}
                <span className="text-muted-foreground">
                  Last taken {new Date(previousAttempts[0].createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}

          <Button onClick={startExam} className="mt-8 h-11 w-full text-sm sm:w-auto sm:px-10">
            {previousAttempts.length > 0 ? 'Retake exam' : 'Start exam'}
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    )
  }

  // ---------- Exam running ----------
  const timeCritical = remaining !== null && remaining <= 60

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress + timer */}
      <div className="sticky top-0 z-10 -mx-4 bg-background/90 px-4 pb-3 pt-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-medium">
            Question {idx + 1} <span className="font-normal text-muted-foreground">of {questions.length}</span>
            <span className="hidden text-muted-foreground sm:inline"> · {answeredCount} answered</span>
          </span>
          {remaining !== null ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-sm font-medium tabular-nums ${
                timeCritical
                  ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400'
                  : 'border-border text-foreground'
              }`}
              role="timer"
              aria-label={`Time remaining ${fmtClock(remaining)}`}
            >
              <Clock className={`h-3.5 w-3.5 ${timeCritical ? 'animate-pulse' : ''}`} aria-hidden="true" />
              {fmtClock(remaining)}
            </span>
          ) : (
            <span className="text-muted-foreground">{answeredCount} answered</span>
          )}
        </div>
        <Progress value={((idx + 1) / questions.length) * 100} className="mt-2 h-1" />
      </div>

      {/* Question */}
      <div key={current.id} className="mt-6">
        <p className="text-sm font-medium text-muted-foreground">Q{current.order}</p>
        <h2 className="mt-2 text-xl font-medium leading-relaxed">
          <MathText text={current.text} />
        </h2>

        <div className="mt-6 space-y-2.5" role="radiogroup" aria-label={`Options for question ${current.order}`}
        >
          {current.options.map((opt) => {
            const selected = answers[current.id] === opt.key
            return (
              <button
                key={opt.key}
                role="radio"
                aria-checked={selected}
                onClick={() => setAnswers((a) => ({ ...a, [current.id]: opt.key }))}
                className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:border-primary/50'
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium ${
                    selected ? 'border-primary-foreground/40 text-primary-foreground' : 'border-border text-muted-foreground'
                  }`}
                >
                  {opt.key}
                </span>
                <span className="text-sm leading-relaxed sm:text-base">
                  <MathText text={opt.text} />
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0 || submitting}
        >
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
          Back
        </Button>

        {/* Dot navigator */}
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => !submitting && setIdx(i)}
              tabIndex={-1}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === idx
                  ? 'bg-primary'
                  : answers[q.id]
                    ? 'bg-muted-foreground/60 hover:bg-muted-foreground'
                    : 'bg-border hover:bg-muted-foreground/60'
              }`}
            />
          ))}
        </div>

        {idx < questions.length - 1 ? (
          <Button variant="outline" onClick={() => setIdx((i) => i + 1)} disabled={submitting}>
            Next
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button onClick={handleSubmitClick} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                Grading…
              </>
            ) : (
              'Submit exam'
            )}
          </Button>
        )}
      </div>

      {/* Confirm dialog for unanswered questions */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
              Unanswered questions
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have {unansweredCount} unanswered {unansweredCount === 1 ? 'question' : 'questions'}.
              Unanswered questions are marked as wrong. Submit anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep answering</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => doSubmit(false)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Submit exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
