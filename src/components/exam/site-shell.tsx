'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode, useEffect } from 'react'

/**
 * Shared site chrome: header with portal switcher + footer.
 * Highlights the active portal based on the current pathname.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/'

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  const portal: 'home' | 'student' | 'admin' = pathname.startsWith('/admin')
    ? 'admin'
    : pathname.startsWith('/exams') || pathname.startsWith('/attempts')
      ? 'student'
      : 'home'

  // Admin section tabs (Exams / Results) only on admin pages.
  const isAdminSection = pathname.startsWith('/admin')
  const adminTab: 'exams' | 'results' =
    pathname === '/admin/results' || pathname.startsWith('/admin/results')
      ? 'results'
      : 'exams'

  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
          >
            Noel&apos;s Test
          </Link>

          <nav className="flex items-center gap-1" aria-label="Portals">
            <Link
              href="/exams"
              aria-current={portal === 'student' ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                portal === 'student' ? 'font-medium text-zinc-900' : 'text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Student
            </Link>
            <span className="text-zinc-200" aria-hidden="true">
              /
            </span>
            <Link
              href="/admin"
              aria-current={portal === 'admin' ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                portal === 'admin' ? 'font-medium text-zinc-900' : 'text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
          {isAdminSection && (
            <div
              className="mb-8 flex gap-6 border-b border-zinc-100"
              role="tablist"
              aria-label="Admin sections"
            >
              <Link
                href="/admin"
                role="tab"
                aria-selected={adminTab === 'exams'}
                className={`-mb-px border-b-2 pb-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                  adminTab === 'exams'
                    ? 'border-zinc-900 font-medium text-zinc-900'
                    : 'border-transparent text-zinc-400 hover:text-zinc-900'
                }`}
              >
                Exams
              </Link>
              <Link
                href="/admin/results"
                role="tab"
                aria-selected={adminTab === 'results'}
                className={`-mb-px border-b-2 pb-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                  adminTab === 'results'
                    ? 'border-zinc-900 font-medium text-zinc-900'
                    : 'border-transparent text-zinc-400 hover:text-zinc-900'
                }`}
              >
                Results
              </Link>
            </div>
          )}
          {children}
        </div>
      </main>

      <footer className="mt-auto border-t border-zinc-100">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4 text-xs text-zinc-400 sm:px-6">
          <span>Noel&apos;s Test - instant report cards for every test</span>
          <span className="hidden sm:block">Student portal · Admin portal</span>
        </div>
      </footer>
    </div>
  )
}
