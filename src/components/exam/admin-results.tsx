'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Timer, Zap } from 'lucide-react'
import { api, AttemptRow, formatDuration } from './types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'

export function AdminResults() {
  const router = useRouter()
  const { toast } = useToast()
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [examFilter, setExamFilter] = useState<string>('all')

  useEffect(() => {
    let alive = true
    api<{ attempts: AttemptRow[] }>('/api/admin/results')
      .then(({ attempts: data }) => alive && setAttempts(data))
      .catch((err: Error) => {
        if (!alive) return
        setError(err.message)
        toast({ title: 'Could not load results', description: err.message, variant: 'destructive' })
      })
    return () => {
      alive = false
    }
  }, [toast])

  const exams = useMemo(() => {
    const map = new Map<string, string>()
    ;(attempts ?? []).forEach((a) => map.set(a.examId, a.examTitle))
    return Array.from(map.entries())
  }, [attempts])

  const filtered = useMemo(
    () => (attempts ?? []).filter((a) => examFilter === 'all' || a.examId === examFilter),
    [attempts, examFilter]
  )

  const stats = useMemo(() => {
    if (filtered.length === 0) return null
    const pcts = filtered.map((a) => (a.total > 0 ? (a.score / a.total) * 100 : 0))
    return {
      count: filtered.length,
      avg: Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length),
      best: Math.round(Math.max(...pcts)),
      auto: filtered.filter((a) => a.autoSubmitted).length,
    }
  }, [filtered])

  if (error) {
    return <div className="rounded-xl border border-border p-10 text-center text-sm text-muted-foreground">{error}</div>
  }

  if (attempts === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading results…
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Results</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every student attempt across all exams. Click a row to open its report card.
          </p>
        </div>
        <Select value={examFilter} onValueChange={setExamFilter}>
          <SelectTrigger className="w-full sm:w-64" aria-label="Filter by exam">
            <SelectValue placeholder="All exams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All exams</SelectItem>
            {exams.map(([id, title]) => (
              <SelectItem key={id} value={id}>
                {title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <StatBlock label="Attempts" value={String(stats.count)} />
          <StatBlock label="Average score" value={`${stats.avg}%`} />
          <StatBlock label="Best score" value={`${stats.best}%`} />
          <StatBlock
            label="Auto-submitted"
            value={String(stats.auto)}
            icon={stats.auto > 0 ? <Zap className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" /> : undefined}
          />
        </div>
      )}

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-border">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-foreground">No attempts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Results appear here as soon as students submit exams.</p>
          </div>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden md:table-cell">Exam</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">
                    <span className="inline-flex items-center gap-1">
                      <Timer className="h-3 w-3" aria-hidden="true" />
                      Time
                    </span>
                  </TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => {
                  const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0
                  return (
                    <TableRow
                      key={a.id}
                      onClick={() => router.push(`/attempts/${a.id}?from=admin`)}
                      className="cursor-pointer"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && router.push(`/attempts/${a.id}?from=admin`)}
                      aria-label={`Open report for ${a.studentName}, score ${a.score} of ${a.total}`}
                    >
                      <TableCell className="font-medium text-foreground">
                        {a.studentName}
                        {a.autoSubmitted && (
                          <span
                            className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                            title="Auto-submitted when time expired"
                          >
                            <Zap className="h-2.5 w-2.5" aria-hidden="true" />
                            auto
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden max-w-40 truncate md:table-cell">{a.examTitle}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.score}/{a.total}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium tabular-nums ${pct >= 50 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                      >
                        {pct}%
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {formatDuration(a.timeSpentSeconds)}
                      </TableCell>
                      <TableCell className="hidden text-right text-muted-foreground lg:table-cell">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatBlock({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
    </div>
  )
}
