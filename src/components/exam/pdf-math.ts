'use client'

import html2canvas from 'html2canvas'

/**
 * Renders text containing LaTeX math into PNG images for PDF embedding.
 *
 * STRATEGY: Use MathJax (loaded from CDN) to convert LaTeX → SVG. MathJax's
 * SVG output embeds all glyph paths inline — zero font dependencies. This
 * avoids the KaTeX web-font loading race conditions that plagued earlier
 * attempts with html-to-image and html2canvas.
 *
 * Pipeline:
 * 1. Load MathJax from CDN (tex-svg bundle, ~1MB, cached after first load).
 * 2. Parse text into segments: plain text vs math ($...$ / $$...$$).
 * 3. For math segments: MathJax.tex2svg() → self-contained SVG string.
 * 4. Build an HTML container with plain text + inline SVGs.
 * 5. Capture with html2canvas (works reliably because SVGs are self-contained
 *    and plain text uses system fonts that are already loaded).
 * 6. Return PNG data URL + dimensions in PDF points.
 *
 * Fallback: if MathJax fails to load or rendering errors, returns null →
 * caller falls back to jsPDF native text with plain-text LaTeX stripping.
 */

const PX_TO_PT = 0.75
const MATHJAX_CDN = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js'

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

// ── MathJax loading ─────────────────────────────────────────────────────────

declare global {
  interface Window {
    MathJax?: any
  }
}

let mathJaxPromise: Promise<any> | null = null

function loadMathJax(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'))
  if (window.MathJax && window.MathJax.tex2svg) return Promise.resolve(window.MathJax)
  if (mathJaxPromise) return mathJaxPromise

  mathJaxPromise = new Promise((resolve, reject) => {
    // Configure before loading
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$']],
        displayMath: [['$$', '$$']],
      },
      svg: { fontCache: 'local' }, // 'local' = each SVG is self-contained
      startup: {
        ready: () => {
          window.MathJax.startup.defaultReady()
        },
      },
    }

    const script = document.createElement('script')
    script.src = MATHJAX_CDN
    script.async = true
    script.onload = () => {
      // MathJax processes async — wait for startup to complete
      if (window.MathJax && window.MathJax.startup) {
        window.MathJax.startup.promise.then(() => resolve(window.MathJax))
      } else {
        // Fallback: poll for tex2svg
        let attempts = 0
        const poll = setInterval(() => {
          attempts++
          if (window.MathJax && window.MathJax.tex2svg) {
            clearInterval(poll)
            resolve(window.MathJax)
          } else if (attempts > 50) {
            clearInterval(poll)
            reject(new Error('MathJax failed to initialize'))
          }
        }, 100)
      }
    }
    script.onerror = () => reject(new Error('Failed to load MathJax CDN'))
    document.head.appendChild(script)
  })

  return mathJaxPromise
}

// ── LaTeX parsing & rendering ───────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeLatex(tex: string): string {
  // Escape special chars for MathJax
  return tex
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function renderMathSegment(tex: string, displayMode: boolean): Promise<string> {
  try {
    const MathJax = await loadMathJax()
    const svgElement = MathJax.tex2svg(escapeLatex(tex), { display: displayMode })
    // Serialize the SVG element to string
    const svgString = new XMLSerializer().serializeToString(svgElement)
    // Set explicit width/height if not present (MathJax sometimes omits them)
    return svgString
  } catch (err) {
    console.warn('MathJax render failed for:', tex, err)
    return `<span style="color:#999">${escapeHtml(tex)}</span>`
  }
}

/**
 * Parse text with $...$ / $$...$$ delimiters and produce HTML with
 * inline MathJax SVGs for math segments and escaped text for plain segments.
 */
async function renderMixedMathToHtml(text: string): Promise<string> {
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
      out += await renderMathSegment(src.slice(dd + 2, end), true)
      i = end + 2
    } else {
      // Inline math $...$
      const end = src.indexOf('$', sd + 1)
      if (end === -1) {
        out += escapeHtml(src.slice(i))
        break
      }
      out += escapeHtml(src.slice(i, sd))
      out += await renderMathSegment(src.slice(sd + 1, end), false)
      i = end + 1
    }
  }

  return out
}

// ── Main render function ────────────────────────────────────────────────────

const cache = new Map<string, RenderedImage | null>()

export async function renderTextWithMath(
  text: string,
  options: RenderOptions
): Promise<RenderedImage | null> {
  const key = JSON.stringify({ text, ...options })
  if (cache.has(key)) return cache.get(key) ?? null

  // 8-second timeout — better to fall back to text than hang forever
  const TIMEOUT_MS = 8000

  const result = await Promise.race([
    renderInternal(text, options),
    new Promise<RenderedImage | null>((resolve) =>
      setTimeout(() => {
        console.warn('Math render timed out for:', text.slice(0, 50))
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
  const lineHeight = options.lineHeight ?? 1.5

  // Build the HTML with inline MathJax SVGs
  const innerHtml = await renderMixedMathToHtml(text)

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
  // Ensure SVGs render inline with text
  container.style.verticalAlign = 'baseline'
  if (options.maxWidthPt != null) {
    container.style.maxWidth = `${options.maxWidthPt}pt`
  }

  container.innerHTML = innerHtml

  // Style all inline SVGs to be vertically aligned with text
  const svgs = container.querySelectorAll('svg')
  svgs.forEach((svg) => {
    svg.style.verticalAlign = 'middle'
    svg.style.display = 'inline-block'
    svg.style.maxWidth = '100%'
    svg.style.height = 'auto'
  })

  document.body.appendChild(container)

  try {
    // Wait for layout to settle
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
      console.warn('Math render produced empty image for:', text.slice(0, 50))
      return null
    }

    if (dataUrl.length < 200) {
      console.warn('Math render produced suspiciously small PNG for:', text.slice(0, 50))
      return null
    }

    return { dataUrl, widthPt, heightPt }
  } catch (err) {
    console.warn('Math render failed for:', text.slice(0, 50), err)
    return null
  } finally {
    document.body.removeChild(container)
  }
}

export async function renderBatch(
  items: Array<{ text: string; options: RenderOptions } | null>
): Promise<Array<RenderedImage | null>> {
  // Pre-load MathJax before rendering anything
  try {
    await loadMathJax()
  } catch {
    // Will fall back to text per-item
  }

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
