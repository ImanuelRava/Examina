'use client'

import katex from 'katex'
import { toPng } from 'html-to-image'

/**
 * Renders text containing LaTeX math (delimited by $...$ or $$...$$) into a
 * PNG image suitable for embedding in a jsPDF document.
 *
 * Key implementation details:
 * 1. Waits for `document.fonts.ready` before capturing, so KaTeX's custom
 *    web fonts (KaTeX_Main, KaTeX_Math, KaTeX_Sans, etc.) are fully loaded.
 *    Without this, the captured PNG is blank/transparent.
 * 2. Uses `skipFonts: true` in `toPng` — we don't need html-to-image to
 *    embed font files into the SVG (it has known CORS issues with font
 *    CDN URLs). Since fonts are already loaded in the document, the
 *    browser's native rendering uses them.
 * 3. Positions the offscreen container with `position: absolute` + near-zero
 *    opacity (NOT `position: fixed; left: -99999px` which can cause
 *    html-to-image to capture an empty area in some browsers).
 * 4. Validates the output PNG — if it's suspiciously small (likely empty),
 *    returns null so the caller falls back to native jsPDF text.
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
// Without explicitly loading these via document.fonts.load(), the browser
// doesn't download them until an element references them — and by then
// toPng has already captured an empty image.
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
    // Explicitly request each KaTeX font family. The browser downloads
    // the font files and adds them to its font cache. We load both normal
    // and italic styles since KaTeX uses both.
    await Promise.all(
      KATEX_FONT_FAMILIES.flatMap((family) => [
        document.fonts.load(`normal 16px "${family}"`),
        document.fonts.load(`italic 16px "${family}"`),
      ])
    )
    // Wait for all pending font loads to settle.
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

  const padding = options.paddingPx ?? 4
  const color = `rgb(${options.color.join(',')})`
  const bg = options.background
    ? `rgb(${options.background.join(',')})`
    : '#ffffff'
  const fontFamily =
    options.fontFamily ?? 'Helvetica, Arial, "Liberation Sans", sans-serif'
  const lineHeight = options.lineHeight ?? 1.4

  const container = document.createElement('div')
  // Use position: absolute with opacity: 0 + pointer-events: none.
  // position: fixed; left: -99999px can cause html-to-image to capture an
  // empty area in some browsers (the foreignObject renders outside the
  // visible viewport).
  container.style.position = 'absolute'
  container.style.left = '0'
  container.style.top = '0'
  container.style.opacity = '0'
  container.style.pointerEvents = 'none'
  container.style.zIndex = '-1'
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
    // CRITICAL: Preload KaTeX fonts AFTER the container is in the DOM
    // (so the browser knows which font families are needed) but BEFORE
    // capturing the image. Without this, toPng captures before the font
    // files are downloaded, producing a blank/transparent PNG.
    await preloadKatexFonts()

    // Extra settle delay after font swap.
    await new Promise((r) => setTimeout(r, 50))

    const dataUrl = await toPng(container, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: bg,
      // CRITICAL: skip font embedding. html-to-image's font embedding has
      // known CORS issues with KaTeX's font URLs. Since we've already
      // preloaded the fonts, the browser renders with them natively.
      skipFonts: true,
      quality: 1,
    })

    const rect = container.getBoundingClientRect()
    const widthPt = rect.width * PX_TO_PT
    const heightPt = rect.height * PX_TO_PT

    // Validation: if the image is suspiciously small or the data URL is too
    // short (indicating an empty/transparent capture), return null so the
    // caller falls back to native jsPDF text rendering.
    if (widthPt < 2 || heightPt < 2) {
      console.warn('Math render produced empty image for:', text)
      cache.set(key, null)
      return null
    }

    // A valid PNG data URL should be at least ~200 bytes. If it's shorter,
    // it's likely a blank/transparent image.
    if (dataUrl.length < 200) {
      console.warn('Math render produced suspiciously small PNG for:', text)
      cache.set(key, null)
      return null
    }

    const result: RenderedImage = { dataUrl, widthPt, heightPt }
    cache.set(key, result)
    return result
  } catch (err) {
    console.warn('Math render failed for:', text, err)
    cache.set(key, null)
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
