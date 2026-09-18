'use client'

import type { AttemptReport } from './types'
import { formatDuration } from './types'
import {
  hasMath,
  renderBatch,
  renderTextWithMath,
  clearMathRenderCache,
  type RenderedImage,
} from './pdf-math'

/**
 * Generates a clean, minimalist PDF report card with jsPDF.
 *
 * Math rendering: text containing $...$ or $$...$$ is rendered to a PNG via
 * KaTeX + html-to-image, then embedded as an image in the PDF. Plain text
 * uses jsPDF's native text() for crispness and small file size.
 *
 * Dynamic imports keep jsPDF out of the initial bundle.
 */

const INK: [number, number, number] = [24, 24, 27]
const MUTED: [number, number, number] = [113, 113, 122]
const LINE: [number, number, number] = [228, 228, 231]
const GREEN: [number, number, number] = [5, 150, 105]
const RED: [number, number, number] = [220, 38, 38]
const SOFT_GREEN: [number, number, number] = [236, 253, 245]
const SOFT_RED: [number, number, number] = [254, 242, 242]
const WHITE: [number, number, number] = [255, 255, 255]

/**
 * Fallback plain-text conversion for text that contains math but failed to
 * render as an image, OR for text without math (where we still need to strip
 * stray $ delimiters). Output sticks to WinAnsi glyphs.
 */
function plain(input: string): string {
  let s = (input ?? '')
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\$([^$]*?)\$/g, '$1')

  const rules: Array<[RegExp, string]> = [
    [/\^\{\s*\\circ\s*\}/g, '°'],
    [/\^\\circ\b/g, '°'],
    [/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)'],
    [/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)'],
    [/\\times\b/g, ' × '],
    [/\\cdot\b/g, ' · '],
    [/\\div\b/g, ' ÷ '],
    [/\\pm\b/g, '±'],
    [/\\leq?\b/g, '<='],
    [/\\geq?\b/g, '>='],
    [/\\neq?\b/g, '!='],
    [/\\approx\b/g, '~'],
    [/\\infty\b/g, 'infinity'],
    [/\\sum\b/g, 'sum'],
    [/\\prod\b/g, 'product'],
    [/\\int\b/g, 'integral'],
    [/\\Rightarrow\b/g, '=>'],
    [/\\to\b|\\rightarrow\b/g, '->'],
    [/\\(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|nu|rho|sigma|tau|phi|omega)\b/g, ' $1 '],
    [/\\(Alpha|Beta|Gamma|Delta|Theta|Lambda|Sigma|Omega)\b/g, ' $1 '],
    [/\\pi\b/g, ' pi '],
    [/\\circ\b/g, '°'],
    [/\\text\b|\\mathrm\b/g, ''],
    [/\\left\b|\\right\b/g, ''],
    [/\\quad\b|\\qquad\b/g, ' '],
    [/\\\\/g, ' '],
    [/\\[,;!]/g, ' '],
    [/\\%/g, '%'],
    [/\\\{/g, '{'],
    [/\\\}/g, '}'],
    [/\\&/g, '&'],
  ]
  for (const [re, rep] of rules) s = s.replace(re, rep)

  const SUP: Record<string, string> = { '1': '¹', '2': '²', '3': '³' }
  s = s
    .replace(/\^\{([^{}]+)\}/g, (_m, g: string) => (g.length === 1 && SUP[g]) || `^${g}`)
    .replace(/\^([0-9])(?![0-9])/g, (m, d: string) => SUP[d] ?? m)

  s = s.replace(/_\{([^{}]+)\}/g, '_$1')

  s = s.replace(/[{}]/g, '').replace(/[ \t]+/g, ' ').replace(/ +([,.!?;:])/g, '$1').trim()
  return s
}

interface QuestionRow {
  order: number
  isCorrect: boolean
  selected: string
  questionImg: RenderedImage | null
  questionText: string
  yourAnswerImg: RenderedImage | null
  yourAnswerText: string
  correctAnswerImg: RenderedImage | null
  correctAnswerText: string
  resultLabel: 'Right' | 'Wrong' | 'Skipped'
}

