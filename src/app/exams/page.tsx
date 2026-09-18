import { StudentExamList } from '@/components/exam/student-list'

export default function ExamsPage() {
  return (
    <>
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-zinc-400">Student portal</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Available tests</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Anyone can take a test. Pick one, and your report card appears the moment you submit.
        </p>
      </div>
      <StudentExamList />
    </>
  )
}
