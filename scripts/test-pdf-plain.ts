/**
 * Quick sanity test for the PDF plain() LaTeX converter.
 * Mirrors the implementation in src/components/exam/pdf.ts (kept in sync manually).
 * Run: bun /home/z/my-project/scripts/test-pdf-plain.ts
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

const cases: Array<[string, string]> = [
  ['$x^2 + y^2 = z^2$', 'x² + y² = z²'],
  ['$\\frac{1}{2}$ of the pizza', '(1)/(2) of the pizza'],
  ['Area = $\\pi r^2$', 'Area = pi r²'],
  ['$\\sqrt{49} = 7$', 'sqrt(49) = 7'],
  ['$a \\leq 5$ and $b \\geq 3$', 'a <= 5 and b >= 3'],
  ['$3 \\times 4 \\div 2$', '3 × 4 ÷ 2'],
  ['$x^{10} + 2^{n}$', 'x^10 + 2^n'],
  ['$H_{2}O$', 'H_2O'],
  ['90^{\\circ} angle', '90° angle'],
  ['$\\alpha, \\beta, \\Delta$', 'alpha, beta, Delta'],
  ['$$\\frac{a}{b}$$ display', '(a)/(b) display'],
  ['$5 \\pm \\sqrt{x}$', '5 ± sqrt(x)'],
  ['no math here at all', 'no math here at all'],
  ['$x^2$ vs $x^{10}$ vs $x^n$', 'x² vs x^10 vs x^n'],
  ['$10^{23}$', '10^23'],
]

let failed = 0
for (const [input, expected] of cases) {
  const got = plain(input)
  if (got !== expected) {
    failed++
    console.log(`FAIL  in: ${input}\n      expected: ${expected}\n      got:      ${got}`)
  } else {
    console.log(`ok    ${input}  ->  ${got}`)
  }
}
console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`)
process.exit(failed === 0 ? 0 : 1)
