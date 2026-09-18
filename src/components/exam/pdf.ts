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
 * Generates a polished PDF report card with jsPDF.
 *
 * Design:
 * - Dark header band with "REPORT CARD" title
 * - Score ring chart (drawn with jsPDF arcs)
 * - Card-based question layout (not a table) with colored left borders
 * - Color-coded results: green (right), red (wrong), amber (skipped)
 * - Math rendered as real equations via MathJax SVG → PNG (pdf-math.ts)
 *
 * Fallback: if math rendering fails, falls back to plain-text LaTeX stripping.
 * Last resort: if the entire pipeline crashes, generates a text-only PDF.
 */

// ── Colors ──────────────────────────────────────────────────────────────────
const INK: [number, number, number] = [24, 24, 27]         // zinc-900
const MUTED: [number, number, number] = [113, 113, 122]     // zinc-500
const LIGHT: [number, number, number] = [161, 161, 170]     // zinc-400
const LINE: [number, number, number] = [228, 228, 231]      // zinc-200
const BG: [number, number, number] = [250, 250, 250]        // zinc-50
const WHITE: [number, number, number] = [255, 255, 255]
const GREEN: [number, number, number] = [5, 150, 105]       // emerald-600
const GREEN_BG: [number, number, number] = [236, 253, 245]  // emerald-50
const RED: [number, number, number] = [220, 38, 38]         // red-600
const RED_BG: [number, number, number] = [254, 242, 242]    // red-50
const AMBER: [number, number, number] = [217, 119, 6]       // amber-600
const AMBER_BG: [number, number, number] = [255, 251, 235]  // amber-50
const DARK: [number, number, number] = [30, 30, 35]         // near-black for header

// ── Plain text fallback ─────────────────────────────────────────────────────

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
    [/\\(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|nu|rho|sigma|tau|phi|omega)\b/g, '$1'],
    [/\\(Alpha|Beta|Gamma|Delta|Theta|Lambda|Sigma|Omega)\b/g, '$1'],
    [/\\pi\b/g, 'pi'],
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

// ── Types ───────────────────────────────────────────────────────────────────

interface QuestionCard {
  order: number
  isCorrect: boolean
  selected: string
  questionImg: RenderedImage | null
  questionText: string
  yourAnswerImg: RenderedImage | null
  yourAnswerText: string
  correctAnswerImg: RenderedImage | null
  correctAnswerText: string
  explanationImg: RenderedImage | null
  explanationText: string
  resultLabel: 'Right' | 'Wrong' | 'Skipped'
}

// ── Main entry ──────────────────────────────────────────────────────────────

export async function downloadReportPdf(report: AttemptReport): Promise<void> {
  try {
    await downloadReportPdfInternal(report)
  } catch (err) {
    console.error('PDF generation failed, falling back to text-only:', err)
    await downloadReportPdfFallback(report)
  }
}

