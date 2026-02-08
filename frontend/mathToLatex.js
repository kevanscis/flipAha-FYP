// mathToLatex-vanilla.js - Vanilla JavaScript version
// This file converts common math notation to LaTeX

const RULES = [
  // Logarithms (specific -> general) - LaTeX versions
  // Most specific patterns first, wildcards last
  ["\\ln(%)", "\\ln($1)"],
  ["\\ln (%)", "\\ln($1)"],
  ["\\ln(%", "\\ln($1)"],
  ["\\ln %", "\\ln($1)"],
  ["\\ln", "\\ln(x)"],
  
  ["\\log(%,%)", "\\log_{$1}($2)"],
  ["\\log_%(%)", "\\log_{$1}($2)"],
  
  // Handle log base specifically (e.g. \log_{10})
  ["\\log_{%}", ["\\log_{$1}(x)", "\\log($1)"]],
  ["\\log_%", ["\\log_{$1}(x)", "\\log($1)"]],

  ["\\log(%)", ["\\log($1)", "\\log_{10}($1)"]],
  ["\\log (%)", ["\\log($1)", "\\log_{10}($1)"]],
  ["\\log(%", ["\\log($1)", "\\log_{10}($1)"]],
  ["\\log%(%)", "\\log_{$1}($2)"],
  ["\\log%(%", "\\log_{$1}($2)"],
  ["\\log %", ["\\log($1)", "\\log_{10}($1)"]],
  ["\\log", ["\\log(x)", "\\log_{10}(x)", "\\ln(x)"]],

  // Plain text versions (fallback for non-LaTeX input)
  ["ln(%)", "\\ln($1)"],
  ["ln (%)", "\\ln($1)"],
  ["ln", "\\ln(x)"],
  ["ln(%", "\\ln($1)"],
  ["ln%", ["\\ln(x)", "\\ln($1)"]],
  ["ln %", ["\\ln(x)", "\\ln($1)"]],

  ["loge %", "\\ln($1)"],
  ["loge(%)", "\\ln($1)"],
  ["log_e(%)", "\\ln($1)"],
  ["log e(%)", "\\ln($1)"],

  ["lg(%)", "\\log_{10}($1)"],
  ["lg (%)", "\\log_{10}($1)"],
  ["lg(%", "\\log_{10}($1)"],
  ["lg (%", "\\log_{10}($1)"],
  ["lg%", "\\log_{10}($1)"],
  ["lg %", "\\log_{10}($1)"],
  ["lg", "\\log_{10}(x)"],

  ["log(%,%)", "\\log_{$1}($2)"],
  ["log_%(%)", "\\log_{$1}($2)"],
  ["log(%)", "\\log($1)"],
  ["log (%)", "\\log($1)"],
  ["log%(%)", "\\log_{$1}($2)"],
  ["log%(%", "\\log_{$1}($2)"],
  ["log_%", "\\log_{$1}"],
  ["log%", "\\log_{$1}"],
  ["log", ["\\log(x)", "\\log_{10}(x)", "\\ln(x)"]],

  // Roots - LaTeX versions
  ["\\sqrt(%)", "\\sqrt{$1}"],
  ["\\sqrt (%)", "\\sqrt{$1}"],
  ["\\sqrt", "\\sqrt{x}"],
  ["\\sqrt %", "\\sqrt{$1}"],
  
  // Plain text versions
  ["squareroot(%)", "\\sqrt{$1}"],
  ["cbrt", "\\sqrt[3]{x}"],
  ["cbrt(", "\\sqrt[3]{x}"],
  ["cbrt(%)", "\\sqrt[3]{$1}"],
  ["cbrt (%)", "\\sqrt[3]{$1}"],
  ["cbrt %", "\\sqrt[3]{$1}"],
  ["cuberoot(%)", "\\sqrt[3]{$1}"],
  ["cuberoot", "\\sqrt[3]{x}"],
  ["root3", "\\sqrt[3]{x}"],
  ["root3(%)", "\\sqrt[3]{$1}"],
  ["cube root(%)", "\\sqrt[3]{$1}"],
  ["%root(%)", "\\sqrt{$1}"],
  ["sqrt(%)", "\\sqrt{$1}"],
  ["sqrt (%)", "\\sqrt{$1}"],
  ["sqrt %", "\\sqrt{$1}"],
  ["sqrt", "\\sqrt{x}"],
  ["sqrt(", "\\sqrt{x}"],

  ["log% %", "\\log_{$1}($2)"],
  ["log %", "\\log($1)"],
  ["ln %", "\\ln($1)"],
  ["lg %", "\\log_{10}($1)"],

  // Vectors
  ["vec(%)", "\\overrightarrow{$1}"],
  ["vec (%)", "\\overrightarrow{$1}"],
  ["Vec(%)", "\\overrightarrow{$1}"],
  ["vec %", "\\overrightarrow{$1}"],
  ["vec%", "\\overrightarrow{$1}"],
  ["vector(%)", "\\overrightarrow{$1}"],
  ["Vector(%)", "\\overrightarrow{$1}"],
  ["Vector %", "\\overrightarrow{$1}"],

  ["%hat", "\\hat{$1}"],
  ["% hat", "\\hat{$1}"],
  ["hat(%)", "\\hat{$1}"],
  ["hat (%)", "\\hat{$1}"],
  ["hat %", "\\hat{$1}"],
  ["hat%", "\\hat{$1}"],
  ["hat", ["\\hat{a}", "\\hat{v}", "\\hat{\\imath}", "\\hat{\\jmath}"]],

  ["%bar", "\\bar{$1}"],
  ["% bar", "\\bar{$1}"],
  ["bar(%)", "\\bar{$1}"],
  ["bar (%)", "\\bar{$1}"],
  ["bar %", "\\bar{$1}"],
  ["bar%", "\\bar{$1}"],
  ["bar", ["\\bar{x}", "\\bar{z}", "\\bar{active}"]],

  // Sums
  ["\\sum", [
    "\\sum",
    "\\sum_{i=0}^{n}",
    "\\sum_{i=0}^{n} a_i",
    "\\sum_{n=1}^{\\infty}",
    "\\sum_{n=1}^{\\infty} a_n"
  ]],
  ["sum from % to % (%)", "\\sum_{$1}^{$2} ($3)"],
  ["sum % to % (%)", "\\sum_{$1}^{$2} ($3)"],
  ["sum % % (%)", "\\sum_{$1}^{$2} ($3)"],
  ["sum from % to %", "\\sum_{$1}^{$2}"],
  ["sum % to %", "\\sum_{$1}^{$2}"],
  ["sum % %", "\\sum_{$1}^{$2}"],
  ["sum", [
    "\\sum",
    "\\sum_{i=0}^{n}",
    "\\sum_{i=0}^{n} a_i",
    "\\sum_{n=1}^{\\infty}",
    "\\sum_{n=1}^{\\infty} a_n"
  ]],
  ["summation", ["\\sum", "\\sum_{n=1}^{\\infty}", "\\sum_{i=0}^{n}"]],
  ["%SUM%", "\\sum_{$1}^{$2}"],
  ["sum(%,%)", "\\sum_{$1}^{$2}"],

  // Derivatives
  ["y", ["y", "y(x)", "y'(x)", "y''(x)"]],
  ["diff", ["\\frac{d}{dx}", "\\frac{dy}{dx}", "\\frac{d^2y}{dx^2}"]],
  ["differentiate", ["\\frac{d}{dx}", "\\frac{dy}{dx}", "\\frac{d^2y}{dx^2}"]],
  ["d/dx", "\\frac{d}{dx}"],
  ["dy/dx", "\\frac{dy}{dx}"],
  ["dy / dx", "\\frac{dy}{dx}"],
  ["dydx", "\\frac{dy}{dx}"],
  ["d2y", "\\frac{d^2y}{dx^2}"],
  ["d2y/dx2", "\\frac{d^2y}{dx^2}"],
  ["d^2y/dx^2", "\\frac{d^2y}{dx^2}"],
  ["d2y / dx2", "\\frac{d^2y}{dx^2}"],
  ["d2ydx2", "\\frac{d^2y}{dx^2}"],
  ["d3y", "\\frac{d^3y}{dx^3}"],
  ["d3y/dx3", "\\frac{d^3y}{dx^3}"],
  ["d^3y/dx^3", "\\frac{d^3y}{dx^3}"],
  ["f", ["f(x)", "f'(x)", "f''(x)"]],
  ["f'", ["f'(x)", "f''(x)"]],
  ["f''", ["f''(x)"]],

  // Fractional exponents
  ["%^(1/2)", "\\sqrt{$1}"],
  ["%^(1/3)", "\\sqrt[3]{$1}"],
  ["%^(%/%)", "{$1}^{\\frac{$2}{$3}}"],

  // Exponents
  ["x2", "x^{2}"],
  ["x3", "x^{3}"],
  ["e^(%)", "e^{$1}"],
  ["exp(%)", "e^{$1}"],
  ["%^2", "{$1}^{2}"],
  ["%^3", "{$1}^{3}"],
  ["%^(%)", "{$1}^{$2}"],
  ["%^%", "{$1}^{$2}"],

  // Comparisons & operators
  ["<=", "\\leq"],
  [">=", "\\geq"],
  ["!=", "\\neq"],
  ["+-", "\\pm"],

  // Trig functions with degree symbol - must come before generic %o rule
  ["sin%o", "\\sin($1^{\\circ})"],
  ["cos%o", "\\cos($1^{\\circ})"],
  ["tan%o", "\\tan($1^{\\circ})"],
  ["\\sin%o", "\\sin($1^{\\circ})"],
  ["\\cos%o", "\\cos($1^{\\circ})"],
  ["\\tan%o", "\\tan($1^{\\circ})"],
  
   // Degrees 
  ["deg", "^{\\circ}"],
  ["%deg", "$1^{\\circ}"],
  ["degree", "^{\\circ}"],
  ["%degree", "$1^{\\circ}"],
  ["degrees", "^{\\circ}"],
  ["%degrees", "$1^{\\circ}"],
  ["°", "^{\\circ}"], 
  ["o", "^{\\circ}"],
  ["%o", "$1^{\\circ}"],

  // Constants
  ["pi", "\\pi"],
  ["inf", "\\infty"],
  ["infinity", "\\infty"],
  ["union", "\\cup"],
  ["intersection", "\\cap"],
  ["subset", ["\\subseteq", "\\subset"]],
  ["approx", "\\approx"],
  ["app", "\\approx"],

  // Integrals
  ["\\int", ["\\int", "\\int_{a}^{b}", "\\int_{0}^{\\infty}"]],
  ["int", ["int(,)", "integrate(,)"]],
  ["integral", ["integrate(,)"]],
  ["integrate", ["integrate(,)"]],
  ["int(%,%)", ["\\int_{$1}^{$2}"]],
  ["integrate(%,%)", ["\\int_{$1}^{$2}"]],
  ["defint", "\\int_{a}^{b}"],
  ["dint", "\\int_{a}^{b}"],
  ["intab", "\\int_{a}^{b}"],
  ["intlimits", "\\int_{a}^{b}"],
  ["int from % to %", "\\int_{$1}^{$2}"],
  ["int_%^%", "\\int_{$1}^{$2}"],
  ["int% %", "\\int_{$1}^{$2}"],

  // Multiplication
  ["x", ["{x}", "x^{2}", "x^{3}", "x^{n}"]],
  ["times", "\\times"],
  ["time", "\\times"],
  ["mult", "\\times"],
  ["multiply", "\\times"],
  ["*", "\\times"],
  ["×", "\\times"],
  ["dot", "\\cdot"],

  // Greek
  ["theater", "\\theta"],
  ["theter", "\\theta"],
  ["theta", "\\theta"],
  ["alpha", "\\alpha"],
  ["beta", "\\beta"],
  ["gamma", "\\gamma"],
  ["delta", "\\delta"],
  ["omega", "\\omega"],
  ["lambda", "\\lambda"],
  ["mu", "\\mu"],
  ["mew", "\\mu"],
  ["mule", "\\mu"],
  ["Delta", "\\Delta"],
  ["Omega", "\\Omega"],

  // Trig - LaTeX versions first
  ["\\sin(%)", "\\sin($1)"],
  ["\\sin (%)", "\\sin($1)"],
  ["\\sin", ["\\sin(x)", "\\sin(\\theta)", "\\sin^2(\\theta)", "\\sin^{-1}(\\theta)"]],
  ["\\sin %", "\\sin($1)"],
  
  // Plain text versions
  ["Sin", ["\\sin(x)", "\\sin(\\theta)", "\\sin^2(\\theta)", "\\sin^{-1}(\\theta)"]],
  ["Sin^", ["\\sin^2(\\theta)", "\\sin^{-1}(\\theta)", "\\sin(\\theta)^2", "\\sin(\\theta)^{-1}"]],
  ["sin(%)", "\\sin($1)"],
  ["sin (%)", "\\sin($1)"],
  ["sin^-1", "\\sin^{-1}(x)"],
  ["sin-1", "\\sin^{-1}(x)"],
  ["sin -1", "\\sin^{-1}(x)"],
  ["sin^-1%", "\\sin^{-1}($1)"],
  ["sin-1%", "\\sin^{-1}($1)"],
  ["sin -1%", "\\sin^{-1}($1)"],
  ["sin^2(%)", "\\sin^{2}($1)"],
  ["sin^-1(%)", "\\sin^{-1}($1)"],
  ["sin %", "\\sin($1)"],
  ["asin(%)", "\\sin^{-1}($1)"],
  ["arcsin(%)", "\\sin^{-1}($1)"],

  // LaTeX versions for cos
  ["\\cos(%)", "\\cos($1)"],
  ["\\cos (%)", "\\cos($1)"],
  ["\\cos", ["\\cos(x)", "\\cos(\\theta)", "\\cos^2(\\theta)", "\\cos^{-1}(\\theta)"]],
  ["\\cos %", "\\cos($1)"],
  
  // Plain text versions
  ["Cos", ["\\cos(x)", "\\cos(\\theta)", "\\cos^2(\\theta)", "\\cos^{-1}(\\theta)"]],
  ["Cos^", ["\\cos^2(\\theta)", "\\cos^{-1}(\\theta)", "\\cos(\\theta)^2", "\\cos(\\theta)^{-1}"]],
  ["cos^-1", "\\cos^{-1}(x)"],
  ["cos-1", "\\cos^{-1}(x)"],
  ["cos -1", "\\cos^{-1}(x)"],
  ["cos^-1%", "\\cos^{-1}($1)"],
  ["cos-1%", "\\cos^{-1}($1)"],
  ["cos -1%", "\\cos^{-1}($1)"],
  ["cos(%)", "\\cos($1)"],
  ["cos (%)", "\\cos($1)"],
  ["cos^2(%)", "\\cos^{2}($1)"],
  ["cos^-1(%)", "\\cos^{-1}($1)"],
  ["cos %", "\\cos($1)"],
  ["acos(%)", "\\cos^{-1}($1)"],
  ["arccos(%)", "\\cos^{-1}($1)"],

  // LaTeX versions for tan
  ["\\tan(%)", "\\tan($1)"],
  ["\\tan (%)", "\\tan($1)"],
  ["\\tan", ["\\tan(x)", "\\tan(\\theta)", "\\tan^2(\\theta)", "\\tan^{-1}(\\theta)"]],
  ["\\tan %", "\\tan($1)"],
  
  // Plain text versions
  ["Tan", ["\\tan(x)", "\\tan(\\theta)", "\\tan^2(\\theta)", "\\tan^{-1}(\\theta)"]],
  ["Tan^", ["\\tan^2(\\theta)", "\\tan^{-1}(\\theta)", "\\tan(\\theta)^2", "\\tan(\\theta)^{-1}"]],
  ["tan(%)", "\\tan($1)"],
  ["tan (%)", "\\tan($1)"],
  ["tan^-1", "\\tan^{-1}(x)"],
  ["tan-1", "\\tan^{-1}(x)"],
  ["tan -1", "\\tan^{-1}(x)"],
  ["tan^-1%", "\\tan^{-1}($1)"],
  ["tan-1%", "\\tan^{-1}($1)"],
  ["tan -1%", "\\tan^{-1}($1)"],
  ["tan^2(%)", "\\tan^{2}($1)"],
  ["tan^-1(%)", "\\tan^{-1}($1)"],
  ["tan %", "\\tan($1)"],
  ["atan(%)", "\\tan^{-1}($1)"],
  ["arctan(%)", "\\tan^{-1}($1)"],

  ["Sin(pi)", ["\\sin( \\frac{\\pi }{6})", "\\sin( \\frac{\\pi }{4})", "\\sin( \\frac{\\pi }{3})", "\\sin( \\frac{\\pi }{2})", "\\sin( \\pi)"]],
  ["Sin(2", ["\\sin( 2\\pi)", "\\sin( \\frac{2\\pi }{3})"]],
  ["Sin(3", ["\\sin( \\frac{3\\pi }{4})", "\\sin( \\frac{3\\pi }{2})"]],
  ["Sin(5", ["\\sin( \\frac{5\\pi }{3})", "\\sin( \\frac{5\\pi }{6})"]],

  ["Cos(pi)", ["\\cos( \\frac{\\pi }{6})", "\\cos( \\frac{\\pi }{4})", "\\cos( \\frac{\\pi }{3})", "\\cos( \\frac{\\pi }{2})", "\\cos( \\pi)"]],
  ["Cos(2", ["\\cos( 2\\pi)", "\\cos( \\frac{2\\pi }{3})"]],
  ["Cos(3", ["\\cos( \\frac{3\\pi }{4})", "\\cos( \\frac{3\\pi }{2})"]],
  ["Cos(5", ["\\cos( \\frac{5\\pi }{3})", "\\cos( \\frac{5\\pi }{6})"]],

  ["Tan(pi)", ["\\tan( \\frac{\\pi }{6})", "\\tan( \\frac{\\pi }{4})", "\\tan( \\frac{\\pi }{3})", "\\tan( \\frac{\\pi }{2})", "\\tan( \\pi)"]],
  ["Tan(2", ["\\tan( 2\\pi)", "\\tan( \\frac{2\\pi }{3})"]],
  ["Tan(3", ["\\tan( \\frac{3\\pi }{4})", "\\tan( \\frac{3\\pi }{2})"]],
  ["Tan(5", ["\\tan( \\frac{5\\pi }{3})", "\\tan( \\frac{5\\pi }{6})"]],

  ["hat", ["\\hat{a}", "\\hat{b}"]],
  ["bar", ["\\bar{a}", "\\bar{b}"]],

  // Fractions
  ["%over%", "\\frac{$1}{$2}"],
  ["%divide%", "\\frac{$1}{$2}"],
  ["mod", "\\left|x\\right|"]
];

