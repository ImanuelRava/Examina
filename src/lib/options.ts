/**
 * Option utilities for multiple-choice questions.
 * Letters used for option keys (A-F, max 6 options per question).
 */
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
    .map((o, i) => ({
      key: (o?.key ?? OPTION_LETTERS[i] ?? '').toString().toUpperCase(),
      text: (o?.text ?? '').toString().trim(),
    }))
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
