'use client'

import { GraduationCap, PenLine, ArrowRight } from 'lucide-react'

interface LandingProps {
  onEnter: (portal: 'student' | 'admin') => void
}

export function Landing({ onEnter }: LandingProps) {
  return (
    <div className="flex flex-col items-center py-8 sm:py-16">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-zinc-400">Examination platform</p>
      <h1 className="mt-4 text-center text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
        Take exams.
        <br />
        Build exams.
      </h1>
      <p className="mt-5 max-w-md text-center text-base leading-relaxed text-zinc-500">
        One platform, two doors. Students get an instant report card after every exam — admins
        build the exams and upload the answer key.
      </p>

      <div className="mt-12 grid w-full gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-6">
        {/* Student portal */}
        <button
          onClick={() => onEnter('student')}
          className="group flex flex-col rounded-2xl border border-zinc-200 p-7 text-left transition-colors hover:border-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 sm:p-8"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200">
            <GraduationCap className="h-5 w-5 text-zinc-900" aria-hidden="true" />
          </span>
          <span className="mt-6 text-lg font-medium text-zinc-900">Student Portal</span>
          <span className="mt-2 flex-1 text-sm leading-relaxed text-zinc-500">
            Browse available exams, answer at your own pace, and get a report card that shows
            exactly which answers were right and which were wrong.
          </span>
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900">
            Enter portal
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </button>

        {/* Admin console */}
        <button
          onClick={() => onEnter('admin')}
          className="group flex flex-col rounded-2xl border border-zinc-200 p-7 text-left transition-colors hover:border-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 sm:p-8"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200">
            <PenLine className="h-5 w-5 text-zinc-900" aria-hidden="true" />
          </span>
          <span className="mt-6 text-lg font-medium text-zinc-900">Admin Console</span>
          <span className="mt-2 flex-1 text-sm leading-relaxed text-zinc-500">
            Create examination pages, add questions, and upload an answer key file. Grading is
            automatic — students see their results the moment they submit.
          </span>
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900">
            Enter console
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </button>
      </div>
    </div>
  )
}
