// Test for ambiguity-resolver.js
(async () => {
  await import('./grammar-parser.js');
  await import('./ambiguity-resolver.js');

  const resolver = globalThis.ambiguityResolver;

  const tests = [
    {
      input: 'sin2x',
      desc: 'Trig + implicit mul → sin(2x), sin²(x), sin(2)x',
      expectAtLeast: ['\\sin(2x)', '\\sin(2)x'],
    },
    {
      input: 'cos45',
      desc: 'Trig + common angle → cos(45°), cos(45)',
      expectAtLeast: ['\\cos(45^{\\circ})', '\\cos(45)'],
    },
    {
      input: 'tan60',
      desc: 'Trig + common angle → tan(60°), tan(60)',
      expectAtLeast: ['\\tan(60^{\\circ})'],
    },
    {
      input: 'sin30o',
      desc: 'Typed degree shorthand → sin(30°) without trailing o',
      expectAtLeast: ['\\sin(30^{\\circ})'],
      expectNotContains: ['\\sin(30)o', '\\sin(30^{\\circ})o'],
    },
    {
      input: 'e^2x',
      desc: 'Power trailing → e^{2}x, e^{2x}',
      expectAtLeast: ['e^{2x}'],
    },
    {
      input: 'sinpi/6',
      desc: 'Func division → sin(pi)/6, sin(pi/6)',
      expectAtLeast: ['\\sin(\\frac{\\pi}{6})'],
    },
    {
      input: 'x2',
      desc: 'Var+number → x², x₂, x·2',
      expectAtLeast: ['x^{2}', 'x_{2}'],
    },
    {
      input: 'log10(x)',
      desc: 'Log base → log₁₀(x), log(10x)',
      expectAtLeast: ['\\log(x)_{10}'],
    },
    {
      input: 'sin(x)',
      desc: 'Explicit parens → no ambiguity, just sin(x)',
      expectAtLeast: ['\\sin(x)'],
    },
    {
      input: 'cos30 + sin45',
      desc: 'Multiple trig → degree alternatives for both',
      expectAtLeast: [],
    },
    {
      input: '3x2',
      desc: 'Number-var-number → 3x², 3x₂, 3·x·2',
      expectAtLeast: [],
    },
    {
      input: 'x^(1/2)',
      desc: 'Fractional power → sqrt(x), x^{1/2}',
      expectAtLeast: ['\\sqrt{x}'],
    },
    {
      input: 'sin^2(x)',
      desc: 'Explicit power+parens → no ambiguity',
      expectAtLeast: ['\\sin^{2}(x)'],
    },
    {
      input: 'x^-2',
      desc: 'Negative exponent → x^{-2}',
      expectAtLeast: ['x^{-2}'],
    },
  ];

  let passed = 0;
  let failed = 0;

  console.log('Ambiguity Resolver — Batch 2 Tests\n');

  for (const test of tests) {
    const suggestions = resolver.generateSuggestions(test.input);
    const missing = test.expectAtLeast.filter(expected => {
      return !suggestions.some(s => s.replace(/\s/g, '') === expected.replace(/\s/g, ''));
    });
    const forbidden = (test.expectNotContains || []).filter(forbiddenPattern => {
      return suggestions.some(s => s.replace(/\s/g, '') === forbiddenPattern.replace(/\s/g, ''));
    });

    const ok = missing.length === 0 && forbidden.length === 0;
    const status = ok ? '✓' : '✗';

    console.log(`${status} ${test.input.padEnd(16)} → [${suggestions.length} suggestions]`);
    console.log(`  ${test.desc}`);
    suggestions.forEach((s, i) => console.log(`    ${i + 1}. ${s}`));

    if (!ok) {
      console.log(`  MISSING: ${missing.join(', ')}`);
      if (forbidden.length > 0) {
        console.log(`  FORBIDDEN FOUND: ${forbidden.join(', ')}`);
      }
      failed++;
    } else {
      passed++;
    }
    console.log();
  }

  console.log('─'.repeat(60));
  console.log(`${passed} passed, ${failed} failed out of ${tests.length} tests`);
})();
