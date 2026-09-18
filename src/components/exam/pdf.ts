'use client'

import type { AttemptReport } from './types'
import { formatDuration } from './types'

/**
 * Generates a clean, minimalist PDF report card with jsPDF + autotable.
 * Dynamic imports keep jsPDF out of the initial bundle.
 * Note: jsPDF core fonts are WinAnsi, so PDF text avoids glyphs like ✓/✗.
 */

const INK: [number, number, number] = [24, 24, 27]
const MUTED: [number, number, number] = [113, 113, 122]
const LINE: [number, number, number] = [228, 228, 231]
const GREEN: [number, number, number] = [5, 150, 105]
const RED: [number, number, number] = [220, 38, 38]
const SOFT_GREEN: [number, number, number] = [236, 253, 245]
const SOFT_RED: [number, number, number] = [254, 242, 242]

/**
 * Converts LaTeX math ($...$ / $$...$$) into readable plain text for the PDF.
 * jsPDF core fonts are WinAnsi, so output sticks to that charset: ¹²³ × ÷ ± · °
 * are available; other symbols and greek letters are spelled out (sqrt, pi, <=).
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

  // Superscripts: WinAnsi only has ¹²³, otherwise keep the ^ notation
  const SUP: Record<string, string> = { '1': '¹', '2': '²', '3': '³' }
  s = s
    .replace(/\^\{([^{}]+)\}/g, (_m, g: string) => (g.length === 1 && SUP[g]) || `^${g}`)
    .replace(/\^([0-9])(?![0-9])/g, (m, d: string) => SUP[d] ?? m)

  // Subscripts have no WinAnsi glyphs - flatten braces, keep _x notation
  s = s.replace(/_\{([^{}]+)\}/g, '_$1')

  // Strip leftover grouping braces and tidy whitespace
  s = s.replace(/[{}]/g, '').replace(/[ \t]+/g, ' ').replace(/ +([,.!?;:])/g, '$1').trim()
  return s
}

export async function downloadReportPdf(report: AttemptReport): Promise<void> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = autoTableMod.default

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
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

  // Score bar
  const barX = M + 110
  const barY = y + 40
  const barW = contentW - 130 - 150
  doc.setFillColor(...LINE)
  doc.roundedRect(barX, barY, barW, 8, 4, 4, 'F')
  doc.setFillColor(...(pct >= 50 ? GREEN : RED))
  if (pct > 0) doc.roundedRect(barX, barY, Math.max(8, (barW * pct) / 100), 8, 4, 4, 'F')

  // Right/wrong/skipped counts
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

  // ---------- Question table ----------
  type RowInput = string | number
  const body: RowInput[][] = report.questions.map((q) => {
    const sel = q.options.find((o) => o.key === q.selected)
    const cor = q.options.find((o) => o.key === q.correctAnswer)
    return [
      q.order,
      plain(q.text),
      q.selected ? `${q.selected}. ${plain(sel?.text ?? '')}` : 'Not answered',
      `${q.correctAnswer}. ${plain(cor?.text ?? '')}`,
      q.isCorrect ? 'Right' : q.selected ? 'Wrong' : 'Skipped',
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['#', 'Question', 'Your answer', 'Correct answer', 'Result']],
    body,
    margin: { left: M, right: M },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 6,
      textColor: INK,
      lineColor: LINE,
      lineWidth: 0.5,
      valign: 'middle',
    },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center', textColor: MUTED },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 118 },
      3: { cellWidth: 118 },
      4: { cellWidth: 52, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const raw = data.row.raw as unknown as Record<number, unknown> | undefined
      const result = String(raw?.[4] ?? '')
      const idx = data.column.index
      if (result === 'Right') {
        if (idx === 4) data.cell.styles.textColor = GREEN
        data.cell.styles.fillColor = SOFT_GREEN
      } else if (result === 'Wrong') {
        if (idx === 4) data.cell.styles.textColor = RED
        data.cell.styles.fillColor = SOFT_RED
      } else if (result === 'Skipped') {
        if (idx === 4) data.cell.styles.textColor = MUTED
      }
    },
  })

  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 30

  // ---------- Review section for wrong / skipped ----------
  const toReview = report.questions.filter((q) => !q.isCorrect)
  if (toReview.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 140) {
      doc.addPage()
      y = 56
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...INK)
    doc.text('Review - questions to revisit', M, y)
    y += 16

    for (const q of toReview) {
      const cor = q.options.find((o) => o.key === q.correctAnswer)
      const headLine = `Q${q.order}. ${plain(q.text)}`
      const headWrapped = doc.splitTextToSize(headLine, contentW)
      const detail = `Correct answer: ${q.correctAnswer}. ${plain(cor?.text ?? '')}${q.selected ? '' : '  (you left this blank)'}`
      const expl = q.explanation ? doc.splitTextToSize(`Explanation: ${plain(q.explanation)}`, contentW) : []

      const blockH = headWrapped.length * 13 + 13 + expl.length * 11 + 14
      if (y + blockH > doc.internal.pageSize.getHeight() - 56) {
        doc.addPage()
        y = 56
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...INK)
      doc.text(headWrapped, M, y)
      y += headWrapped.length * 13

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...GREEN)
      doc.text(detail, M, y)
      y += 13

      if (expl.length > 0) {
        doc.setFontSize(8.5)
        doc.setTextColor(...MUTED)
        doc.text(expl, M, y)
        y += expl.length * 11
      }
      y += 14
    }
  }

  // ---------- Footer on every page ----------
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    const H = doc.internal.pageSize.getHeight()
    doc.setDrawColor(...LINE)
    doc.setLineWidth(1)
    doc.line(M, H - 44, W - M, H - 44)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text("Generated by Noel's Test - instant report cards for every test", M, H - 30)
    doc.text(`${p} / ${pages}`, W - M, H - 30, { align: 'right' })
  }

  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const student = report.studentName !== 'Anonymous' ? `-${slug(report.studentName)}` : ''
  doc.save(`report-card-${slug(report.examTitle)}${student}.pdf`)
}
