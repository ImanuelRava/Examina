'use client'

import { useMemo } from 'react'
import katex from 'katex'

/**
 * Renders text containing LaTeX math segments.
 * Inline math:  $x^2 + 1$      Display math:  $$\frac{1}{2}$$
 * Everything outside math delimiters is escaped plain text.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderMath(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      throwOnError: false,
      displayMode,
      output: 'html',
      strict: false,
    })
  } catch {
    return escapeHtml(tex)
  }
}

export function buildMathHtml(text: string): string {
  const src = text ?? ''
  let out = ''
  let i = 0

  while (i < src.length) {
    const dd = src.indexOf('$$', i)
    const sd = src.indexOf('$', i)

    if (dd === -1 && sd === -1) {
      out += escapeHtml(src.slice(i))
      break
    }

    if (dd !== -1 && (sd === -1 || dd <= sd)) {
      // Display math $$...$$
      const end = src.indexOf('$$', dd + 2)
      if (end === -1) {
        out += escapeHtml(src.slice(i))
        break
      }
      out += escapeHtml(src.slice(i, dd))
      out += renderMath(src.slice(dd + 2, end), true)
      i = end + 2
    } else {
      // Inline math $...$
      const end = src.indexOf('$', sd + 1)
      if (end === -1) {
        out += escapeHtml(src.slice(i))
        break
      }
      out += escapeHtml(src.slice(i, sd))
      out += renderMath(src.slice(sd + 1, end), false)
      i = end + 1
    }
  }

  return out
}

interface MathTextProps {
  text: string
  className?: string
}

export function MathText({ text, className }: MathTextProps) {
  const html = useMemo(() => buildMathHtml(text), [text])
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