async function downloadReportPdfInternal(report: AttemptReport): Promise<void> {
  clearMathRenderCache()
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 42
  const contentW = W - M * 2

  // ── Dark header band ────────────────────────────────────────────────────
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 72, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...WHITE)
  doc.text('REPORT CARD', M, 36)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(160, 160, 170)
  doc.text("Noel's Test — instant report cards for every test", M, 54)

  doc.setFontSize(9)
  doc.setTextColor(160, 160, 170)
  doc.text(new Date().toLocaleDateString(), W - M, 36, { align: 'right' })
  doc.text(`${report.questions.length} questions`, W - M, 54, { align: 'right' })

  let y = 72 + 28

  // ── Exam title + meta ───────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...INK)
  const titleLines = doc.splitTextToSize(plain(report.examTitle), contentW)
  doc.text(titleLines, M, y)
  y += titleLines.length * 24 + 4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  const metaBits = [
    report.studentName !== 'Anonymous' ? report.studentName : null,
    new Date(report.createdAt).toLocaleString(),
    report.timeSpentSeconds != null ? `Time used ${formatDuration(report.timeSpentSeconds)}` : null,
    report.autoSubmitted ? 'Auto-submitted (time expired)' : null,
  ].filter(Boolean) as string[]
  doc.text(metaBits.join('   ·   '), M, y)
  y += 28

  // ── Score section with ring chart ───────────────────────────────────────
  const pct = report.total > 0 ? Math.round((report.score / report.total) * 100) : 0
  const correctCount = report.questions.filter((q) => q.isCorrect).length
  const skippedCount = report.questions.filter((q) => !q.selected).length
  const wrongCount = report.total - correctCount - skippedCount
  const ringColor = pct >= 50 ? GREEN : RED

  const scoreBoxH = 100
  doc.setFillColor(...BG)
  doc.roundedRect(M, y, contentW, scoreBoxH, 8, 8, 'F')

  // Ring chart (left side)
  const ringCx = M + 55
  const ringCy = y + scoreBoxH / 2
  const ringR = 32

  // Background ring
  doc.setDrawColor(...LINE)
  doc.setLineWidth(6)
  doc.circle(ringCx, ringCy, ringR, 'S')

  // Score arc — draw as series of small segments (jsPDF doesn't have arc)
  if (pct > 0) {
    doc.setDrawColor(...ringColor)
    doc.setLineWidth(6)
    const segments = Math.ceil((pct / 100) * 60) // 60 segments for full circle
    for (let i = 0; i < segments; i++) {
      const angle = (i / 60) * 2 * Math.PI - Math.PI / 2
      const nextAngle = ((i + 1) / 60) * 2 * Math.PI - Math.PI / 2
      const x1 = ringCx + Math.cos(angle) * ringR
      const y1 = ringCy + Math.sin(angle) * ringR
      const x2 = ringCx + Math.cos(nextAngle) * ringR
      const y2 = ringCy + Math.sin(nextAngle) * ringR
      doc.line(x1, y1, x2, y2)
    }
  }

  // Percentage text in center
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...INK)
  doc.text(`${pct}%`, ringCx, ringCy + 6, { align: 'center' })

  // Score breakdown (right of ring)
  const breakdownX = M + 120
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...INK)
  doc.text(`${report.score} / ${report.total}`, breakdownX, y + 32)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text('correct', breakdownX, y + 46)

  // Stat badges
  const badgeY = y + 62
  const badgeH = 24
  const badgeW = 70
  const badgeGap = 8

  // Right badge
  drawStatBadge(doc, breakdownX, badgeY, badgeW, badgeH, 'Right', correctCount, GREEN, GREEN_BG)
  // Wrong badge
  drawStatBadge(doc, breakdownX + badgeW + badgeGap, badgeY, badgeW, badgeH, 'Wrong', wrongCount, RED, RED_BG)
  // Skipped badge
  drawStatBadge(doc, breakdownX + (badgeW + badgeGap) * 2, badgeY, badgeW, badgeH, 'Skipped', skippedCount, AMBER, AMBER_BG)

  y += scoreBoxH + 28

  // ── Pre-render all math images ──────────────────────────────────────────
  const cardWidth = contentW
  const questionTextW = cardWidth - 56 // padding inside card
  const answerW = (cardWidth - 56 - 16) / 2 // two columns with gap

  const renderItems = report.questions.map((q) => {
    const sel = q.options.find((o) => o.key === q.selected)
    const cor = q.options.find((o) => o.key === q.correctAnswer)
    const yourAnswerText = q.selected ? `${q.selected}. ${sel?.text ?? ''}` : 'Not answered'
    const correctAnswerText = `${q.correctAnswer}. ${cor?.text ?? ''}`
    return { q, sel, cor, yourAnswerText, correctAnswerText }
  })

  const [questionImgs, yourAnswerImgs, correctAnswerImgs, explanationImgs] = await Promise.all([
    renderBatch(
      renderItems.map((r) =>
        hasMath(r.q.text)
          ? { text: r.q.text, options: { fontSizePt: 10, color: INK, maxWidthPt: questionTextW, paddingPx: 3, lineHeight: 1.5 } }
          : null
      )
    ),
    renderBatch(
      renderItems.map((r) =>
        r.q.selected && hasMath(r.yourAnswerText)
          ? { text: r.yourAnswerText, options: { fontSizePt: 9, color: INK, maxWidthPt: answerW - 16, paddingPx: 3, lineHeight: 1.4 } }
          : null
      )
    ),
    renderBatch(
      renderItems.map((r) =>
        hasMath(r.correctAnswerText)
          ? { text: r.correctAnswerText, options: { fontSizePt: 9, color: GREEN, maxWidthPt: answerW - 16, paddingPx: 3, lineHeight: 1.4 } }
          : null
      )
    ),
    renderBatch(
      renderItems.map((r) =>
        r.q.explanation && hasMath(r.q.explanation)
          ? { text: r.q.explanation, options: { fontSizePt: 8.5, color: MUTED, maxWidthPt: questionTextW - 24, paddingPx: 3, lineHeight: 1.4 } }
          : null
      )
    ),
  ])

  const cards: QuestionCard[] = renderItems.map((r, i) => ({
    order: r.q.order,
    isCorrect: r.q.isCorrect,
    selected: r.q.selected,
    questionImg: questionImgs[i] ?? null,
    questionText: r.q.text,
    yourAnswerImg: yourAnswerImgs[i] ?? null,
    yourAnswerText: r.yourAnswerText,
    correctAnswerImg: correctAnswerImgs[i] ?? null,
    correctAnswerText: r.correctAnswerText,
    explanationImg: explanationImgs[i] ?? null,
    explanationText: r.q.explanation ?? '',
    resultLabel: r.q.isCorrect ? 'Right' : r.q.selected ? 'Wrong' : 'Skipped',
  }))

  // ── Section header ──────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text('Question by question', M, y)
  y += 8

  // ── Draw question cards ─────────────────────────────────────────────────
  for (const card of cards) {
    y = drawQuestionCard(doc, card, y, M, contentW, H, questionTextW, answerW)
    y += 12
  }

  // ── Footer on every page ────────────────────────────────────────────────
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.5)
    doc.line(M, H - 36, W - M, H - 36)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...LIGHT)
    doc.text("Generated by Noel's Test", M, H - 22)
    doc.text(`Page ${p} of ${pages}`, W - M, H - 22, { align: 'right' })
  }

  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const student = report.studentName !== 'Anonymous' ? `-${slug(report.studentName)}` : ''
  doc.save(`report-card-${slug(report.examTitle)}${student}.pdf`)
}

