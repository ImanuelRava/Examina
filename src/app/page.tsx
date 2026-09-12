'use client'

import { useEffect, useState } from 'react'
import { Landing } from '@/components/exam/landing'
import { StudentExamList } from '@/components/exam/student-list'
import { ExamTaker } from '@/components/exam/exam-taker'
import { ReportCard } from '@/components/exam/report-card'
import { AdminExamList } from '@/components/exam/admin-list'
import { AdminExamBuilder } from '@/components/exam/admin-builder'
import { AdminResults } from '@/components/exam/admin-results'
import { AdminGate } from '@/components/exam/admin-gate'

type View =
  | { name: 'home' }
  | { name: 'student' }
  | { name: 'take'; examId: string }
  | { name: 'report'; attemptId: string; back: 'student' | 'admin-results' }
  | { name: 'admin' }
  | { name: 'build'; examId: string }
  | { name: 'results' }

function portalOf(view: View): 'home' | 'student' | 'admin' {
  switch (view.name) {
    case 'student':
    case 'take':
    case 'report':
      return 'student'
    case 'admin':
    case 'build':
    case 'results':
      return 'admin'
    default:
      return 'home'
  }
}

export default function Page() {
  const [view, setView] = useState<View>({ name: 'home' })

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [view])

  const portal = portalOf(view)
  const showAdminTabs = view.name === 'admin' || view.name === 'results'

  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4 sm:px-6">
          <button
            onClick={() => setView({ name: 'home' })}
            className="text-base font-semibold tracking-tight text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
          >
            Noel&apos;s Test
          </button>

          <nav className="flex items-center gap-1" aria-label="Portals">
            <button
              onClick={() => setView({ name: 'student' })}
              aria-current={portal === 'student' ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                portal === 'student' ? 'font-medium text-zinc-900' : 'text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Student
            </button>
            <span className="text-zinc-200" aria-hidden="true">
              /
            </span>
            <button
              onClick={() => setView({ name: 'admin' })}
              aria-current={portal === 'admin' ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                portal === 'admin' ? 'font-medium text-zinc-900' : 'text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Admin
            </button>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
          {view.name === 'home' && (
            <Landing onEnter={(p) => setView(p === 'student' ? { name: 'student' } : { name: 'admin' })} />
          )}

          {view.name === 'student' && (
            <>
              <div className="mb-8">
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-zinc-400">Student portal</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Available tests</h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Anyone can take a test. Pick one, and your report card appears the moment you
                  submit.
                </p>
              </div>
              <StudentExamList onStart={(examId) => setView({ name: 'take', examId })} />
            </>
          )}

          {view.name === 'take' && (
            <ExamTaker
              examId={view.examId}
              onSubmitted={(attemptId) => setView({ name: 'report', attemptId, back: 'student' })}
            />
          )}

          {view.name === 'report' && view.back === 'student' && (
            <ReportCard
              attemptId={view.attemptId}
              onBack={() => setView({ name: 'student' })}
              onRetake={(examId) => setView({ name: 'take', examId })}
            />
          )}

          {view.name === 'report' && view.back === 'admin-results' && (
            <ReportCard
              attemptId={view.attemptId}
              onBack={() => setView({ name: 'results' })}
              backLabel="Back to results"
            />
          )}

          {showAdminTabs && (
            <div className="mb-8 flex gap-6 border-b border-zinc-100" role="tablist" aria-label="Admin sections">
              <button
                role="tab"
                aria-selected={view.name === 'admin' || view.name === 'build'}
                onClick={() => setView({ name: 'admin' })}
                className={`-mb-px border-b-2 pb-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                  view.name === 'admin' || view.name === 'build'
                    ? 'border-zinc-900 font-medium text-zinc-900'
                    : 'border-transparent text-zinc-400 hover:text-zinc-900'
                }`}
              >
                Exams
              </button>
              <button
                role="tab"
                aria-selected={view.name === 'results'}
                onClick={() => setView({ name: 'results' })}
                className={`-mb-px border-b-2 pb-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 ${
                  view.name === 'results'
                    ? 'border-zinc-900 font-medium text-zinc-900'
                    : 'border-transparent text-zinc-400 hover:text-zinc-900'
                }`}
              >
                Results
              </button>
            </div>
          )}

          {view.name === 'admin' && (
            <AdminGate>
              <AdminExamList onOpen={(examId) => setView({ name: 'build', examId })} />
            </AdminGate>
          )}

          {view.name === 'build' && (
            <AdminGate>
              <AdminExamBuilder examId={view.examId} onBack={() => setView({ name: 'admin' })} />
            </AdminGate>
          )}

          {view.name === 'results' && (
            <AdminGate>
              <AdminResults
                onOpenReport={(attemptId) => setView({ name: 'report', attemptId, back: 'admin-results' })}
              />
            </AdminGate>
          )}
        </div>
      </main>

      {/* Footer (sticks to bottom via flex layout) */}
      <footer className="mt-auto border-t border-zinc-100">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4 text-xs text-zinc-400 sm:px-6">
          <span>Noel&apos;s Test - instant report cards for every test</span>
          <span className="hidden sm:block">Student portal · Admin portal</span>
        </div>
      </footer>
    </div>
  )
}
