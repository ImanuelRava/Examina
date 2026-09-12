export interface Option {
  key: string
  text: string
}

export interface ExamSummary {
  id: string
  title: string
  description: string | null
  createdAt: string
  questionCount: number
  attemptCount: number
}

export interface AdminQuestion {
  id: string
  order: number
  text: string
  options: Option[]
  correctAnswer: string
  explanation: string | null
}

export interface ExamDetail {
  id: string
  title: string
  description: string | null
  durationMinutes: number | null
  attemptCount: number
  questions: AdminQuestion[]
}

export interface StudentQuestion {
  id: string
  order: number
  text: string
  options: Option[]
}

export interface StudentExam {
  id: string
  title: string
  description: string | null
  durationMinutes: number | null
  questions: StudentQuestion[]
}

export interface ReportQuestion {
  id: string
  order: number
  text: string
  options: Option[]
  correctAnswer: string
  explanation: string | null
  selected: string
  isCorrect: boolean
}

export interface AttemptReport {
  id: string
  studentName: string
  score: number
  total: number
  timeSpentSeconds: number | null
  autoSubmitted: boolean
  createdAt: string
  examId: string
  examTitle: string
  questions: ReportQuestion[]
}

export interface AttemptRow {
  id: string
  studentName: string
  score: number
  total: number
  timeSpentSeconds: number | null
  autoSubmitted: boolean
  createdAt: string
  examId: string
  examTitle: string
}

export interface AnswerKeyResult {
  ok: true
  fileName: string
  format: 'json' | 'text'
  parsedCount: number
  appliedCount: number
  updatedCount: number
  applied: { no: number; answer: string }[]
  issues: string[]
  warnings: string[]
}

/** Small fetch wrapper - throws readable errors from API JSON responses. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
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
    throw new Error((data as { error?: string }).error ?? 'Something went wrong. Please try again.')
  }
  return data as T
}

/** Formats seconds as m:ss; returns an em dash for null/undefined. */
export function formatDuration(totalSeconds?: number | null): string {
  if (totalSeconds == null || totalSeconds < 0) return '-'
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
