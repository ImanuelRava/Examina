'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Download, Loader2, Minus, RotateCcw, X } from 'lucide-react'
import { api, AttemptReport, formatDuration } from './types'
import { MathText } from './math-text'
import { downloadReportPdf } from './pdf'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface ReportCardProps {
  attemptId: string
}

export function ReportCard({ attemptId }: ReportCardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromAdmin = searchParams.get('from') === 'admin'
  const { toast } = useToast()
  const [report, setReport] = useState<AttemptReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let alive = true
    api<{ attempt: AttemptReport }>(`/api/attempts/${attemptId}`)
      .then(({ attempt }) => alive && setReport(attempt))
      .catch((err: Error) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [attemptId])

  async function handleExport() {
    if (!report || exporting) return
    setExporting(true)
    try {
      await downloadReportPdf(report)
      toast({ title: 'Report card downloaded', description: 'Saved as a PDF file.' })
    } catch (err) {
      toast({ title: 'Export failed', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  if (error) {
    return <div className="rounded-xl border border-zinc-200 p-10 text-center text-sm text-zinc-500">{error}</div>
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Preparing your report card…
      </div>
    )
  }

  const total = report.total
  const pct = total > 0 ? Math.round((report.score / total) * 100) : 0
  const correctCount = report.questions.filter((q) => q.isCorrect).length
  const unansweredCount = report.questions.filter((q) => !q.selected).length
  const wrongCount = total - correctCount - unansweredCount

  // Ring geometry
  const R = 52
  const CIRC = 2 * Math.PI * R
  const ringColor = pct >= 50 ? 'stroke-emerald-500' : 'stroke-red-500'

  const backLabel = fromAdmin ? 'Back to results' : 'Back to exams'
  const onBack = () => router.push(fromAdmin ? '/admin/results' : '/exams')

  return (
    <div className="mx-auto max-w-2xl">
      {/* Score header */}
      <div className="rounded-2xl border border-zinc-200 p-7 sm:p-10">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-zinc-400">Report card</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">{report.examTitle}</h1>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500">
          {report.studentName !== 'Anonymous' ? `${report.studentName} · ` : ''}
          {new Date(report.createdAt).toLocaleString()}
          {report.timeSpentSeconds != null && <> · Time used {formatDuration(report.timeSpentSeconds)}</>}
          {report.autoSubmitted && <span className="text-amber-600"> · auto-submitted (time expired)</span>}
        </p>

        <div className="mt-8 flex flex-col items-center gap-8 sm:flex-row sm:gap-10">
          {/* Ring */}
          <div className="relative h-32 w-32 shrink-0" role="img" aria-label={`Score ${pct} percent`}>
            <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
              <circle cx="60" cy="60" r={R} fill="none" strokeWidth="8" className="stroke-zinc-100" />
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - pct / 100)}
                className={`${ringColor} transition-[stroke-dashoffset] duration-700`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold tracking-tight text-zinc-900">{pct}%</span>
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <p className="text-xl font-medium text-zinc-900">
              {report.score} <span className="font-normal text-zinc-400">of {total} correct</span>
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-700">
                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                {correctCount} right
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-700">
                <X className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
                {wrongCount} wrong
              </span>
              {unansweredCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-700">
                  <Minus className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                  {unansweredCount} skipped
                </span>
              )}
            </div>

            {/* Export */}
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
              className="mt-5 h-10 w-full sm:w-auto sm:px-6"
            >
              {exporting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              )}
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Per-question breakdown */}
      <h2 className="mt-10 text-base font-semibold text-zinc-900">Question by question</h2>
      <div className="mt-4 space-y-3">
        {report.questions.map((q) => {
          const correctOpt = q.options.find((o) => o.key === q.correctAnswer)
          const selectedOpt = q.options.find((o) => o.key === q.selected)
          return (
            <div key={q.id} className="rounded-xl border border-zinc-200 p-5">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${
                    q.isCorrect ? 'bg-emerald-600' : q.selected ? 'bg-red-500' : 'bg-zinc-300'
                  }`}
                  aria-hidden="true"
                >
                  {q.isCorrect ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : q.selected ? (
                    <X className="h-3.5 w-3.5" />
                  ) : (
                    <Minus className="h-3.5 w-3.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-relaxed text-zinc-900">
                    <span className="mr-1.5 text-zinc-400">Q{q.order}.</span>
                    <MathText text={q.text} />
                  </p>

                  <div className="mt-3 space-y-1.5 text-sm">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-zinc-400">Your answer:</span>
                      {q.selected ? (
                        <span className={q.isCorrect ? 'font-medium text-emerald-700' : 'font-medium text-red-600'}>
                          {q.selected}. <MathText text={selectedOpt?.text ?? ''} />
                        </span>
                      ) : (
                        <span className="italic text-zinc-400">Not answered</span>
                      )}
                    </p>
                    {!q.isCorrect && correctOpt && (
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-zinc-400">Correct answer:</span>
                        <span className="font-medium text-emerald-700">
                          {q.correctAnswer}. <MathText text={correctOpt.text} />
                        </span>
                      </p>
                    )}
                  </div>

                  {q.explanation && (
                    <p className="mt-3 rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-500">
                      <span className="font-medium text-zinc-600">Explanation: </span>
                      <MathText text={q.explanation} />
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        {!fromAdmin && (
          <Button onClick={() => router.push(`/exams/${report.examId}/take`)} className="h-11 sm:px-8">
            <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Retake exam
          </Button>
        )}
        <Button variant="outline" onClick={onBack} className="h-11 sm:px-8">
          {backLabel}
        </Button>
      </div>
    </div>
  )
}
