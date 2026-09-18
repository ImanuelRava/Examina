'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GraduationCap, PenLine, ArrowRight, BarChart3, LayoutDashboard } from 'lucide-react'

interface StudentInfo {
  id: string
  name: string
  email: string
}

export function Landing() {
  const [student, setStudent] = useState<StudentInfo | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let alive = true
    api<{ authenticated: boolean; student?: StudentInfo }>('/api/student/session')
      .then((data) => {
        if (!alive) return
        setStudent(data.authenticated ? data.student ?? null : null)
      })
      .catch(() => {
        if (alive) setStudent(null)
      })
      .finally(() => {
        if (alive) setChecked(true)
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="flex flex-col items-center py-8 sm:py-16">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        Knowledge testing platform
      </p>
      <h1 className="mt-4 text-center text-4xl font-semibold tracking-tight sm:text-5xl">
        Take tests.
        <br />
        Track scores.
      </h1>
      <p className="mt-5 max-w-md text-center text-base leading-relaxed text-muted-foreground">
        Create an account to take exams and see all your scores in one place.
        The admin sets up the exams — you focus on the answers.
      </p>

      <div className="mt-12 grid w-full gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-6">
        {/* Student portal — adaptive CTA */}
        {checked && student ? (
          <Link
            href="/dashboard"
            className="group flex flex-col rounded-2xl border border-border bg-card p-7 text-left transition-all hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-8"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="mt-6 text-lg font-medium">Your dashboard</span>
            <span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              Welcome back, {student.name.split(' ')[0]}. See your past attempts,
              scores, and retake any exam.
            </span>
            <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              Go to dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        ) : (
          <Link
            href={checked ? '/register' : '#'}
            className="group flex flex-col rounded-2xl border border-border bg-card p-7 text-left transition-all hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-8"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="mt-6 text-lg font-medium">Take a test</span>
            <span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              {checked
                ? 'Create a free account to browse exams, take tests, and get instant report cards with your scores.'
                : 'Create a free account to take exams and track your scores.'}
            </span>
            <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              {checked ? 'Get started' : 'Loading…'}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        )}

        {/* Admin console */}
        <Link
          href="/admin"
          className="group flex flex-col rounded-2xl border border-border bg-card p-7 text-left transition-all hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-8"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PenLine className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="mt-6 text-lg font-medium">Admin portal</span>
          <span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
            Create exams, write questions, set time limits, and view every
            student&apos;s results. Grading is automatic.
          </span>
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            Manage exams
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </Link>
      </div>

      {/* Feature row */}
      <div className="mt-16 grid w-full gap-6 sm:grid-cols-3">
        <div className="text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
          </div>
          <h3 className="mt-3 text-sm font-medium">Score tracking</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Sign in to see all your attempts and scores in one dashboard.
          </p>
        </div>
        <div className="text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground">
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
          </div>
          <h3 className="mt-3 text-sm font-medium">Instant grading</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Submit and get your report card immediately — no waiting.
          </p>
        </div>
        <div className="text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground">
            <PenLine className="h-4 w-4" aria-hidden="true" />
          </div>
          <h3 className="mt-3 text-sm font-medium">LaTeX support</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Math questions render beautifully with KaTeX on every screen.
          </p>
        </div>
      </div>
    </div>
  )
}

// Inline the api helper to avoid a circular import dance with the 'use client' directive
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? 'Something went wrong.')
  }
  return data as T
}
