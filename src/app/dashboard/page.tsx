'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, BarChart3, Clock, Loader2, RotateCcw, Zap } from 'lucide-react'
import { api, formatDuration } from '@/components/exam/types'
import { Button } from '@/components/ui/button'

interface DashboardAttempt {
  id: string
  score: number
  total: number
  timeSpentSeconds: number | null
  autoSubmitted: boolean
  createdAt: string
  exam: {
    id: string
    title: string
    description: string | null
    durationMinutes: number | null
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [attempts, setAttempts] = useState<DashboardAttempt[] | null>(null)
  const [authStatus, setAuthStatus] = useState<'checking' | 'anon' | 'authed'>('checking')

  useEffect(() => {
    let alive = true
    api<{ authenticated: boolean }>('/api/student/session')
      .then((s) => {
        if (!alive) return
        if (!s.authenticated) {
          setAuthStatus('anon')
          return
        }
        setAuthStatus('authed')
        return api<{ attempts: DashboardAttempt[] }>('/api/student/attempts').then((data) => {
          if (alive) setAttempts(data.attempts)
        })
      })
      .catch(() => alive && setAuthStatus('anon'))
    return () => {
      alive = false
    }
  }, [])

  if (authStatus === 'checking') {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading…
      </div>
    )
  }

  if (authStatus === 'anon') {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to view your dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create an account or sign in to track all your test scores in one place.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => router.push('/login')}>Sign in</Button>
          <Button variant="outline" onClick={() => router.push('/register')}>
            Create account
          </Button>
        </div>
      </div>
    )
  }

  if (attempts === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading your scores…
      </div>
    )
  }

  // Compute stats
  const totalAttempts = attempts.length
  const avgPct =
    totalAttempts > 0
      ? Math.round(
          (attempts.reduce((s, a) => s + (a.total > 0 ? (a.score / a.total) * 100 : 0), 0) /
            totalAttempts) *
            1
        )
      : 0
  const bestPct =
    totalAttempts > 0
      ? Math.round(Math.max(...attempts.map((a) => (a.total > 0 ? (a.score / a.total) * 100 : 0))))
      : 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Your dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every test you&apos;ve taken, newest first. Click any to view the full report card.
        </p>
      </div>

      {/* Stats */}
      {totalAttempts > 0 && (
        <div className="mb-8 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <BarChart3 className="h-3 w-3" aria-hidden="true" />
              Attempts
            </div>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{totalAttempts}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Average</div>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{avgPct}%</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best</div>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{bestPct}%</p>
          </div>
        </div>
      )}

      {/* Attempt list */}
      {totalAttempts === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-sm font-medium">No attempts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Take your first exam to see your scores here.
          </p>
          <Button className="mt-4" onClick={() => router.push('/exams')}>
            Browse exams
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {attempts.map((a) => {
            const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0
            const pctColor = pct >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            return (
              <div
                key={a.id}
                className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
              >
                <Link href={`/attempts/${a.id}`} className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-base font-medium">{a.exam.title}</span>
                    <span className={`text-base font-semibold tabular-nums ${pctColor}`}>{pct}%</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {a.score} / {a.total} correct
                    </span>
                    <span>{new Date(a.createdAt).toLocaleString()}</span>
                    {a.timeSpentSeconds != null && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {formatDuration(a.timeSpentSeconds)}
                      </span>
                    )}
                    {a.autoSubmitted && (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Zap className="h-3 w-3" aria-hidden="true" />
                        auto
                      </span>
                    )}
                  </div>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/exams/${a.exam.id}/take`)}
                  className="shrink-0"
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  Retake
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