// Compile rules
function compileRules(rules) {
  const compiled = [];
  for (const [pattern, replacement] of rules) {
    if (pattern.includes('%')) {
      // For wildcards, escape everything except % which becomes (.+)
      let escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      escaped = escaped.replace(/%/g, '(.+)');
      const regex = new RegExp(`^${escaped}$`, 'i');
      compiled.push({ regex, replacement, isWildcard: true });
    } else {
      // For non-wildcards, escape all special regex chars including backslash
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escaped}$`, 'i');
      compiled.push({ regex, replacement, isWildcard: false });
    }
  }
  return compiled;
}

const COMPILED_RULES = compileRules(RULES);

const FUZZY_TRIG_RULES = [
  { key: 'sin', suggestions: ['\\sin(x)', '\\sin(\\theta)'] },
  { key: 'cos', suggestions: ['\\cos(x)', '\\cos(\\theta)'] },
  { key: 'tan', suggestions: ['\\tan(x)', '\\tan(\\theta)'] },
  { key: 'asin', suggestions: ['\\sin^{-1}(x)'] },
  { key: 'arcsin', suggestions: ['\\sin^{-1}(x)'] },
  { key: 'acos', suggestions: ['\\cos^{-1}(x)'] },
  { key: 'arccos', suggestions: ['\\cos^{-1}(x)'] },
  { key: 'atan', suggestions: ['\\tan^{-1}(x)'] },
  { key: 'arctan', suggestions: ['\\tan^{-1}(x)'] },
  { key: 'sin-1', suggestions: ['\\sin^{-1}(x)'] },
  { key: 'sin^-1', suggestions: ['\\sin^{-1}(x)'] },
  { key: 'cos-1', suggestions: ['\\cos^{-1}(x)'] },
  { key: 'cos^-1', suggestions: ['\\cos^{-1}(x)'] },
  { key: 'tan-1', suggestions: ['\\tan^{-1}(x)'] },
  { key: 'tan^-1', suggestions: ['\\tan^{-1}(x)'] }
];

function findTopLevelSplit(str) {
  let depth = 0;
  const priorities = { '=': 1, '+': 2, '-': 2, '*': 3, '×': 3, '/': 4 };
  let bestIdx = -1;
  let bestPriority = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(' || char === '{' || char === '[') depth++;
    else if (char === ')' || char === '}' || char === ']') depth--;
    else if (depth === 0) {
      if (char === '=' && i > 0 && (str[i - 1] === '<' || str[i - 1] === '>' || str[i - 1] === '!')) {
        continue;
      }

      if (char === '+' && str[i + 1] === '-') {
        continue;
      }
      if (char === '-' && i > 0 && str[i - 1] === '+') {
        continue;
      }

      if (priorities[char]) {
        const p = priorities[char];
        if (bestIdx === -1 || p < bestPriority) {
          bestIdx = i;
          bestPriority = p;
        }
      }
    }
  }
  return bestIdx;
}

function getLatexSuggestions(input, maxSuggestions = 5) {
  if (typeof input !== 'string') return [input];
  let trimmed = input.trim();
  if (!trimmed) return [''];

  const normalized = normalizeForMatching(trimmed);
  const inverseSuggestions = getInverseTrigSuggestions(normalized);
  if (inverseSuggestions.length > 0) {
    return inverseSuggestions.slice(0, maxSuggestions);
  }

  const trigNumberMatch = normalized.match(/^(sin|cos|tan)(-?\d+(?:\.\d+)?)(deg)?$/i);
  if (trigNumberMatch) {
    const [, func, num, degSuffix] = trigNumberMatch;
    const latexFunc = `\\${func.toLowerCase()}`;
    const base = `${latexFunc}(${num})`;
    const degree = `${latexFunc}(${num}^{\\circ})`;
    const suggestions = degSuffix ? [degree, base] : [base, degree];
    return suggestions.slice(0, maxSuggestions);
  }

  // MathLive often emits multiplication as "·" or "\\cdot".
  // Normalize these to '*' so our top-level split logic can detect multiplication.
  // Avoid touching "\\cdots" (ellipsis).
  trimmed = trimmed
    .replace(/\\cdot(?!s)/g, '*')
    .replace(/\\times/g, '*')
    .replace(/[·⋅]/g, '*');

  // If the user starts with a power/subscript (e.g. "^2*10"), MathLive typically implies
  // a missing base. For suggestions, assume a base variable 'x'.
  if (/^[\^_]/.test(trimmed)) {
    trimmed = `x${trimmed}`;
  }

  const atomicPatterns = [
    /^sum\s+from\s+/i,
    /^int\s+from\s+/i,
    /^sum\s+.+=/i,
    /^int\s+.+=/i,
  ];
  const isAtomic = atomicPatterns.some(p => p.test(trimmed));

  let splitIdx = -1;
  if (!isAtomic) {
    splitIdx = findTopLevelSplit(trimmed);
  }

  if (splitIdx !== -1) {
    const left = trimmed.slice(0, splitIdx);
    const op = trimmed[splitIdx];
    const right = trimmed.slice(splitIdx + 1);

    const limit = 3;
    const leftSugs = getLatexSuggestions(left, limit);
    const rightSugs = getLatexSuggestions(right, limit);

    let opLatex = op;
    if (op === '*') opLatex = '\\times';
    if (op === '×') opLatex = '\\times';

    const distinct = new Set();
    const results = [];

    for (const l of leftSugs) {
      for (const r of rightSugs) {
        let combined;
        if (op === '/') {
          combined = `\\frac{${l}}{${r}}`;
        } else {
          combined = `${l} ${opLatex} ${r}`;
        }

        if (!distinct.has(combined)) {
          distinct.add(combined);
          results.push(combined);
        }
      }
    }

    return results.slice(0, maxSuggestions);
  }

  let baseSuggestions = [];
  let foundRule = false;

  const variants = buildInputVariants(trimmed);
  for (const variant of variants) {
    const matchResult = matchRules(variant);
    if (matchResult.found) {
      foundRule = true;
      baseSuggestions = matchResult.suggestions;
      break;
    }
  }

  if (!foundRule) {
    const fuzzy = getFuzzySuggestions(trimmed);
    if (fuzzy.length > 0) {
      baseSuggestions = fuzzy;
    } else {
      baseSuggestions = [trimmed];
    }
  }

  const unique = new Set();
  const finalResults = [];

  for (const s of baseSuggestions) {
    if (!unique.has(s)) {
      unique.add(s);
      finalResults.push(s);
    }
  }

  return finalResults.slice(0, maxSuggestions);
}

function mathToLatex(input) {
  const suggestions = getLatexSuggestions(input, 1);
  return suggestions[0];
}

function normalizeForMatching(value) {
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·⋅×]/g, '*')
    .replace(/[−–—]/g, '-')
    .replace(/\^\{-?1\}/g, '^-1')
    .replace(/\^\(-?1\)/g, '^-1')
    .replace(/\^\-1/g, '^-1')
    .replace(/\^\{-?\s*1\}/g, '^-1')
    .replace(/°/g, 'deg')
    .trim();
}

function buildInputVariants(value) {
  const variants = new Set();
  const trimmed = String(value).trim();
  if (!trimmed) return [];

  variants.add(trimmed);
  variants.add(trimmed.replace(/\s+/g, ''));
  variants.add(trimmed.replace(/\s+/g, ' '));

  const typoFixed = applyTrigTypoFixes(trimmed);
  variants.add(typoFixed);
  variants.add(typoFixed.replace(/\s+/g, ''));

  return Array.from(variants);
}

function applyTrigTypoFixes(value) {
  let fixed = String(value);
  fixed = fixed.replace(/\bsni\b/gi, 'sin');
  fixed = fixed.replace(/\bsln\b/gi, 'sin');
  fixed = fixed.replace(/\bcso\b/gi, 'cos');
  fixed = fixed.replace(/\bcoz\b/gi, 'cos');
  fixed = fixed.replace(/\btna\b/gi, 'tan');
  fixed = fixed.replace(/\bta n\b/gi, 'tan');
  fixed = fixed.replace(/\bacs\b/gi, 'acos');
  fixed = fixed.replace(/\barsin\b/gi, 'arcsin');
  fixed = fixed.replace(/\barccos\b/gi, 'arccos');
  fixed = fixed.replace(/\barctan\b/gi, 'arctan');
  return fixed;
}

function getInverseTrigSuggestions(normalized) {
  const match = normalized.match(/^(arc)?(sin|cos|tan)(\^-?1|-?1)?([a-z]+)?$/i);
  if (!match) return [];

  const [, arcPrefix, func, invRaw, argRaw] = match;
  const isInverse = Boolean(arcPrefix) || Boolean(invRaw);
  if (!isInverse) return [];

  const arg = argRaw || 'x';
  return [`\\${func.toLowerCase()}^{-1}(${arg})`];
}

function matchRules(value) {
  for (const rule of COMPILED_RULES) {
    const match = value.match(rule.regex);
    if (!match) continue;

    let suggestions = Array.isArray(rule.replacement)
      ? rule.replacement
      : [rule.replacement];

    if (rule.isWildcard) {
      suggestions = suggestions.map(template => {
        let result = template;
        for (let i = 1; i < match.length; i++) {
          const subInput = match[i];
          const subLatex = mathToLatex(subInput);
          result = result.split(`$${i}`).join(subLatex);
        }
        return result;
      });
    }

    return { found: true, suggestions };
  }

  return { found: false, suggestions: [] };
}

function getFuzzySuggestions(value) {
  const normalized = normalizeForMatching(value);
  if (!normalized) return [];

  const candidates = FUZZY_TRIG_RULES.map(rule => {
    const distance = levenshteinDistance(normalized, rule.key);
    return { ...rule, distance };
  });

  candidates.sort((a, b) => a.distance - b.distance);
  const best = candidates[0];
  if (!best) return [];

  const threshold = normalized.length <= 4 ? 1 : 2;
  if (best.distance > threshold) return [];

  return best.suggestions;
}

function levenshteinDistance(a, b) {
  if (a === b) return 0;
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

// Export for use in app
window.getLatexSuggestions = getLatexSuggestions;
window.mathToLatex = mathToLatex;