export async function downloadReportPdf(report: AttemptReport): Promise<void> {
  try {
    await downloadReportPdfInternal(report)
  } catch (err) {
    console.error('PDF generation failed, falling back to text-only:', err)
    // Last-resort fallback: a minimal text-only PDF so the user always
    // gets *something* downloadable, even if math image rendering crashes.
    await downloadReportPdfFallback(report)
  }
}

async function downloadReportPdfInternal(report: AttemptReport): Promise<void> {
  clearMathRenderCache()
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 48
  const contentW = W - M * 2

  // ---------- Header ----------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text("Noel's Test", M, 56)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('REPORT CARD', W - M, 56, { align: 'right' })

  doc.setDrawColor(...LINE)
  doc.setLineWidth(1)
  doc.line(M, 68, W - M, 68)

  // ---------- Title + meta ----------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...INK)
  const titleLines = doc.splitTextToSize(plain(report.examTitle), contentW)
  doc.text(titleLines, M, 98)
  let y = 98 + titleLines.length * 21

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...MUTED)
  const metaBits = [
    report.studentName !== 'Anonymous' ? report.studentName : null,
    new Date(report.createdAt).toLocaleString(),
    report.timeSpentSeconds != null ? `Time used ${formatDuration(report.timeSpentSeconds)}` : null,
    report.autoSubmitted ? 'Auto-submitted (time expired)' : null,
  ].filter(Boolean) as string[]
  doc.text(metaBits.join('   ·   '), M, y)
  y += 30

  // ---------- Score band ----------
  const pct = report.total > 0 ? Math.round((report.score / report.total) * 100) : 0
  const bandH = 88
  doc.setFillColor(250, 250, 250)
  doc.roundedRect(M, y, contentW, bandH, 6, 6, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text('SCORE', M + 20, y + 22)

  doc.setFontSize(24)
  doc.setTextColor(...INK)
  doc.text(`${report.score}/${report.total}`, M + 20, y + 50)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...(pct >= 50 ? GREEN : RED))
  doc.text(`${pct}%`, M + 20, y + 68)

  const barX = M + 110
  const barY = y + 40
  const barW = contentW - 130 - 150
  doc.setFillColor(...LINE)
  doc.roundedRect(barX, barY, barW, 8, 4, 4, 'F')
  doc.setFillColor(...(pct >= 50 ? GREEN : RED))
  if (pct > 0) doc.roundedRect(barX, barY, Math.max(8, (barW * pct) / 100), 8, 4, 4, 'F')

  const correctCount = report.questions.filter((q) => q.isCorrect).length
  const skippedCount = report.questions.filter((q) => !q.selected).length
  const wrongCount = report.total - correctCount - skippedCount
  const legendX = barX + barW + 24
  doc.setFontSize(9.5)
  doc.setTextColor(...GREEN)
  doc.text(`${correctCount} right`, legendX, y + 34)
  doc.setTextColor(...RED)
  doc.text(`${wrongCount} wrong`, legendX, y + 50)
  doc.setTextColor(...MUTED)
  doc.text(`${skippedCount} skipped`, legendX, y + 66)

  y += bandH + 28

  // ---------- Pre-render all math images in parallel ----------
  // Column widths must match the table layout below.
  const colWidths = {
    num: 26,
    question: contentW - 26 - 118 - 118 - 52,
    yourAnswer: 118,
    correctAnswer: 118,
    result: 52,
  }

  const renderItems = report.questions.map((q) => {
    const sel = q.options.find((o) => o.key === q.selected)
    const cor = q.options.find((o) => o.key === q.correctAnswer)
    const yourAnswerText = q.selected ? `${q.selected}. ${sel?.text ?? ''}` : 'Not answered'
    const correctAnswerText = `${q.correctAnswer}. ${cor?.text ?? ''}`
    return {
      q,
      sel,
      cor,
      yourAnswerText,
      correctAnswerText,
    }
  })

  const [questionImgs, yourAnswerImgs, correctAnswerImgs] = await Promise.all([
    renderBatch(
      renderItems.map((r) =>
        hasMath(r.q.text)
          ? {
              text: r.q.text,
              options: {
                fontSizePt: 9,
                color: INK,
                maxWidthPt: colWidths.question - 12,
                paddingPx: 3,
              },
            }
          : null
      )
    ),
    renderBatch(
      renderItems.map((r) =>
        r.q.selected && hasMath(r.yourAnswerText)
          ? {
              text: r.yourAnswerText,
              options: {
                fontSizePt: 9,
                color: INK,
                maxWidthPt: colWidths.yourAnswer - 12,
                paddingPx: 3,
              },
            }
          : null
      )
    ),
    renderBatch(
      renderItems.map((r) =>
        hasMath(r.correctAnswerText)
          ? {
              text: r.correctAnswerText,
              options: {
                fontSizePt: 9,
                color: INK,
                maxWidthPt: colWidths.correctAnswer - 12,
                paddingPx: 3,
              },
            }
          : null
      )
    ),
  ])

  const rows: QuestionRow[] = renderItems.map((r, i) => ({
    order: r.q.order,
    isCorrect: r.q.isCorrect,
    selected: r.q.selected,
    questionImg: questionImgs[i] ?? null,
    questionText: r.q.text,
    yourAnswerImg: yourAnswerImgs[i] ?? null,
    yourAnswerText: r.yourAnswerText,
    correctAnswerImg: correctAnswerImgs[i] ?? null,
    correctAnswerText: r.correctAnswerText,
    resultLabel: r.q.isCorrect ? 'Right' : r.q.selected ? 'Wrong' : 'Skipped',
  }))

  // ---------- Question table (manual drawing for image support) ----------
  y = drawQuestionTable(doc, rows, y, M, contentW, H)

  y += 30

  // ---------- Review section for wrong / skipped ----------
  const toReview = report.questions.filter((q) => !q.isCorrect)
  if (toReview.length > 0) {
    if (y > H - 140) {
      doc.addPage()
      y = 56
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...INK)
    doc.text('Review - questions to revisit', M, y)
    y += 16

    // Pre-render review math images
    const reviewItems = toReview.map((q) => {
      const cor = q.options.find((o) => o.key === q.correctAnswer)
      return {
        q,
        cor,
        headText: `Q${q.order}. ${q.text}`,
        detailText: `Correct answer: ${q.correctAnswer}. ${cor?.text ?? ''}${q.selected ? '' : '  (you left this blank)'}`,
        explText: q.explanation ? `Explanation: ${q.explanation}` : '',
      }
    })

    const [headImgs, detailImgs, explImgs] = await Promise.all([
      renderBatch(
        reviewItems.map((r) =>
          hasMath(r.headText)
            ? {
                text: r.headText,
                options: {
                  fontSizePt: 9,
                  color: INK,
                  maxWidthPt: contentW,
                  bold: true,
                  paddingPx: 3,
                },
              }
            : null
        )
      ),
      renderBatch(
        reviewItems.map((r) =>
          hasMath(r.detailText)
            ? {
                text: r.detailText,
                options: {
                  fontSizePt: 9,
                  color: GREEN,
                  maxWidthPt: contentW,
                  paddingPx: 3,
                },
              }
            : null
        )
      ),
      renderBatch(
        reviewItems.map((r) =>
          r.explText && hasMath(r.explText)
            ? {
                text: r.explText,
                options: {
                  fontSizePt: 8.5,
                  color: MUTED,
                  maxWidthPt: contentW,
                  paddingPx: 3,
                },
              }
            : null
        )
      ),
    ])

    for (let i = 0; i < reviewItems.length; i++) {
      const r = reviewItems[i]
      const headImg = headImgs[i]
      const detailImg = detailImgs[i]
      const explImg = explImgs[i]

      // Estimate block height
      const headH = headImg ? headImg.heightPt : estimateTextHeight(doc, plain(r.headText), contentW, 9, 13)
      const detailH = detailImg ? detailImg.heightPt : estimateTextHeight(doc, plain(r.detailText), contentW, 9, 13)
      const explH = explImg
        ? explImg.heightPt
        : r.explText
          ? estimateTextHeight(doc, plain(r.explText), contentW, 8.5, 11)
          : 0
      const blockH = headH + 13 + detailH + 13 + explH + 14

      if (y + blockH > H - 56) {
        doc.addPage()
        y = 56
      }

      // Head
      if (headImg) {
        doc.addImage(headImg.dataUrl, 'PNG', M, y - 3, headImg.widthPt, headImg.heightPt)
        y += headImg.heightPt
      } else {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...INK)
        const wrapped = doc.splitTextToSize(plain(r.headText), contentW)
        doc.text(wrapped, M, y + 9)
        y += wrapped.length * 13
      }

      // Detail
      if (detailImg) {
        doc.addImage(detailImg.dataUrl, 'PNG', M, y - 3, detailImg.widthPt, detailImg.heightPt)
        y += detailImg.heightPt
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(...GREEN)
        const wrapped = doc.splitTextToSize(plain(r.detailText), contentW)
        doc.text(wrapped, M, y + 9)
        y += wrapped.length * 13
      }

      // Explanation
      if (r.explText) {
        if (explImg) {
          doc.addImage(explImg.dataUrl, 'PNG', M, y - 3, explImg.widthPt, explImg.heightPt)
          y += explImg.heightPt
        } else {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8.5)
          doc.setTextColor(...MUTED)
          const wrapped = doc.splitTextToSize(plain(r.explText), contentW)
          doc.text(wrapped, M, y + 9)
          y += wrapped.length * 11
        }
      }
      y += 14
    }
  }

  // ---------- Footer on every page ----------
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(1)
    doc.line(M, H - 44, W - M, H - 44)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text("Generated by Noel's Test - instant report cards for every test", M, H - 30)
    doc.text(`${p} / ${pages}`, W - M, H - 30, { align: 'right' })
  }

  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const student = report.studentName !== 'Anonymous' ? `-${slug(report.studentName)}` : ''
  doc.save(`report-card-${slug(report.examTitle)}${student}.pdf`)
}

