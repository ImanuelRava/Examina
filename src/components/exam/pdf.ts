'use client'

import type { AttemptReport } from './types'
import { formatDuration } from './types'

/**
 * Generates a clean, simple PDF report card.
 *
 * Design: dark header band → score summary → table of per-question results
 * (just question number + Right/Wrong/Skipped). No question text, no math,
 * no explanations — just the bottom line.
 */

const INK: [number, number, number] = [24, 24, 27]
const MUTED: [number, number, number] = [113, 113, 122]
const LIGHT: [number, number, number] = [161, 161, 170]
const LINE: [number, number, number] = [228, 228, 231]
const BG: [number, number, number] = [250, 250, 250]
const WHITE: [number, number, number] = [255, 255, 255]
const GREEN: [number, number, number] = [5, 150, 105]
const GREEN_BG: [number, number, number] = [236, 253, 245]
const RED: [number, number, number] = [220, 38, 38]
const RED_BG: [number, number, number] = [254, 242, 242]
const AMBER: [number, number, number] = [217, 119, 6]
const AMBER_BG: [number, number, number] = [255, 251, 235]
const DARK: [number, number, number] = [30, 30, 35]

export async function downloadReportPdf(report: AttemptReport): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 42
  const contentW = W - M * 2

  // ── Dark header band ─────────────────────────────────────────────────────
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 72, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...WHITE)
  doc.text('REPORT CARD', M, 36)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(160, 160, 170)
  doc.text("Noel's Test", M, 54)

  doc.setFontSize(9)
  doc.setTextColor(160, 160, 170)
  doc.text(new Date().toLocaleDateString(), W - M, 36, { align: 'right' })

  let y = 72 + 28

  // ── Exam title + meta ────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...INK)
  const titleLines = doc.splitTextToSize(report.examTitle, contentW)
  doc.text(titleLines, M, y)
  y += titleLines.length * 24 + 4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  const metaBits = [
    report.studentName !== 'Anonymous' ? report.studentName : null,
    new Date(report.createdAt).toLocaleString(),
    report.timeSpentSeconds != null ? `Time ${formatDuration(report.timeSpentSeconds)}` : null,
    report.autoSubmitted ? 'Auto-submitted' : null,
  ].filter(Boolean) as string[]
  doc.text(metaBits.join('   ·   '), M, y)
  y += 28

  // ── Score summary box ────────────────────────────────────────────────────
  const pct = report.total > 0 ? Math.round((report.score / report.total) * 100) : 0
  const correctCount = report.questions.filter((q) => q.isCorrect).length
  const skippedCount = report.questions.filter((q) => !q.selected).length
  const wrongCount = report.total - correctCount - skippedCount
  const ringColor = pct >= 50 ? GREEN : RED

  const scoreBoxH = 76
  doc.setFillColor(...BG)
  doc.roundedRect(M, y, contentW, scoreBoxH, 8, 8, 'F')

  // Big score (left)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(...INK)
  doc.text(`${pct}%`, M + 20, y + 38)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text(`${report.score} of ${report.total} correct`, M + 20, y + 56)

  // Stat badges (right) — 3 across
  const badgeY = y + 22
  const badgeH = 32
  const badgeW = 90
  const badgeGap = 10
  const badgesStart = M + contentW - (badgeW * 3 + badgeGap * 2)

  drawStatBadge(doc, badgesStart, badgeY, badgeW, badgeH, 'Right', correctCount, GREEN, GREEN_BG)
  drawStatBadge(doc, badgesStart + badgeW + badgeGap, badgeY, badgeW, badgeH, 'Wrong', wrongCount, RED, RED_BG)
  drawStatBadge(doc, badgesStart + (badgeW + badgeGap) * 2, badgeY, badgeW, badgeH, 'Skipped', skippedCount, AMBER, AMBER_BG)

  y += scoreBoxH + 28

  // ── Results table ────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text('Results', M, y)
  y += 12

  // Table header
  const colW = {
    num: 60,
    result: 120,
    answer: 80,
  }
  const tableW = colW.num + colW.result + colW.answer
  const headerH = 26

  doc.setFillColor(...INK)
  doc.rect(M, y, tableW, headerH, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...WHITE)
  doc.text('QUESTION', M + 12, y + 17)
  doc.text('RESULT', M + colW.num + 12, y + 17)
  doc.text('YOUR ANSWER', M + colW.num + colW.result + 12, y + 17)
  y += headerH

  // Body rows
  const rowH = 28
  for (let i = 0; i < report.questions.length; i++) {
    const q = report.questions[i]
    const result = q.isCorrect ? 'Right' : q.selected ? 'Wrong' : 'Skipped'
    const color = q.isCorrect ? GREEN : q.selected ? RED : AMBER
    const bgColor = q.isCorrect ? GREEN_BG : q.selected ? RED_BG : AMBER_BG

    // Page break
    if (y + rowH > H - 50) {
      doc.addPage()
      y = 56
      // Re-draw header on new page
      doc.setFillColor(...INK)
      doc.rect(M, y, tableW, headerH, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...WHITE)
      doc.text('QUESTION', M + 12, y + 17)
      doc.text('RESULT', M + colW.num + 12, y + 17)
      doc.text('YOUR ANSWER', M + colW.num + colW.result + 12, y + 17)
      y += headerH
    }

    // Alternating row background
    if (i % 2 === 0) {
      doc.setFillColor(...WHITE)
    } else {
      doc.setFillColor(...BG)
    }
    doc.rect(M, y, tableW, rowH, 'F')

    // Borders
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.5)
    doc.rect(M, y, tableW, rowH, 'S')
    doc.line(M + colW.num, y, M + colW.num, y + rowH)
    doc.line(M + colW.num + colW.result, y, M + colW.num + colW.result, y + rowH)

    // Question number
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...INK)
    doc.text(`Q${q.order}`, M + 12, y + 18)

    // Result with colored pill
    const pillW = 60
    const pillH = 18
    const pillX = M + colW.num + 12
    const pillY = y + (rowH - pillH) / 2
    doc.setFillColor(...bgColor)
    doc.roundedRect(pillX, pillY, pillW, pillH, 9, 9, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...color)
    doc.text(result, pillX + pillW / 2, pillY + 12, { align: 'center' })

    // Your answer letter (or "—")
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...(q.isCorrect ? GREEN : q.selected ? RED : MUTED))
    const ansText = q.selected || '—'
    doc.text(ansText, M + colW.num + colW.result + 12, y + 18)

    y += rowH
  }

  // ── Footer on every page ─────────────────────────────────────────────────
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
  doc.roundedRect(x, y, w, h, 6, 6, 'F')
  doc.setDrawColor(...color)
  doc.setLineWidth(0.5)
  doc.roundedRect(x, y, w, h, 6, 6, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...color)
  doc.text(String(count), x + 10, y + 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(label, x + 10, y + 28)
}