// ── Helper: draw a stat badge ───────────────────────────────────────────────

function drawStatBadge(
  doc: import('jspdf').jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  count: number,
  color: [number, number, number],
  bgColor: [number, number, number]
): void {
  doc.setFillColor(...bgColor)
  doc.roundedRect(x, y, w, h, 4, 4, 'F')
  doc.setDrawColor(...color)
  doc.setLineWidth(0.5)
  doc.roundedRect(x, y, w, h, 4, 4, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...color)
  doc.text(String(count), x + 8, y + 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text(label, x + 8, y + 22)
}

// ── Helper: draw a question card ────────────────────────────────────────────

function drawQuestionCard(
  doc: import('jspdf').jsPDF,
  card: QuestionCard,
  startY: number,
  marginX: number,
  contentW: number,
  pageH: number,
  questionTextW: number,
  answerW: number
): number {
  const padX = 14
  const padY = 12
  const cardW = contentW

  // Determine colors based on result
  const borderColor =
    card.resultLabel === 'Right' ? GREEN : card.resultLabel === 'Wrong' ? RED : AMBER
  const bgColor =
    card.resultLabel === 'Right' ? GREEN_BG : card.resultLabel === 'Wrong' ? RED_BG : AMBER_BG

  // Calculate card height
  const qH = card.questionImg
    ? card.questionImg.heightPt + 8
    : estimateTextHeight(doc, plain(card.questionText), questionTextW, 10, 14)
  const aH = Math.max(
    card.yourAnswerImg ? card.yourAnswerImg.heightPt : estimateTextHeight(doc, card.selected ? plain(card.yourAnswerText) : 'Not answered', answerW - 16, 9, 13),
    card.correctAnswerImg ? card.correctAnswerImg.heightPt : estimateTextHeight(doc, plain(card.correctAnswerText), answerW - 16, 9, 13)
  )
  const explH = card.explanationImg
    ? card.explanationImg.heightPt + 8
    : card.explanationText
      ? estimateTextHeight(doc, plain(card.explanationText), questionTextW - 24, 8.5, 12) + 8
      : 0

  const cardH = padY + qH + 10 + aH + (explH > 0 ? explH + 8 : 0) + padY

  // Page break if needed
  let y = startY
  if (y + cardH > pageH - 50) {
    doc.addPage()
    y = 56
  }

  // Card background
  doc.setFillColor(...WHITE)
  doc.roundedRect(marginX, y, cardW, cardH, 6, 6, 'F')

  // Colored left border (4px wide)
  doc.setFillColor(...borderColor)
  doc.roundedRect(marginX, y, 4, cardH, 2, 2, 'F')

  // Card outline (subtle)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.5)
  doc.roundedRect(marginX, y, cardW, cardH, 6, 6, 'S')

  // ── Result badge (top-right) ────────────────────────────────────────────
  const badgeW = 52
  const badgeH = 18
  const badgeX = marginX + cardW - badgeW - padX
  const badgeY = y + padY - 4
  doc.setFillColor(...bgColor)
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 9, 9, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...borderColor)
  doc.text(card.resultLabel, badgeX + badgeW / 2, badgeY + 12, { align: 'center' })

  // ── Question number + text ──────────────────────────────────────────────
  const innerX = marginX + padX + 4 // +4 for the colored border
  const innerW = cardW - padX * 2 - 4

  let cy = y + padY + 4

  // Q number
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...LIGHT)
  doc.text(`Q${card.order}`, innerX, cy + 10)

  // Question text (image or native text)
  const qTextX = innerX + 24
  const qTextW = innerW - 24 - badgeW
  if (card.questionImg) {
    doc.addImage(card.questionImg.dataUrl, 'PNG', qTextX, cy, card.questionImg.widthPt, card.questionImg.heightPt)
    cy += card.questionImg.heightPt + 4
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...INK)
    const qLines = doc.splitTextToSize(plain(card.questionText), qTextW)
    doc.text(qLines, qTextX, cy + 9)
    cy += qLines.length * 14
  }

  cy += 8

  // ── Answer columns ──────────────────────────────────────────────────────
  const colH = Math.max(
    card.yourAnswerImg ? card.yourAnswerImg.heightPt : 16,
    card.correctAnswerImg ? card.correctAnswerImg.heightPt : 16,
    16
  )

  // "Your answer" column
  const yourX = innerX
  const yourW = answerW
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text('YOUR ANSWER', yourX, cy + 8)

  if (card.yourAnswerImg) {
    doc.addImage(card.yourAnswerImg.dataUrl, 'PNG', yourX, cy + 12, card.yourAnswerImg.widthPt, card.yourAnswerImg.heightPt)
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const answerColor = card.isCorrect ? GREEN : card.selected ? RED : MUTED
    doc.setTextColor(...answerColor)
    const aLines = doc.splitTextToSize(
      card.selected ? plain(card.yourAnswerText) : 'Not answered',
      yourW - 16
    )
    doc.text(aLines, yourX, cy + 22)
  }

  // "Correct answer" column
  const corX = innerX + yourW + 16
  const corW = answerW
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text('CORRECT ANSWER', corX, cy + 8)

  if (card.correctAnswerImg) {
    doc.addImage(card.correctAnswerImg.dataUrl, 'PNG', corX, cy + 12, card.correctAnswerImg.widthPt, card.correctAnswerImg.heightPt)
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GREEN)
    const cLines = doc.splitTextToSize(plain(card.correctAnswerText), corW - 16)
    doc.text(cLines, corX, cy + 22)
  }

  cy += colH + 16

  // ── Explanation (if present) ─────────────────────────────────────────────
  if (card.explanationText || card.explanationImg) {
    const explY = cy
    const explH2 = card.explanationImg
      ? card.explanationImg.heightPt + 8
      : estimateTextHeight(doc, plain(card.explanationText), questionTextW - 24, 8.5, 12) + 8

    doc.setFillColor(...BG)
    doc.roundedRect(innerX, explY, innerW, explH2 + 8, 4, 4, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text('EXPLANATION', innerX + 8, explY + 12)

    if (card.explanationImg) {
      doc.addImage(card.explanationImg.dataUrl, 'PNG', innerX + 8, explY + 16, card.explanationImg.widthPt, card.explanationImg.heightPt)
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...MUTED)
      const eLines = doc.splitTextToSize(plain(card.explanationText), innerW - 16)
      doc.text(eLines, innerX + 8, explY + 22)
    }
  }

  return y + cardH
}

