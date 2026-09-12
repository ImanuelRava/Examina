/**
 * Answer key parser — supports the common formats teachers use:
 *
 * JSON:      {"1":"A","2":"C"}  |  ["A","C","B"]  |  [{"no":1,"answer":"A"}, ...]
 * CSV/TXT:   1,A                |  1. A           |  1) A
 *            1: A               |  1 A            |  1-A
 *            1,A,2,B,3,C        |  1.A 2.B 3.C    (single line also fine)
 */

export interface ParsedKey {
  answers: Record<number, string> // question number -> letter (A-J)
  format: 'json' | 'text'
  warnings: string[]
}

const LETTER_RE = /^[A-J]$/

export function parseAnswerKeyText(raw: string): ParsedKey {
  const text = raw.replace(/^\uFEFF/, '').trim()
  const warnings: string[] = []

  // ---- Try JSON first ----
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const data: unknown = JSON.parse(text)
      const answers: Record<number, string> = {}
      if (Array.isArray(data)) {
        data.forEach((item, i) => {
          if (typeof item === 'string') {
            const letter = item.trim().toUpperCase()
            if (LETTER_RE.test(letter)) answers[i + 1] = letter
          } else if (item && typeof item === 'object') {
            const rec = item as Record<string, unknown>
            const noRaw = rec.no ?? rec.number ?? rec.question ?? rec.q ?? rec.id ?? i + 1
            const ansRaw = rec.answer ?? rec.ans ?? rec.correct ?? rec.correctAnswer ?? rec.key
            const no = Number(noRaw)
            const letter = String(ansRaw ?? '').trim().toUpperCase()
            if (Number.isInteger(no) && no >= 1 && LETTER_RE.test(letter)) answers[no] = letter
          }
        })
      } else if (data && typeof data === 'object') {
        for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
          const no = Number(k)
          const letter = String(v ?? '').trim().toUpperCase()
          if (Number.isInteger(no) && no >= 1 && LETTER_RE.test(letter)) answers[no] = letter
        }
      }
      if (Object.keys(answers).length > 0) return { answers, format: 'json', warnings }
      warnings.push('JSON parsed, but no question → answer pairs were found. Trying text mode.')
    } catch {
      warnings.push('File looks like JSON but could not be parsed. Trying text mode.')
    }
  }

  // ---- Text mode: global scan for "1. A" / "1,A" / "1) A" / "1: A" / "1 A" / "1-A" ----
  const answers: Record<number, string> = {}
  const re = /(\d{1,4})\s*[.)\]:\-–—=]*\s*[,;]?\s*([A-J])(?![A-Za-z])/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const no = Number(m[1])
    if (no >= 1 && no <= 500) answers[no] = m[2].toUpperCase()
  }
  return { answers, format: 'text', warnings }
}

/** Letters used for option keys. */
export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

export interface RawOption {
  key?: string
  text: string
}

/**
 * Cleans and re-keys incoming options sequentially (A, B, C, ...).
 * Returns the cleaned options plus the re-mapped correct answer letter.
 */
export function normalizeOptions(
  options: RawOption[],
  correctAnswer: string
): { options: { key: string; text: string }[]; correctAnswer: string } | { error: string } {
  const cleaned = options
    .map((o) => (o?.text ?? '').toString().trim())
    .filter((t) => t.length > 0)
    .map((text, i) => ({ key: OPTION_LETTERS[i], text }))

  if (cleaned.length < 2) {
    return { error: 'A question needs at least 2 non-empty options.' }
  }

  const original = options
    .map((o, i) => ({ key: (o?.key ?? OPTION_LETTERS[i] ?? '').toString().toUpperCase(), text: (o?.text ?? '').toString().trim() }))
    .filter((o) => o.text.length > 0)

  const wanted = (correctAnswer ?? '').toString().trim().toUpperCase()
  const match = original.find((o) => o.key === wanted)
  if (!match) {
    return { error: 'The correct answer must point to one of the options.' }
  }
  const mapped = cleaned.find((c) => c.text === match.text)
  if (!mapped) return { error: 'The correct answer must point to one of the options.' }

  return { options: cleaned, correctAnswer: mapped.key }
}
