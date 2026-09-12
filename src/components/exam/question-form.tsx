'use client'

import { useState } from 'react'
import { Check, Loader2, Plus, X } from 'lucide-react'
import { api, AdminQuestion } from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

interface QuestionFormProps {
  examId: string
  initial?: AdminQuestion
  onDone: (saved: boolean) => void
}

/** Shared form for creating and editing a multiple-choice question. */
export function QuestionForm({ examId, initial, onDone }: QuestionFormProps) {
  const { toast } = useToast()
  const [text, setText] = useState(initial?.text ?? '')
  const [options, setOptions] = useState<string[]>(
    initial ? initial.options.map((o) => o.text) : ['', '', '', '']
  )
  const [correct, setCorrect] = useState(initial?.correctAnswer ?? 'A')
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  const [saving, setSaving] = useState(false)

  function setOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, j) => (j === i ? value : o)))
  }

  function addOption() {
    if (options.length < 6) setOptions((prev) => [...prev, ''])
  }

  function removeOption(i: number) {
    if (options.length <= 2) return
    const removedKey = LETTERS[i]
    setOptions((prev) => prev.filter((_, j) => j !== i))
    if (correct === removedKey) setCorrect('A')
  }

  async function handleSave() {
    if (!text.trim()) {
      toast({ title: 'Question text required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        text,
        options: options.map((o, i) => ({ key: LETTERS[i], text: o })),
        correctAnswer: correct,
        explanation,
      }
      if (initial) {
        await api(`/api/questions/${initial.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        toast({ title: 'Question updated' })
      } else {
        await api(`/api/exams/${examId}/questions`, { method: 'POST', body: JSON.stringify(payload) })
        toast({ title: 'Question added' })
      }
      onDone(true)
    } catch (err) {
      toast({ title: 'Could not save question', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="q-text">Question</Label>
        <Textarea
          id="q-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. What is the value of $x^2$ when $x = 3$?"
          rows={2}
          className="mt-1.5"
        />
        <p className="mt-2 text-xs text-zinc-400">
          LaTeX supported: wrap math in <span className="font-mono">$...$</span>, e.g.{' '}
          <span className="font-mono">$\frac{'{'}1{'}'}{'{'}2{'}'}$</span> or{' '}
          <span className="font-mono">$\sqrt{'{'}x{'}'}$</span>. Use <span className="font-mono">$$...$$</span> for
          display math.
        </p>
      </div>

      <div>
        <Label>
          Options <span className="font-normal text-zinc-400">- mark the correct one with the radio</span>
        </Label>
        <RadioGroup value={correct} onValueChange={setCorrect} className="mt-1.5 space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <RadioGroupItem value={LETTERS[i]} id={`opt-${i}`} aria-label={`Option ${LETTERS[i]} is correct`} />
              <span className="w-4 shrink-0 text-center text-xs font-semibold text-zinc-400">{LETTERS[i]}</span>
              <Input
                value={opt}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={`Option ${LETTERS[i]}`}
                className="flex-1"
              />
              {options.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-zinc-400 hover:text-red-600"
                  onClick={() => removeOption(i)}
                  aria-label={`Remove option ${LETTERS[i]}`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          ))}
        </RadioGroup>
        {options.length < 6 && (
          <Button type="button" variant="ghost" size="sm" onClick={addOption} className="mt-2 text-zinc-500">
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Add option
          </Button>
        )}
      </div>

      <div>
        <Label htmlFor="q-expl">
          Explanation <span className="font-normal text-zinc-400">(optional - shown on the report card)</span>
        </Label>
        <Input
          id="q-expl"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="e.g. Paris has been the capital since 987 AD."
          className="mt-1.5"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={() => onDone(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="mr-1 h-4 w-4" aria-hidden="true" />
          )}
          {initial ? 'Save changes' : 'Add question'}
        </Button>
      </div>
    </div>
  )
}
