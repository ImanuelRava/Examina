'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { api, ExamSummary } from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

export function AdminExamList() {
  const router = useRouter()
  const { toast } = useToast()
  const [exams, setExams] = useState<ExamSummary[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    const { exams: data } = await api<{
      exams: (ExamSummary & { _count: { questions: number; attempts: number } })[]
    }>('/api/exams')
    setExams(
      data.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        createdAt: e.createdAt,
        questionCount: e._count.questions,
        attemptCount: e._count.attempts,
      }))
    )
  }, [])

  useEffect(() => {
    load().catch((err: Error) => toast({ title: 'Could not load exams', description: err.message, variant: 'destructive' }))
  }, [load, toast])

  async function handleCreate() {
    if (!title.trim()) {
      toast({ title: 'Title required', description: 'Give your exam a title first.', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const { exam } = await api<{ exam: { id: string } }>('/api/exams', {
        method: 'POST',
        body: JSON.stringify({ title, description }),
      })
      setCreateOpen(false)
      setTitle('')
      setDescription('')
      toast({ title: 'Exam created', description: 'Now add questions to it.' })
      router.push(`/admin/exams/${exam.id}`)
    } catch (err) {
      toast({ title: 'Could not create exam', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete() {
    if (!deletingId) return
    setDeleting(true)
    try {
      await api(`/api/exams/${deletingId}`, { method: 'DELETE' })
      toast({ title: 'Exam deleted' })
      setDeletingId(null)
      await load()
    } catch (err) {
      toast({ title: 'Could not delete exam', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Exams</h1>
          <p className="mt-1 text-sm text-zinc-500">Set up exams: create tests and manage questions.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="shrink-0">
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
          New exam
        </Button>
      </div>

      <div className="mt-8 space-y-3">
        {exams === null ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading…
          </div>
        ) : exams.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center">
            <p className="text-sm font-medium text-zinc-900">No exams yet</p>
            <p className="mt-1 text-sm text-zinc-500">Create your first exam to get started.</p>
          </div>
        ) : (
          exams.map((exam) => (
            <div
              key={exam.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 p-5 transition-colors hover:border-zinc-400 sm:p-6"
            >
              <button
                onClick={() => router.push(`/admin/exams/${exam.id}`)}
                className="min-w-0 flex-1 text-left focus-visible:outline-none"
              >
                <span className="block truncate text-base font-medium text-zinc-900">{exam.title}</span>
                <span className="mt-0.5 block truncate text-sm text-zinc-500">
                  {exam.questionCount} {exam.questionCount === 1 ? 'question' : 'questions'} ·{' '}
                  {exam.attemptCount} {exam.attemptCount === 1 ? 'attempt' : 'attempts'}
                  {exam.description ? ` · ${exam.description}` : ''}
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={() => router.push(`/admin/exams/${exam.id}`)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${exam.title}`}
                  onClick={() => setDeletingId(exam.id)}
                  className="text-zinc-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create exam dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create exam</DialogTitle>
            <DialogDescription>Students will see this title and description.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="exam-title">Title</Label>
              <Input
                id="exam-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Midterm Mathematics"
                autoFocus
                className="mt-2.5"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div>
              <Label htmlFor="exam-desc">
                Description <span className="font-normal text-zinc-400">(optional)</span>
              </Label>
              <Textarea
                id="exam-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this exam cover?"
                rows={3}
                className="mt-2.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />}
              Create exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this exam?</AlertDialogTitle>
            <AlertDialogDescription>
              All of its questions and student attempts will be permanently removed. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />}
              Delete exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
