// Quick test for grammar-parser.js
(async () => {
await import('./grammar-parser.js');
const gp = globalThis.grammarParser;

// ============================================================================
// BATCH 1: Core tests (trigonometry, algebra, basic functions)
// ============================================================================
const coreTests = [
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

// ============================================================================
// SET THEORY (E-Math: Sets & Venn Diagrams)
// ============================================================================
const setTheoryTests = [
  // Unicode symbols
  ['A ∪ B',           null],  // A \cup B
  ['A ∩ B',           null],  // A \cap B
  ['x ∈ A',           null],  // x \in A
  ['∅',               '\\emptyset'],
  ['A ⊂ B',           null],  // A \subset B
  ['A ⊆ B',           null],  // A \subseteq B
  ['x ∉ B',           null],  // x \notin B
  // Text keywords
  ['A union B',       null],  // A \cup B
  ['A cap B',         null],  // A \cap B
  ['emptyset',        '\\emptyset'],
  ['A subset B',      null],  // A \subset B
  // LaTeX commands
  ['\\cup',           null],
  ['\\cap',           null],
  ['\\emptyset',      '\\emptyset'],
  ['\\in',            null],
  ['\\subset',        null],
];

// ============================================================================
// VECTORS (E-Math & A-Math: Vectors in 2D)
// ============================================================================
const vectorTests = [
  ['vec(a)',          '\\vec{a}'],
  ['vec a',           '\\vec{a}'],
  ['\\vec{a}',        '\\vec{a}'],
  ['hat(i)',          '\\hat{i}'],
  ['bar(x)',          '\\bar{x}'],
  ['overline(AB)',    null],  // \overline{AB}
  ['vector a',        '\\vec{a}'],
];

// ============================================================================
// COMBINATORICS & PROBABILITY (E-Math: Probability, A-Math: Binomial Theorem)
// ============================================================================
const combinatoricsTests = [
  ['binom(n, r)',     '\\binom{n}{r}'],
  ['binom(5, 3)',     '\\binom{5}{3}'],
  ['\\binom{n}{k}',   null],  // should parse via LaTeX
  ['n!',              'n!'],
  ['10!',             '10!'],
  // nCr pattern detected via ambiguity resolver
  ['5C3',             null],  // parses as 5·C·3, ambiguity offers \binom{5}{3}
  ['nPr',             null],  // parses as n·P·r, ambiguity offers nPr
];

// ============================================================================
// CALCULUS (A-Math: Differentiation & Integration)
// ============================================================================
const calculusTests = [
  // Derivatives — dy/dx is naturally parsed as a fraction
  ['dy/dx',           '\\frac{dy}{dx}'],
  ['d/dx',            null],  // \frac{d}{dx}
  // Higher order derivatives
  ['d^2y/dx^2',       null],  // check it parses
  // Integration (int is already a known function)
  ['\\int',           null],
  ['∫',               null],  // Unicode integral
  // Partial derivative
  ['\\partial',       null],
  ['∂',               null],  // Unicode partial
  // Keyword
  ['integral',        null],  // maps to 'int' function
];

// ============================================================================
// STATISTICS (E-Math: Statistics)
// ============================================================================
const statisticsTests = [
  ['bar(x)',          '\\bar{x}'],
  ['mean x',          '\\bar{x}'],
  ['overline(x)',     '\\overline{x}'],
  ['sigma',           '\\sigma'],
  ['mu',              '\\mu'],
];

// ============================================================================
// ADDITIONAL SYMBOLS & RELATIONS
// ============================================================================
const symbolTests = [
  // Plus-minus
  ['x ± 1',           null],  // x \pm 1
  ['±',               '\\pm'],
  // Approximate  
  ['≈',               '\\approx'],
  ['approx',          '\\approx'],
  // Arrows
  ['→',               '\\rightarrow'],
  ['⇒',               '\\implies'],
  ['⇔',               '\\iff'],
  // Logic
  ['forall',          '\\forall'],
  ['exists',          '\\exists'],
  ['∀',               '\\forall'],
  ['∃',               '\\exists'],
  // Proportional
  ['∝',               '\\propto'],
  ['propto',          '\\propto'],
];

// ============================================================================
// INDICES & SURDS (E-Math: Indices, Surds & Logarithms)
// ============================================================================
const indicesTests = [
  ['x^(1/2)',         null],  // x^{\frac{1}{2}}
  ['sqrt(2)',         '\\sqrt{2}'],
  ['cbrt(x)',         null],  // \sqrt[3]{x}
  ['x^(-1)',          null],  // x^{-1}
  ['2^10',            '2^{10}'],
  ['a^m * a^n',       null],  // a^{m} \cdot a^{n}
];

// ============================================================================
// QUADRATIC & POLYNOMIAL (E-Math & A-Math)
// ============================================================================
const algebraTests = [
  ['ax^2 + bx + c',   null],
  ['(-b ± sqrt(b^2 - 4ac)) / 2a', null],  // quadratic formula
  ['(x+1)(x-2)',      null],  // factored form
  ['x^2 - 5x + 6',    null],
];

// ============================================================================
// COORDINATE GEOMETRY (E-Math & A-Math)
// ============================================================================
const coordGeomTests = [
  ['y = mx + c',       null],  // straight line
  ['(y2-y1)/(x2-x1)',  null],  // gradient formula
  ['sqrt((x2-x1)^2 + (y2-y1)^2)', null],  // distance formula
];

// ============================================================================
// RUN ALL TESTS
// ============================================================================
const allTestSuites = [
  { name: 'Core (Trig/Algebra)',     tests: coreTests },
  { name: 'Set Theory',              tests: setTheoryTests },
  { name: 'Vectors',                 tests: vectorTests },
  { name: 'Combinatorics',           tests: combinatoricsTests },
  { name: 'Calculus',                tests: calculusTests },
  { name: 'Statistics',              tests: statisticsTests },
  { name: 'Symbols & Relations',     tests: symbolTests },
  { name: 'Indices & Surds',         tests: indicesTests },
  { name: 'Quadratic & Polynomial',  tests: algebraTests },
  { name: 'Coordinate Geometry',     tests: coordGeomTests },
];

let totalPassed = 0;
let totalFailed = 0;

console.log('Grammar Parser — O-Level Topics Test Suite\n');

for (const suite of allTestSuites) {
  let passed = 0;
  let failed = 0;

  console.log(`\n${'='.repeat(70)}`);
  console.log(` ${suite.name}`);
  console.log(`${'='.repeat(70)}`);
  console.log('INPUT'.padEnd(35), 'LATEX OUTPUT'.padEnd(35), 'STATUS');
  console.log('-'.repeat(80));

  for (const [input, expected] of suite.tests) {
    const result = gp.parseMath(input);
    const latex = result.error ? `ERROR: ${result.error}` : gp.astToLatex(result.ast);
    const ok = result.error ? false : (expected === null || latex === expected);

    const status = ok ? '✓' : `✗ expected: ${expected}`;
    console.log(input.padEnd(35), latex.substring(0, 35).padEnd(35), status);

    if (ok) passed++; else failed++;
  }

  console.log(`    → ${passed}/${suite.tests.length} passed`);
  totalPassed += passed;
  totalFailed += failed;
}

const totalTests = totalPassed + totalFailed;
console.log(`\n${'='.repeat(70)}`);
console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed out of ${totalTests} tests`);
console.log(`${'='.repeat(70)}`);

// ============================================================================
// AMBIGUITY RESOLVER TESTS
// ============================================================================
console.log('\n\n--- Ambiguity Resolver Tests ---\n');
await import('./ambiguity-resolver.js');
const ar = globalThis.ambiguityResolver;

const ambiguityTests = [
  { input: '5C3',   expect: /\\binom/,     desc: 'nCr → binomial' },
  { input: 'nPr',   expect: /P_/,          desc: 'nPr → permutation' },
  { input: 'sin30', expect: /\\circ/,       desc: 'sin30 → sin(30°)' },
  { input: 'x1',    expect: /x_\{1\}/,     desc: 'x1 → subscript x₁' },
];

for (const { input, expect, desc } of ambiguityTests) {
  const suggestions = ar.generateSuggestions(input, 10);
  const found = suggestions.some(s => expect.test(s));
  const status = found ? '✓' : '✗';
  console.log(`${status} ${desc}: "${input}" → [${suggestions.join(', ')}]`);
  if (found) totalPassed++; else totalFailed++;
}

console.log(`\nFINAL TOTAL: ${totalPassed} passed, ${totalFailed} failed`);

// ============================================================================
// AST EXAMPLES
// ============================================================================
console.log('\n--- AST Examples (new topics) ---\n');
for (const sample of ['A ∪ B', 'vec(a)', 'binom(5,3)', 'dy/dx', 'bar(x)', '5C3', 'x ± 1']) {
  const { ast, error } = gp.parseMath(sample);
  console.log(`"${sample}" → ${error ? 'ERROR: ' + error : gp.astToLatex(ast)}`);
}
console.log();
})();
