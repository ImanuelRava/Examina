'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { api, ExamDetail } from './types'
import { MathText } from './math-text'
import { QuestionForm } from './question-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

interface AdminExamBuilderProps {
  examId: string
}

export function AdminExamBuilder({ examId }: AdminExamBuilderProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [exam, setExam] = useState<ExamDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Meta editing
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)

  // Question dialogs
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ExamDetail['questions'][number] | null>(null)
  const [deletingQuestion, setDeletingQuestion] = useState<ExamDetail['questions'][number] | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    const { exam: data } = await api<{ exam: ExamDetail }>(`/api/exams/${examId}`)
    setExam(data)
    setTitle(data.title)
    setDescription(data.description ?? '')
    setDuration(data.durationMinutes != null ? String(data.durationMinutes) : '')
  }, [examId])

  useEffect(() => {
    load().catch((err: Error) => setLoadError(err.message))
  }, [load])

  async function handleSaveMeta() {
    if (!title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' })
      return
    }
    const trimmed = duration.trim()
    if (trimmed !== '') {
      const n = Number(trimmed)
      if (!Number.isFinite(n) || n < 1 || n > 600) {
        toast({
          title: 'Invalid time limit',
          description: 'Enter minutes between 1 and 600, or leave empty for untimed.',
          variant: 'destructive',
        })
        return
      }
    }
    setSavingMeta(true)
    try {
      await api(`/api/exams/${examId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          description,
          durationMinutes: trimmed === '' ? null : Number(trimmed),
        }),
      })
      await load()
      toast({ title: 'Exam details saved' })
    } catch (err) {
      toast({ title: 'Could not save', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setSavingMeta(false)
    }
  }

  async function handleDeleteQuestion() {
    if (!deletingQuestion) return
    setDeleting(true)
    try {
      await api(`/api/questions/${deletingQuestion.id}`, { method: 'DELETE' })
      toast({ title: 'Question deleted' })
      setDeletingQuestion(null)
      await load()
    } catch (err) {
      toast({ title: 'Could not delete question', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-border p-10 text-center text-sm text-muted-foreground">{loadError}</div>
    )
  }

  if (!exam) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading exam…
      </div>
    )
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/admin')}
        className="-ml-2 text-muted-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
        All exams
      </Button>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{exam.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {exam.questions.length} {exam.questions.length === 1 ? 'question' : 'questions'} ·{' '}
        {exam.attemptCount} {exam.attemptCount === 1 ? 'student attempt' : 'student attempts'}
        {exam.durationMinutes != null && <> · {exam.durationMinutes} min time limit</>}
      </p>

      <div className="mt-8 space-y-6">
        {/* Exam details */}
        <section className="rounded-xl border border-border p-5 sm:p-6" aria-label="Exam details">
          <h2 className="text-sm font-semibold text-foreground">Exam details</h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2.5" />
            </div>
            <div>
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-2.5"
                placeholder="Shown to students before they start."
              />
            </div>
            <div>
              <Label htmlFor="edit-duration">
                Time limit <span className="font-normal text-muted-foreground">(minutes - leave empty for untimed)</span>
              </Label>
              <Input
                id="edit-duration"
                type="number"
                min={1}
                max={600}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 30"
                className="mt-2.5"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                When set, students see a countdown and the exam is submitted automatically when time expires.
              </p>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveMeta} disabled={savingMeta}>
                {savingMeta && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Save details
              </Button>
            </div>
          </div>
        </section>

        {/* Questions */}
        <section aria-label="Questions">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Questions <span className="font-normal text-muted-foreground">({exam.questions.length})</span>
            </h2>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Add question
            </Button>
          </div>

          {exam.questions.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-10 text-center">
              <p className="text-sm font-medium text-foreground">No questions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first multiple-choice question to get started.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {exam.questions.map((q) => (
                <div key={q.id} className="rounded-xl border border-border p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm font-medium leading-relaxed text-foreground">
                      <span className="mr-1.5 text-muted-foreground">Q{q.order}.</span>
                      <MathText text={q.text} />
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditing(q)}
                        aria-label={`Edit question ${q.order}`}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                        onClick={() => setDeletingQuestion(q)}
                        aria-label={`Delete question ${q.order}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {q.options.map((opt) => {
                      const isCorrect = opt.key === q.correctAnswer
                      return (
                        <li key={opt.key} className="flex items-center gap-2.5 text-sm">
                          <span
                            className={`flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full border px-1.5 text-[11px] font-semibold ${
                              isCorrect
                                ? 'border-emerald-600 bg-emerald-600 text-primary-foreground'
                                : 'border-border text-muted-foreground'
                            }`}
                          >
                            {opt.key}
                          </span>
                          <span className={isCorrect ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                            <MathText text={opt.text} />
                          </span>
                          {isCorrect && (
                            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <Check className="h-3 w-3" aria-hidden="true" />
                              correct
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  {q.explanation && (
                    <p className="mt-3 border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground">
                      <MathText text={q.explanation} />
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          Tip: grading happens automatically when a student submits. Every student sees a report card with
          right/wrong marks per question right after the exam.
        </p>
      </div>

      {/* Create / edit question dialog */}
      <Dialog
        open={createOpen || !!editing}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false)
            setEditing(null)
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit question ${editing.order}` : 'Add question'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update the question, its options, or the correct answer.'
                : 'Write the question, at least two options, and mark the correct answer.'}
            </DialogDescription>
          </DialogHeader>
          <QuestionForm
            examId={examId}
            initial={editing ?? undefined}
            onDone={(saved) => {
              setCreateOpen(false)
              setEditing(null)
              if (saved) load().catch(() => undefined)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete question confirm */}
      <AlertDialog open={!!deletingQuestion} onOpenChange={(open) => !open && setDeletingQuestion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete question {deletingQuestion?.order}?</AlertDialogTitle>
            <AlertDialogDescription>
              Remaining questions will be renumbered automatically. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuestion}
              disabled={deleting}
              className="bg-red-600 text-primary-foreground hover:bg-red-700"
            >
              {deleting && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
