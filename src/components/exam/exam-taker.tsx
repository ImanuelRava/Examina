'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, ArrowRight, Clock, Loader2 } from 'lucide-react'
import { api, StudentExam } from './types'
import { MathText } from './math-text'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const [studentName, setStudentName] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [idx, setIdx] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const submitLockRef = useRef(false)

  useEffect(() => {
    let alive = true
    api<{ exam: StudentExam }>(`/api/exams/${examId}/take`)
      .then(({ exam: data }) => alive && setExam(data))
      .catch((err: Error) => alive && setLoadError(err.message))
    return () => {
      alive = false
    }
  }, [examId])

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
        body: JSON.stringify({ studentName, answers, timeSpentSeconds, autoSubmitted: auto }),
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
    return <div className="rounded-xl border border-zinc-200 p-10 text-center text-sm text-zinc-500">{loadError}</div>
  }

  if (!exam) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading exam…
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center">
        <p className="text-sm font-medium text-zinc-900">This exam has no questions yet</p>
        <p className="mt-1 text-sm text-zinc-500">Please check back later.</p>
      </div>
    )
  }

  // ---------- Intro screen ----------
  if (phase === 'intro') {
    return (
      <div className="mx-auto max-w-xl py-6">
        <div className="rounded-2xl border border-zinc-200 p-7 sm:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-zinc-400">Examination</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">{exam.title}</h1>
          {exam.description && <p className="mt-3 text-sm leading-relaxed text-zinc-500">{exam.description}</p>}

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-500">
            <span>
              <span className="font-medium text-zinc-900">{questions.length}</span> multiple-choice{' '}
              {questions.length === 1 ? 'question' : 'questions'}
            </span>
            {exam.durationMinutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Time limit:{' '}
                <span className="font-medium text-zinc-900">{exam.durationMinutes} min</span>
              </span>
            ) : null}
            <span>Graded instantly</span>
          </div>

          <div className="mt-8">
            <label htmlFor="student-name" className="text-sm font-medium text-zinc-900">
              Your name <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <Input
              id="student-name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="e.g. Jane Doe"
              className="mt-2"
              maxLength={80}
            />
            <p className="mt-2 text-xs text-zinc-400">Shown on your report card.</p>
          </div>

          <Button onClick={startExam} className="mt-8 h-11 w-full text-sm sm:w-auto sm:px-10">
            Start exam
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
      <div className="sticky top-0 z-10 -mx-4 bg-white/90 px-4 pb-3 pt-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-medium text-zinc-900">
            Question {idx + 1} <span className="font-normal text-zinc-400">of {questions.length}</span>
            <span className="hidden text-zinc-400 sm:inline"> · {answeredCount} answered</span>
          </span>
          {remaining !== null ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-sm font-medium tabular-nums ${
                timeCritical
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-zinc-200 text-zinc-900'
              }`}
              role="timer"
              aria-label={`Time remaining ${fmtClock(remaining)}`}
            >
              <Clock className={`h-3.5 w-3.5 ${timeCritical ? 'animate-pulse' : ''}`} aria-hidden="true" />
              {fmtClock(remaining)}
            </span>
          ) : (
            <span className="text-zinc-400">{answeredCount} answered</span>
          )}
        </div>
        <Progress value={((idx + 1) / questions.length) * 100} className="mt-2 h-1" />
      </div>

      {/* Question */}
      <div key={current.id} className="mt-6">
        <p className="text-sm font-medium text-zinc-400">Q{current.order}</p>
        <h2 className="mt-2 text-xl font-medium leading-relaxed text-zinc-900">
          <MathText text={current.text} />
        </h2>

        <div className="mt-6 space-y-2.5" role="radiogroup" aria-label={`Options for question ${current.order}`}>
          {current.options.map((opt) => {
            const selected = answers[current.id] === opt.key
            return (
              <button
                key={opt.key}
                role="radio"
                aria-checked={selected}
                onClick={() => setAnswers((a) => ({ ...a, [current.id]: opt.key }))}
                className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 ${
                  selected
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400'
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium ${
                    selected ? 'border-white/40 text-white' : 'border-zinc-200 text-zinc-500'
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
                  ? 'bg-zinc-900'
                  : answers[q.id]
                    ? 'bg-zinc-400 hover:bg-zinc-600'
                    : 'bg-zinc-200 hover:bg-zinc-400'
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
              className="bg-zinc-900 text-white hover:bg-zinc-800"
            >
              Submit exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