// ── Helper: estimate text height ────────────────────────────────────────────

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

// ── Last-resort text-only fallback ──────────────────────────────────────────

async function downloadReportPdfFallback(report: AttemptReport): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 48
  const contentW = W - M * 2

  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 72, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...WHITE)
  doc.text('REPORT CARD', M, 36)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(160, 160, 170)
  doc.text('Text-only fallback (math rendering unavailable)', M, 54)

  let y = 100
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...INK)
  doc.text(plain(report.examTitle), M, y)
  y += 24

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...MUTED)
  const pct = report.total > 0 ? Math.round((report.score / report.total) * 100) : 0
  doc.text(`Score: ${report.score}/${report.total} (${pct}%)`, M, y)
  y += 24

  for (const q of report.questions) {
    if (y > H - 80) { doc.addPage(); y = 56 }
    const sel = q.options.find((o) => o.key === q.selected)
    const cor = q.options.find((o) => o.key === q.correctAnswer)
    const status = q.isCorrect ? 'Right' : q.selected ? 'Wrong' : 'Skipped'

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...INK)
    doc.text(`Q${q.order}. ${plain(q.text)}`, M, y); y += 14

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(`Your answer: ${q.selected ? `${q.selected}. ${plain(sel?.text ?? '')}` : 'Not answered'}`, M, y); y += 12
    doc.text(`Correct: ${q.correctAnswer}. ${plain(cor?.text ?? '')}`, M, y); y += 12
    doc.setTextColor(...(q.isCorrect ? GREEN : q.selected ? RED : MUTED))
    doc.text(`Result: ${status}`, M, y); y += 16

    if (q.explanation) {
      doc.setTextColor(...MUTED); doc.setFontSize(8.5)
      const lines = doc.splitTextToSize(`Explanation: ${plain(q.explanation)}`, contentW)
      doc.text(lines, M, y); y += lines.length * 11 + 8
    }
  }

  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const student = report.studentName !== 'Anonymous' ? `-${slug(report.studentName)}` : ''
  doc.save(`report-card-${slug(report.examTitle)}${student}.pdf`)
}
