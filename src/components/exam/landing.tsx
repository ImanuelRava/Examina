'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  GraduationCap,
  PenLine,
  ArrowRight,
  BarChart3,
  LayoutDashboard,
  Sparkles,
  Zap,
  Award,
} from 'lucide-react'

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
    <div className="flex flex-col items-center">
      {/* Hero section */}
      <section className="w-full py-12 text-center sm:py-20">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
          Knowledge testing platform
        </div>

        <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-7xl">
          <span className="text-foreground">Examina</span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Take tests. Track your scores. See exactly which answers were right or wrong.
          Built for students who want instant feedback.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {checked && student ? (
            <Link
              href="/dashboard"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              Go to your dashboard
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <>
              <Link
                href={checked ? '/register' : '#'}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
                {checked ? 'Create your free account' : 'Loading…'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href={checked ? '/login' : '#'}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 text-sm font-medium transition-colors hover:bg-accent"
              >
                Sign in
              </Link>
            </>
          )}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Everyone needs an account to take exams. It is free.
        </p>
      </section>

      {/* Two portal cards */}
      <section className="grid w-full gap-4 sm:grid-cols-2 sm:gap-6">
        {checked && student ? (
          <Link
            href="/dashboard"
            className="group flex flex-col rounded-2xl border border-border bg-card p-7 text-left transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-8"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LayoutDashboard className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="mt-6 text-lg font-semibold">Your dashboard</span>
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
            className="group flex flex-col rounded-2xl border border-border bg-card p-7 text-left transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-8"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="mt-6 text-lg font-semibold">Take a test</span>
            <span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              Create a free account to browse available exams, answer at your own pace,
              and get an instant report card with your scores.
            </span>
            <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        )}

        <Link
          href="/admin"
          className="group flex flex-col rounded-2xl border border-border bg-card p-7 text-left transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-8"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PenLine className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="mt-6 text-lg font-semibold">Admin portal</span>
          <span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
            Create exams, write questions, set time limits, and view every
            student&apos;s results. Grading is automatic.
          </span>
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            Manage exams
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </Link>
      </section>

      {/* Feature row */}
      <section className="mt-16 grid w-full gap-6 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">Score tracking</h3>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Sign in to see all your attempts and scores in one dashboard.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Zap className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">Instant grading</h3>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Submit and get your report card immediately. No waiting required.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Award className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">LaTeX support</h3>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Math questions render beautifully with KaTeX on every screen.
          </p>
        </div>
      </section>

      {/* Credit highlight */}
      <section className="mt-16 w-full">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-8 text-center sm:p-10">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-foreground sm:text-lg">
            This website is used for teaching the students that I teach.
            My name is <span className="font-semibold">Imanuel Rava</span>, and I built Examina
            so my students can take tests, see their scores right away, and review which answers
            they got right or wrong. Every exam here was made for them.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium text-foreground">
            <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
            Built by Imanuel Rava for my students
          </div>
        </div>
      </section>
    </div>
  )
}

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
