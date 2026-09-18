'use client'

import katex from 'katex'
import html2canvas from 'html2canvas'

/**
 * Renders text containing LaTeX math (delimited by $...$ or $$...$$) into a
 * PNG image suitable for embedding in a jsPDF document.
 *
 * Uses html2canvas (NOT html-to-image). html2canvas rasterizes the DOM
 * directly using the browser's own rendering — it doesn't try to embed
 * fonts into an SVG foreignObject, which avoids the KaTeX font-loading
 * race conditions and CORS issues that plague html-to-image.
 *
 * Pipeline:
 * 1. Insert an offscreen container with the rendered KaTeX HTML.
 * 2. Wait for document.fonts.ready (KaTeX fonts are loaded globally via
 *    katex.min.css in layout.tsx).
 * 3. Force a synchronous reflow.
 * 4. html2canvas rasterizes the container to a <canvas>.
 * 5. Convert canvas to PNG data URL, measure in PDF points, return.
 *
 * Results are cached per (text + options) key so repeated equations in the
 * same report don't re-render.
 */

const PX_TO_PT = 0.75 // 96 DPI CSS pixels → PDF points

export interface RenderedImage {
  dataUrl: string
  widthPt: number
  heightPt: number
}

export interface RenderOptions {
  fontSizePt: number
  color: [number, number, number]
  maxWidthPt?: number
  bold?: boolean
  italic?: boolean
  background?: [number, number, number]
  paddingPx?: number
  fontFamily?: string
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
      const end = src.indexOf('$$', dd + 2)
      if (end === -1) {
        out += escapeHtml(src.slice(i))
        break
      }
      out += escapeHtml(src.slice(i, dd))
      out += renderMathSegment(src.slice(dd + 2, end), true)
      i = end + 2
    } else {
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

const cache = new Map<string, RenderedImage | null>()

// KaTeX font families that need to be preloaded before image capture.
const KATEX_FONT_FAMILIES = [
  'KaTeX_Main',
  'KaTeX_Math',
  'KaTeX_Caligraphic',
  'KaTeX_Fraktur',
  'KaTeX_SansSerif',
  'KaTeX_Script',
  'KaTeX_Typewriter',
  'KaTeX_Size1',
  'KaTeX_Size2',
  'KaTeX_Size3',
  'KaTeX_Size4',
  'KaTeX_AMS',
]

let katexFontsLoaded = false

async function preloadKatexFonts(): Promise<void> {
  if (katexFontsLoaded) return
  if (typeof document === 'undefined' || !('fonts' in document)) return

  try {
    await Promise.all(
      KATEX_FONT_FAMILIES.flatMap((family) => [
        document.fonts.load(`normal 16px "${family}"`),
        document.fonts.load(`italic 16px "${family}"`),
      ])
    )
    await document.fonts.ready
    katexFontsLoaded = true
  } catch {
    // Non-fatal — proceed with whatever fonts are available.
  }
}

export async function renderTextWithMath(
  text: string,
  options: RenderOptions
): Promise<RenderedImage | null> {
  const key = JSON.stringify({ text, ...options })
  if (cache.has(key)) return cache.get(key) ?? null

  // Time budget: if rendering takes longer than 8 seconds, give up and
  // fall back to plain text. Better to ship a PDF with text than no PDF.
  const TIMEOUT_MS = 8000

  const result = await Promise.race([
    renderInternal(text, options),
    new Promise<RenderedImage | null>((resolve) =>
      setTimeout(() => {
        console.warn('Math render timed out for:', text)
        resolve(null)
      }, TIMEOUT_MS)
    ),
  ])

  cache.set(key, result)
  return result
}

async function renderInternal(
  text: string,
  options: RenderOptions
): Promise<RenderedImage | null> {
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
  container.style.left = '-9999px'
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
    await preloadKatexFonts()
    void container.offsetHeight
    await new Promise((r) => setTimeout(r, 50))

    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: bg,
      logging: false,
      useCORS: true,
    })

    const dataUrl = canvas.toDataURL('image/png')
    const widthPt = (canvas.width / 2) * PX_TO_PT
    const heightPt = (canvas.height / 2) * PX_TO_PT

    if (widthPt < 2 || heightPt < 2) {
      console.warn('Math render produced empty image for:', text)
      return null
    }

    if (dataUrl.length < 200) {
      console.warn('Math render produced suspiciously small PNG for:', text)
      return null
    }

    return { dataUrl, widthPt, heightPt }
  } catch (err) {
    console.warn('Math render failed for:', text, err)
    return null
  } finally {
    document.body.removeChild(container)
  }
}

export async function renderBatch(
  items: Array<{ text: string; options: RenderOptions } | null>
): Promise<Array<RenderedImage | null>> {
  return Promise.all(
    items.map(async (item) => {
      if (!item || !hasMath(item.text)) return null
      return renderTextWithMath(item.text, item.options)
    })
  )
}

export function clearMathRenderCache(): void {
  cache.clear()
}
