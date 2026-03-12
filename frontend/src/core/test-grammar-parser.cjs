// Quick test for grammar-parser.js
(async () => {
await import('./grammar-parser.js');
const gp = globalThis.grammarParser;

const tests = [
  ['sin2x',           '\\sin(2)x'],
  ['cos(30)',         '\\cos(30)'],
  ['log10(x)',        null],  // just check it parses
  ['2x + 3',          null],
  ['x^2 + y^2',       'x^{2} + y^{2}'],
  ['sinpi/6',         null],
  ['sqrt(x+1)',        '\\sqrt{x + 1}'],
  ['3xy',             '3xy'],
  ['e^2x',            null],
  ['45degree',        '45^{\\circ}'],
  ['1/2',             '\\frac{1}{2}'],
  ['sin(x) + cos(x)', '\\sin(x) + \\cos(x)'],
  ['ln(e)',           null],
  ['tan^{-1}(x)',     null],
  ['|x+1|',          '\\left|x + 1\\right|'],
  ['5!',              '5!'],
  ['\\pi',            '\\pi'],
  ['\\sin(\\theta)',   null],
  ['2x3',             null],
  ['cosecx',          null],
];

let passed = 0;
let failed = 0;

console.log('Grammar Parser — Batch 1 Tests\n');
console.log('INPUT'.padEnd(22), 'LATEX OUTPUT'.padEnd(35), 'STATUS');
console.log('-'.repeat(75));

for (const [input, expected] of tests) {
  const result = gp.parseMath(input);
  const latex = result.error ? `ERROR: ${result.error}` : gp.astToLatex(result.ast);
  const ok = result.error ? false : (expected === null || latex === expected);

  const status = ok ? '✓' : `✗ expected: ${expected}`;
  console.log(input.padEnd(22), latex.padEnd(35), status);

  if (ok) passed++; else failed++;
}

console.log('-'.repeat(75));
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length} tests`);

// Also show AST for a couple of examples so you can see the tree structure
console.log('\n--- AST Examples ---\n');
for (const sample of ['sin2x', 'x^2 + y^2', 'log10(x)', '3xy']) {
  const { ast } = gp.parseMath(sample);
  console.log(`"${sample}" →`);
  console.log(JSON.stringify(ast, null, 2));
  console.log();
}
})();
