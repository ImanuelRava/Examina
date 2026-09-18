'use client'

import katex from 'katex'
import { toPng } from 'html-to-image'

/**
 * Renders text containing LaTeX math (delimited by $...$ or $$...$$) into a
 * PNG image suitable for embedding in a jsPDF document.
 *
 * - Plain text segments are escaped HTML; math segments are rendered via KaTeX.
 * - The offscreen container is sized in CSS pt so its bounding box matches
 *   what jsPDF will draw (1pt = 1/72 inch; CSS px at 96 DPI = 0.75pt).
 * - Images are captured at pixelRatio 2 for crisp output when printed.
 * - Results are cached per (text + options) key so repeated equations in the
 *   same report card don't re-render.
 */

const PX_TO_PT = 0.75 // 96 DPI CSS pixels → PDF points

export interface RenderedImage {
  dataUrl: string
  widthPt: number
  heightPt: number
}

export interface RenderOptions {
  /** Font size in PDF points (matches jsPDF setFontSize). */
  fontSizePt: number
  /** Text color as RGB 0-255. */
  color: [number, number, number]
  /** Max width in PDF points (forces wrapping). */
  maxWidthPt?: number
  bold?: boolean
  italic?: boolean
  /** Background color. Defaults to white. */
  background?: [number, number, number]
  /** Inner padding in CSS pixels (kept small to keep the bounding box tight). */
  paddingPx?: number
  /** Font family. Defaults to a Helvetica/Arial sans-serif stack. */
  fontFamily?: string
  /** Line height multiplier. Defaults to 1.4. */
  lineHeight?: number
}

export function hasMath(text: string): boolean {
  return /\$[^$]/.test(text ?? '')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderMathSegment(tex: string, displayMode: boolean): string {
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

/**
 * Convert text with $...$ / $$...$$ delimiters into HTML where math segments
 * are rendered by KaTeX and plain segments are escaped text.
 */
function renderMixedMathToHtml(text: string): string {
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
      out += renderMathSegment(src.slice(dd + 2, end), true)
      i = end + 2
    } else {
      // Inline math $...$
      const end = src.indexOf('$', sd + 1)
      if (end === -1) {
        out += escapeHtml(src.slice(i))
        break
      }
      out += escapeHtml(src.slice(i, sd))
      out += renderMathSegment(src.slice(sd + 1, end), false)
      i = end + 1
    }
  }

  return out
}

const cache = new Map<string, RenderedImage>()

/**
 * Render a piece of text (which may contain LaTeX math) into a PNG image
 * sized for embedding in a jsPDF document.
 *
 * For text that contains no math, prefer jsPDF's native `doc.text()` — it
 * produces real selectable text and a smaller PDF. Use this function only
 * when `hasMath(text)` returns true.
 */
export async function renderTextWithMath(
  text: string,
  options: RenderOptions
): Promise<RenderedImage> {
  const key = JSON.stringify({ text, ...options })
  const cached = cache.get(key)
  if (cached) return cached

  const padding = options.paddingPx ?? 4
  const color = `rgb(${options.color.join(',')})`
  const bg = options.background
    ? `rgb(${options.background.join(',')})`
    : '#ffffff'
  const fontFamily =
    options.fontFamily ?? 'Helvetica, Arial, "Liberation Sans", sans-serif'
  const lineHeight = options.lineHeight ?? 1.4

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-99999px'
  container.style.top = '0'
  container.style.padding = `${padding}px`
  container.style.background = bg
  container.style.color = color
  container.style.fontSize = `${options.fontSizePt}pt`
  container.style.fontFamily = fontFamily
  container.style.fontWeight = options.bold ? '700' : '400'
  container.style.fontStyle = options.italic ? 'italic' : 'normal'
  container.style.lineHeight = String(lineHeight)
  container.style.whiteSpace = 'normal'
  container.style.wordBreak = 'break-word'
  container.style.overflowWrap = 'break-word'
  container.style.boxSizing = 'content-box'
  container.style.display = 'inline-block'
  if (options.maxWidthPt != null) {
    container.style.maxWidth = `${options.maxWidthPt}pt`
  }

  container.innerHTML = renderMixedMathToHtml(text)
  document.body.appendChild(container)

  try {
    // Let the browser lay out + load KaTeX fonts before capture.
    await new Promise((r) => setTimeout(r, 80))

    const dataUrl = await toPng(container, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: bg,
      // Skip fonts (KaTeX CSS is already loaded globally via layout.tsx).
      skipFonts: false,
    })

    const rect = container.getBoundingClientRect()
    const result: RenderedImage = {
      dataUrl,
      widthPt: rect.width * PX_TO_PT,
      heightPt: rect.height * PX_TO_PT,
    }
    cache.set(key, result)
    return result
  } finally {
    document.body.removeChild(container)
  }
}

/**
 * Pre-render a batch of texts in parallel.
 * Returns an array aligned with the input order. Failures degrade gracefully
 * to a placeholder image (so a single bad equation doesn't break the PDF).
 */
export async function renderBatch(
  items: Array<{ text: string; options: RenderOptions } | null>
): Promise<Array<RenderedImage | null>> {
  return Promise.all(
    items.map(async (item) => {
      if (!item || !hasMath(item.text)) return null
      try {
        return await renderTextWithMath(item.text, item.options)
      } catch (err) {
        console.warn('Math render failed for:', item.text, err)
        return null
      }
    })
  )
}

/** Clear the render cache (useful if generating multiple reports in one session). */
export function clearMathRenderCache(): void {
  cache.clear()
}
