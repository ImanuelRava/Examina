'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { GraduationCap, LogOut, User } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'
import { Button } from '@/components/ui/button'
import { api } from './types'

interface StudentSession {
  id: string
  name: string
  email: string
}

/**
 * Shared site chrome: header with brand, nav, theme toggle, student account
 * area, and footer. Dark-mode aware via Tailwind v4 CSS variables.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/'
  const [student, setStudent] = useState<StudentSession | null>(null)
  const [studentLoaded, setStudentLoaded] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  // Poll student session on mount + when path changes
  useEffect(() => {
    let alive = true
    api<{ authenticated: boolean; student?: StudentSession }>('/api/student/session')
      .then((data) => {
        if (alive) setStudent(data.authenticated ? data.student ?? null : null)
      })
      .catch(() => {
        if (alive) setStudent(null)
      })
      .finally(() => {
        if (alive) setStudentLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [pathname])

  async function handleLogout() {
    try {
      await api('/api/student/logout', { method: 'POST' })
      setStudent(null)
      window.location.href = '/'
    } catch {
      // ignore
    }
  }

  const isAdminSection = pathname.startsWith('/admin')
  const adminTab: 'exams' | 'results' =
    pathname === '/admin/results' || pathname.startsWith('/admin/results')
      ? 'results'
      : 'exams'

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
            </span>
            Examina
          </Link>

          {/* Nav + actions */}
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1" aria-label="Portals">
              <Link
                href="/exams"
                aria-current={!isAdminSection ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  !isAdminSection
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Exams
              </Link>
              <Link
                href="/admin"
                aria-current={isAdminSection ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isAdminSection
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Admin
              </Link>
            </nav>

            <ThemeToggle />

            {/* Student account area */}
            {studentLoaded && student ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
                  title={student.email}
                >
                  <User className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden max-w-32 truncate sm:inline">{student.name}</span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={handleLogout}
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ) : studentLoaded ? (
              <Link
                href="/login"
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Sign in
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
          {isAdminSection && (
            <div
              className="mb-8 flex gap-6 border-b border-border"
              role="tablist"
              aria-label="Admin sections"
            >
              <Link
                href="/admin"
                role="tab"
                aria-selected={adminTab === 'exams'}
                className={`-mb-px border-b-2 pb-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  adminTab === 'exams'
                    ? 'border-foreground font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Exams
              </Link>
              <Link
                href="/admin/results"
                role="tab"
                aria-selected={adminTab === 'results'}
                className={`-mb-px border-b-2 pb-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  adminTab === 'results'
                    ? 'border-foreground font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Results
              </Link>
            </div>
          )}
          {children}
        </div>
      </main>

      <footer className="mt-auto border-t border-border">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 text-xs text-muted-foreground sm:px-6">
          <span>Examina - instant report cards for every test</span>
          <span className="hidden sm:block">Take tests · Track scores</span>
        </div>
      </footer>
    </div>
  )
}
