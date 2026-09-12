'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  FileUp,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  Download,
} from 'lucide-react'
import { api, AnswerKeyResult, ExamDetail } from './types'
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
  onBack: () => void
}

export function AdminExamBuilder({ examId, onBack }: AdminExamBuilderProps) {
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

  // Answer key
  const [file, setFile] = useState<File | null>(null)
  const [pastedText, setPastedText] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [applyingKey, setApplyingKey] = useState(false)
  const [keyResult, setKeyResult] = useState<AnswerKeyResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  async function applyKey(body: FormData | string, label: string) {
    setApplyingKey(true)
    setKeyResult(null)
    try {
      const res = await fetch(`/api/exams/${examId}/answer-key`, {
        method: 'POST',
        ...(typeof body === 'string'
          ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: body }) }
          : { body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not apply the answer key.')
      setKeyResult(data as AnswerKeyResult)
      toast({
        title: 'Answer key applied',
        description: `${data.appliedCount} answers read · ${data.updatedCount} ${data.updatedCount === 1 ? 'change' : 'changes'} saved.`,
      })
      await load()
      // reset inputs
      setFile(null)
      setPastedText('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      toast({ title: 'Answer key upload failed', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setApplyingKey(false)
    }
  }

  function handleApplyFile() {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    applyKey(fd, file.name)
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-zinc-200 p-10 text-center text-sm text-zinc-500">{loadError}</div>
    )
  }

  if (!exam) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading exam…
      </div>
    )
  }

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-zinc-500">
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
        All exams
      </Button>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">{exam.title}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {exam.questions.length} {exam.questions.length === 1 ? 'question' : 'questions'} ·{' '}
        {exam.attemptCount} {exam.attemptCount === 1 ? 'student attempt' : 'student attempts'}
        {exam.durationMinutes != null && <> · {exam.durationMinutes} min time limit</>}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-5">
        {/* ------- Left: exam details + questions ------- */}
        <div className="space-y-6 lg:col-span-3">
          {/* Exam details */}
          <section className="rounded-xl border border-zinc-200 p-5 sm:p-6" aria-label="Exam details">
            <h2 className="text-sm font-semibold text-zinc-900">Exam details</h2>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea
                  id="edit-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="mt-1.5"
                  placeholder="Shown to students before they start."
                />
              </div>
              <div>
                <Label htmlFor="edit-duration">
                  Time limit <span className="font-normal text-zinc-400">(minutes - leave empty for untimed)</span>
                </Label>
                <Input
                  id="edit-duration"
                  type="number"
                  min={1}
                  max={600}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g. 30"
                  className="mt-1.5"
                />
                <p className="mt-2 text-xs text-zinc-400">
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
              <h2 className="text-sm font-semibold text-zinc-900">
                Questions <span className="font-normal text-zinc-400">({exam.questions.length})</span>
              </h2>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Add question
              </Button>
            </div>

            {exam.questions.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-zinc-300 p-10 text-center">
                <p className="text-sm font-medium text-zinc-900">No questions yet</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Add questions manually, or upload an answer key below after adding them.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {exam.questions.map((q) => (
                  <div key={q.id} className="rounded-xl border border-zinc-200 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-sm font-medium leading-relaxed text-zinc-900">
                        <span className="mr-1.5 text-zinc-400">Q{q.order}.</span>
                        <MathText text={q.text} />
                      </p>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-400 hover:text-zinc-900"
                          onClick={() => setEditing(q)}
                          aria-label={`Edit question ${q.order}`}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-400 hover:text-red-600"
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
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : 'border-zinc-200 text-zinc-500'
                              }`}
                            >
                              {opt.key}
                            </span>
                            <span className={isCorrect ? 'font-medium text-zinc-900' : 'text-zinc-600'}>
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
                      <p className="mt-3 border-l-2 border-zinc-100 pl-3 text-xs leading-relaxed text-zinc-400">
                        <MathText text={q.explanation} />
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ------- Right: answer key ------- */}
        <div className="lg:col-span-2">
          <div className="space-y-6 lg:sticky lg:top-8">
            <section className="rounded-xl border border-zinc-200 p-5 sm:p-6" aria-label="Answer key">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200">
                  <KeyRound className="h-4 w-4 text-zinc-900" aria-hidden="true" />
                </span>
                <h2 className="text-sm font-semibold text-zinc-900">Answer key</h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                Upload a file mapping question numbers to answer letters. Supported formats:
                <span className="text-zinc-700"> 1. A</span>, <span className="text-zinc-700">1,A</span>,{' '}
                <span className="text-zinc-700">1) A</span> per line, a flat{' '}
                <span className="text-zinc-700">1,A,2,B</span> line, or JSON.
              </p>

              <div className="mt-5 space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.tsv,.json,text/plain,application/json"
                  className="sr-only"
                  id="answer-key-file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <label
                  htmlFor="answer-key-file"
                  className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 text-center transition-colors hover:border-zinc-900 hover:bg-zinc-50"
                >
                  <FileUp className="h-5 w-5 text-zinc-400" aria-hidden="true" />
                  <span className="px-3 text-xs text-zinc-500">
                    {file ? (
                      <span className="font-medium text-zinc-900">{file.name}</span>
                    ) : (
                      <>
                        <span className="font-medium text-zinc-900 underline underline-offset-2">Choose a file</span>{' '}
                        (CSV / TXT / JSON)
                      </>
                    )}
                  </span>
                </label>

                <Button onClick={handleApplyFile} disabled={!file || applyingKey} className="w-full">
                  {applyingKey && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />}
                  Apply answer key
                </Button>

                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <span className="h-px flex-1 bg-zinc-100" />
                  or
                  <span className="h-px flex-1 bg-zinc-100" />
                </div>

                {!showPaste ? (
                  <button
                    onClick={() => setShowPaste(true)}
                    className="w-full text-center text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900"
                  >
                    Paste key text instead
                  </button>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      rows={4}
                      placeholder={'1. A\n2. C\n3. B'}
                      className="font-mono text-xs"
                      aria-label="Paste answer key text"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => applyKey(pastedText, 'pasted text')}
                      disabled={!pastedText.trim() || applyingKey}
                    >
                      Apply pasted key
                    </Button>
                  </div>
                )}

                <a
                  href={`/api/exams/${examId}/answer-key`}
                  className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md text-xs font-medium text-zinc-500 underline underline-offset-2 transition-colors hover:text-zinc-900"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Download current key as CSV template
                </a>
              </div>

              {keyResult && (
                <div className="mt-5 rounded-lg border border-zinc-200 p-4">
                  <p className="text-xs font-medium text-zinc-900">
                    {keyResult.fileName} · {keyResult.format} format
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Read {keyResult.parsedCount} answers · Applied to {keyResult.appliedCount} questions ·{' '}
                    {keyResult.updatedCount} updated
                  </p>
                  {keyResult.issues.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3">
                      {keyResult.issues.map((issue, i) => (
                        <p key={i} className="flex items-start gap-1.5 text-xs leading-relaxed text-amber-700">
                          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                          {issue}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            <p className="px-1 text-xs leading-relaxed text-zinc-400">
              Tip: grading happens automatically when a student submits. Every student sees a report card with
              right/wrong marks per question right after the exam.
            </p>
          </div>
        </div>
      </div>

      {/* Create / edit question dialog */}
      <Dialog open={createOpen || !!editing} onOpenChange={(open) => {
        if (!open) {
          setCreateOpen(false)
          setEditing(null)
        }
      }}>
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
              className="bg-red-600 text-white hover:bg-red-700"
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