// ---------- Helpers ----------

/** Estimate the height (in pt) of plain text wrapped to a given width. */
function estimateTextHeight(
  doc: { splitTextToSize: (t: string, w: number) => string[] },
  text: string,
  width: number,
  fontSize: number,
  lineHeight: number
): number {
  const lines = doc.splitTextToSize(text, width)
  return lines.length * lineHeight
}

/**
 * Draws the question table manually so we can embed rendered math images in
 * cells. Returns the y position after the table.
 */
function drawQuestionTable(
  doc: import('jspdf').jsPDF,
  rows: QuestionRow[],
  startY: number,
  marginX: number,
  contentW: number,
  pageH: number
): number {
  const W = doc.internal.pageSize.getWidth()
  const colWidths = {
    num: 26,
    question: contentW - 26 - 118 - 118 - 52,
    yourAnswer: 118,
    correctAnswer: 118,
    result: 52,
  }
  const cols = [
    { key: 'num', w: colWidths.num, label: '#' },
    { key: 'question', w: colWidths.question, label: 'Question' },
    { key: 'yourAnswer', w: colWidths.yourAnswer, label: 'Your answer' },
    { key: 'correctAnswer', w: colWidths.correctAnswer, label: 'Correct answer' },
    { key: 'result', w: colWidths.result, label: 'Result' },
  ]
  const padX = 6
  const padY = 6
  const fontSize = 8.5
  const headerFontSize = 8
  const minRowHeight = 24

  let y = startY

  // ---- Header row ----
  const headerH = 22
  doc.setFillColor(...INK)
  doc.rect(marginX, y, contentW, headerH, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(headerFontSize)
  doc.setTextColor(...WHITE)
  let x = marginX
  for (const col of cols) {
    let align: 'left' | 'center' = 'left'
    if (col.key === 'num' || col.key === 'result') align = 'center'
    const textX = align === 'center' ? x + col.w / 2 : x + padX
    doc.text(col.label, textX, y + headerH / 2 + headerFontSize / 3, {
      align: align === 'center' ? 'center' : 'left',
    })
    x += col.w
  }
  y += headerH

  // ---- Body rows ----
  for (const row of rows) {
    // Compute row height from the tallest cell.
    const cellHeights: number[] = []

    // # column: just a number, single line
    cellHeights.push(minRowHeight)

    // Question column
    if (row.questionImg) {
      cellHeights.push(Math.max(minRowHeight, row.questionImg.heightPt + padY * 2))
    } else {
      const lines = doc.splitTextToSize(plain(row.questionText), colWidths.question - padX * 2)
      cellHeights.push(Math.max(minRowHeight, lines.length * (fontSize + 3) + padY * 2))
    }

    // Your answer
    if (row.yourAnswerImg) {
      cellHeights.push(Math.max(minRowHeight, row.yourAnswerImg.heightPt + padY * 2))
    } else {
      const txt = row.selected ? plain(row.yourAnswerText) : 'Not answered'
      const lines = doc.splitTextToSize(txt, colWidths.yourAnswer - padX * 2)
      cellHeights.push(Math.max(minRowHeight, lines.length * (fontSize + 3) + padY * 2))
    }

    // Correct answer
    if (row.correctAnswerImg) {
      cellHeights.push(Math.max(minRowHeight, row.correctAnswerImg.heightPt + padY * 2))
    } else {
      const lines = doc.splitTextToSize(plain(row.correctAnswerText), colWidths.correctAnswer - padX * 2)
      cellHeights.push(Math.max(minRowHeight, lines.length * (fontSize + 3) + padY * 2))
    }

    // Result: single word
    cellHeights.push(minRowHeight)

    const rowH = Math.max(...cellHeights)

    // Page break if needed
    if (y + rowH > pageH - 56) {
      doc.addPage()
      y = 56
      // Re-draw header on new page
      doc.setFillColor(...INK)
      doc.rect(marginX, y, contentW, headerH, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(headerFontSize)
      doc.setTextColor(...WHITE)
      let hx = marginX
      for (const col of cols) {
        const align = col.key === 'num' || col.key === 'result' ? 'center' : 'left'
        const textX = align === 'center' ? hx + col.w / 2 : hx + padX
        doc.text(col.label, textX, y + headerH / 2 + headerFontSize / 3, {
          align: align === 'center' ? 'center' : 'left',
        })
        hx += col.w
      }
      y += headerH
    }

    // Row background
    const fillColor =
      row.resultLabel === 'Right'
        ? SOFT_GREEN
        : row.resultLabel === 'Wrong'
          ? SOFT_RED
          : WHITE
    doc.setFillColor(...fillColor)
    doc.rect(marginX, y, contentW, rowH, 'F')

    // Row borders
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.5)
    let bx = marginX
    for (const col of cols) {
      doc.rect(bx, y, col.w, rowH, 'S')
      bx += col.w
    }

    // Cell content
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(fontSize)

    let cx = marginX
    for (const col of cols) {
      const innerX = cx + padX
      const innerY = y + padY
      const innerW = col.w - padX * 2

      if (col.key === 'num') {
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...MUTED)
        doc.text(String(row.order), cx + col.w / 2, y + rowH / 2 + fontSize / 3, {
          align: 'center',
        })
      } else if (col.key === 'question') {
        if (row.questionImg) {
          // Vertically center the image in the cell.
          const imgY = y + (rowH - row.questionImg.heightPt) / 2
          doc.addImage(row.questionImg.dataUrl, 'PNG', innerX, imgY, row.questionImg.widthPt, row.questionImg.heightPt)
        } else {
          doc.setTextColor(...INK)
          const lines = doc.splitTextToSize(plain(row.questionText), innerW)
          doc.text(lines, innerX, innerY + fontSize)
        }
      } else if (col.key === 'yourAnswer') {
        if (row.yourAnswerImg) {
          const imgY = y + (rowH - row.yourAnswerImg.heightPt) / 2
          doc.addImage(row.yourAnswerImg.dataUrl, 'PNG', innerX, imgY, row.yourAnswerImg.widthPt, row.yourAnswerImg.heightPt)
        } else {
          doc.setTextColor(...INK)
          const txt = row.selected ? plain(row.yourAnswerText) : 'Not answered'
          const lines = doc.splitTextToSize(txt, innerW)
          doc.text(lines, innerX, innerY + fontSize)
        }
      } else if (col.key === 'correctAnswer') {
        if (row.correctAnswerImg) {
          const imgY = y + (rowH - row.correctAnswerImg.heightPt) / 2
          doc.addImage(row.correctAnswerImg.dataUrl, 'PNG', innerX, imgY, row.correctAnswerImg.widthPt, row.correctAnswerImg.heightPt)
        } else {
          doc.setTextColor(...INK)
          const lines = doc.splitTextToSize(plain(row.correctAnswerText), innerW)
          doc.text(lines, innerX, innerY + fontSize)
        }
      } else if (col.key === 'result') {
        const color = row.resultLabel === 'Right' ? GREEN : row.resultLabel === 'Wrong' ? RED : MUTED
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...color)
        doc.text(row.resultLabel, cx + col.w / 2, y + rowH / 2 + fontSize / 3, {
          align: 'center',
        })
        doc.setFont('helvetica', 'normal')
      }

      cx += col.w
    }

    y += rowH
  }

  return y
}

/**
 * Last-resort fallback: a minimal text-only PDF using the plain() text
 * converter (no KaTeX image rendering). Used when the main renderer throws
 * so the user always gets *something* downloadable.
 */
async function downloadReportPdfFallback(report: AttemptReport): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 48
  const contentW = W - M * 2

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(24, 24, 27)
  doc.text("Noel's Test", M, 56)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(113, 113, 122)
  doc.text('REPORT CARD (text-only fallback)', W - M, 56, { align: 'right' })

  doc.setDrawColor(228, 228, 231)
  doc.setLineWidth(1)
  doc.line(M, 68, W - M, 68)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(24, 24, 27)
  const titleLines = doc.splitTextToSize(plain(report.examTitle), contentW)
  doc.text(titleLines, M, 98)
  let y = 98 + titleLines.length * 21

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(113, 113, 122)
  const pct = report.total > 0 ? Math.round((report.score / report.total) * 100) : 0
  const meta = [
    report.studentName !== 'Anonymous' ? report.studentName : null,
    new Date(report.createdAt).toLocaleString(),
    `Score ${report.score}/${report.total} (${pct}%)`,
    report.autoSubmitted ? 'Auto-submitted' : null,
  ]
    .filter(Boolean)
    .join('   ·   ')
  doc.text(meta, M, y)
  y += 24

  for (const q of report.questions) {
    if (y > H - 80) {
      doc.addPage()
      y = 56
    }
    const sel = q.options.find((o) => o.key === q.selected)
    const cor = q.options.find((o) => o.key === q.correctAnswer)
    const status = q.isCorrect ? 'Right' : q.selected ? 'Wrong' : 'Skipped'

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(24, 24, 27)
    doc.text(`Q${q.order}. ${plain(q.text)}`, M, y)
    y += 14

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(113, 113, 122)
    doc.text(
      `Your answer: ${q.selected ? `${q.selected}. ${plain(sel?.text ?? '')}` : 'Not answered'}`,
      M,
      y
    )
    y += 12
    doc.text(`Correct answer: ${q.correctAnswer}. ${plain(cor?.text ?? '')}`, M, y)
    y += 12
    const resultColor: [number, number, number] = q.isCorrect
      ? [5, 150, 105]
      : q.selected
        ? [220, 38, 38]
        : [113, 113, 122]
    doc.setTextColor(...resultColor)
    doc.text(`Result: ${status}`, M, y)
    y += 16

    if (q.explanation) {
      doc.setTextColor(113, 113, 122)
      doc.setFontSize(8.5)
      const explLines = doc.splitTextToSize(`Explanation: ${plain(q.explanation)}`, contentW)
      doc.text(explLines, M, y)
      y += explLines.length * 11 + 8
    }
  }

  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const student = report.studentName !== 'Anonymous' ? `-${slug(report.studentName)}` : ''
  doc.save(`report-card-${slug(report.examTitle)}${student}.pdf`)
}
