// const RULES = [
//   // Fractions
//   ["%/%", "\\frac{$1}{$2}"],
//   ["%over%", "\\frac{$1}{$2}"],
//   ["%divide%", "\\frac{$1}{$2}"],

//   // Logarithms
//   // Full forms with value
//   ["log(%,%)", "\\log_{$1}($2)"],    // log(2,8)
//   ["log_%(%)", "\\log_{$1}($2)"],    // log_2(8)
//   ["log%(%)", "\\log_{$1}($2)"],     // log2(8)

//   // Base-only (no value yet)
//   ["log_%", "\\log_{$1}"],           // log_2
//   ["log%", "\\log_{$1}"],            // log2

//   // Common base-10 shortcuts (treat as log base 10)
//   ["lg(%)", "\\log_{10}($1)"],       // lg(x)
//   ["lg%", "\\log_{10}($1)"],         // lgx (optional)

//   // Natural log variants
//   ["ln(%)", "\\ln($1)"],             // ln(x)
//   ["ln%", "\\ln($1)"],               // lnx
//   ["loge(%)", "\\ln($1)"],           // loge(x)
//   ["log_e(%)", "\\ln($1)"],          // log_e(x)
//   ["log e(%)", "\\ln($1)"],          // log e(x)

//   // Plain “log” templates
//   ["log(%)", "\\log($1)"],           // log(x)
//   ["log[%)", "\\log($1)"],           // log[x] (sloppy bracket typing)
//   ["log", "\\log(x)"],               // log -> template


//   // Sums & Mod
//   ["%SUM%", "\\sum_{$1}^{$2}"],
//   ["mod", "\\left|x\\right|"],

//   // Derivatives
//   ["d%", "\\frac{d$1}{dx}"],
//   ["dy", "\\frac{dy}{dx}"],
//   ["dydx", "\\frac{dy}{dx}"],
//   ["dy/dx", "\\frac{dy}{dx}"],
//   ["f'(x)", "\\frac{dy}{dx}"],
//   ["d2y", "\\frac{d^{2}y}{dx^{2}}"],
//   ["d2ydx2", "\\frac{d^{2}y}{dx^{2}}"],
//   ["f''(x)", "\\frac{d^{2}y}{dx^{2}}"],
//   ["d^2y", "\\frac{d^{2}y}{dx^{2}}"],

//   // Vectors
//   ["Vector(%)", "\\overrightarrow{$1}"],
//   ["Vec(%)", "\\overrightarrow{$1}"],

//   // Roots
//   ["squareroot(%)", "\\sqrt{$1}"],
//   ["cuberoot(%)", "\\sqrt[3]{$1}"],
//   ["sqrt(%)", "\\sqrt{$1}"],

//   // Exponents
//   ["^(1/2)", ["\\sqrt", "^{\\frac{1}{2}}"]],
//   ["^1/2", ["\\sqrt", "^{\\frac{1}{2}}"]],
//   ["^(1/3)", ["^{\\frac{1}{3}}", "\\sqrt[3]{}"]],
//   ["^1/3", ["^{\\frac{1}{3}}", "\\sqrt[3]{}"]],
//   ["x^1/2", "x^{\\frac{1}{2}}"],
//   ["x2", "x^{2}"],
//   ["x3", "x^{3}"],

//   // Fixed tokens
//   ["<=", "\\leq"],
//   [">=", "\\geq"],
//   ["!=", "\\neq"],
//   ["+-", "\\pm"],
//   ["deg", "^{\\circ}"],
//   ["degree", "^{\\circ}"],
//   ["pi", "\\pi"],
//   ["inf", "\\infty"],
//   ["infinity", "\\infty"],
//   ["union", "\\cup"],
//   ["intersection", "\\cap"],
//   ["subset", "\\nsubseteq"],
//   ["theater", "\\theta"],
//   ["theter", "\\theta"],
//   ["theta", "\\theta"],
//   ["alpha", "\\alpha"],
//   ["beta", "\\beta"],
//   ["delta", "\\delta"],
//   ["Delta", "\\Delta"],
//   ["omega", "\\omega"],
//   ["Omega", "\\Omega"],
//   ["lambda", "\\lambda"],
//   ["gamma", "\\gamma"],
//   ["mu", "\\mu"],
//   ["mew", "\\mu"],
//   ["mule", "\\mu"],
//   ["approx", "\\approx"],
//   ["app", "\\approx"],
//   ["Integrate", "\\int_{}^{}"],
//   ["Int", "\\int_{}^{}"],
//   ["x", "\\times"],
//   ["times", "\\times"],
//   ["time", "\\times"],
//   ["%^2", "{$1}^{2}"],
//   ["%^3", "{$1}^{3}"],
//   ["%^(%)", "{$1}^{$2}"],     // e.g. x^(n), (a+b)^(2)
//   ["%^%", "{$1}^{$2}"],       // e.g. x^2, 2^n

//   // === TRIGONOMETRIC: MULTIPLE SUGGESTIONS (from your spreadsheet) ===
//   ["Sin", [
//     "\\sin(\\theta)",
//     "\\sin^2(\\theta)",
//     "\\sin^{-1}(\\theta)",
//     "\\sin(\\theta)^2",
//     "\\sin(\\theta)^{-1}"
//   ]],
//   ["Sin^", [
//     "\\sin^2(\\theta)",
//     "\\sin^{-1}(\\theta)",
//     "\\sin(\\theta)^2",
//     "\\sin(\\theta)^{-1}"
//   ]],
//   ["Cos", [
//     "\\cos(\\theta)",
//     "\\cos^2(\\theta)",
//     "\\cos^{-1}(\\theta)",
//     "\\cos(\\theta)^2",
//     "\\cos(\\theta)^{-1}"
//   ]],
//   ["Cos^", [
//     "\\cos^2(\\theta)",
//     "\\cos^{-1}(\\theta)",
//     "\\cos(\\theta)^2",
//     "\\cos(\\theta)^{-1}"
//   ]],
//   ["Tan", [
//     "\\tan(\\theta)",
//     "\\tan^2(\\theta)",
//     "\\tan^{-1}(\\theta)",
//     "\\tan(\\theta)^2",
//     "\\tan(\\theta)^{-1}"
//   ]],
//   ["Tan^", [
//     "\\tan^2(\\theta)",
//     "\\tan^{-1}(\\theta)",
//     "\\tan(\\theta)^2",
//     "\\tan(\\theta)^{-1}"
//   ]],

//   // Trig with pi
//   ["Sin(pi)", [
//     "\\sin( \\frac{\\pi }{6})",
//     "\\sin( \\frac{\\pi }{4})",
//     "\\sin( \\frac{\\pi }{3})",
//     "\\sin( \\frac{\\pi }{2})",
//     "\\sin( \\pi)"
//   ]],
//   ["Sin(2", ["\\sin( 2\\pi)", "\\sin( \\frac{2\\pi }{3})"]],
//   ["Sin(3", ["\\sin( \\frac{3\\pi }{4})", "\\sin( \\frac{3\\pi }{2})"]],
//   ["Sin(5", ["\\sin( \\frac{5\\pi }{3})", "\\sin( \\frac{5\\pi }{6})"]],

//   ["Cos(pi)", [
//     "\\cos( \\frac{\\pi }{6})",
//     "\\cos( \\frac{\\pi }{4})",
//     "\\cos( \\frac{\\pi }{3})",
//     "\\cos( \\frac{\\pi }{2})",
//     "\\cos( \\pi)"
//   ]],
//   ["Cos(2", ["\\cos( 2\\pi)", "\\cos( \\frac{2\\pi }{3})"]],
//   ["Cos(3", ["\\cos( \\frac{3\\pi }{4})", "\\cos( \\frac{3\\pi }{2})"]],
//   ["Cos(5", ["\\cos( \\frac{5\\pi }{3})", "\\cos( \\frac{5\\pi }{6})"]],

//   ["Tan(pi)", [
//     "\\tan( \\frac{\\pi }{6})",
//     "\\tan( \\frac{\\pi }{4})",
//     "\\tan( \\frac{\\pi }{3})",
//     "\\tan( \\frac{\\pi }{2})",
//     "\\tan( \\pi)"
//   ]],
//   ["Tan(2", ["\\tan( 2\\pi)", "\\tan( \\frac{2\\pi }{3})"]],
//   ["Tan(3", ["\\tan( \\frac{3\\pi }{4})", "\\tan( \\frac{3\\pi }{2})"]],
//   ["Tan(5", ["\\tan( \\frac{5\\pi }{3})", "\\tan( \\frac{5\\pi }{6})"]],

//   // Hats & bars
//   ["hat", ["\\hat{a}", "\\hat{b}"]],
//   ["bar", ["\\bar{a}", "\\bar{b}"]]
// ];

const RULES = [
  // -------------------------
  // Fractions (3 synonyms -> 1 wildcard family)
  // -------------------------
  ["%/%", "\\frac{$1}{$2}"],
  ["%over%", "\\frac{$1}{$2}"],
  ["%divide%", "\\frac{$1}{$2}"],

  // -------------------------
  // Logarithms (specific -> general)
  // -------------------------
  ["log(%,%)", "\\log_{$1}($2)"],   // log(2,8)
  ["log_%(%)", "\\log_{$1}($2)"],   // log_2(8)
  ["log%(%)", "\\log_{$1}($2)"],    // log2(8)
  ["log_%", "\\log_{$1}"],          // log_2
  ["log%", "\\log_{$1}"],           // log2
  ["log(%)", "\\log($1)"],          // log(x)
  ["log", "\\log(x)"],              // log

  // natural log
  ["ln(%)", "\\ln($1)"],
  ["ln", "\\ln(x)"],
  ["loge(%)", "\\ln($1)"],
  ["log_e(%)", "\\ln($1)"],
  ["log e(%)", "\\ln($1)"],

  // base-10 shortcut
  ["lg(%)", "\\log_{10}($1)"],
  ["lg", "\\log_{10}(x)"],

  // -------------------------
  // Sums & absolute value (your "mod" is actually abs)
  // -------------------------
  ["%SUM%", "\\sum_{$1}^{$2}"],
  ["mod", "\\left|x\\right|"],

  // -------------------------
  // Derivatives (keep explicit ones)
  // -------------------------
  ["dy/dx", "\\frac{dy}{dx}"],
  ["dydx", "\\frac{dy}{dx}"],
  ["dy", "\\frac{dy}{dx}"],
  ["f'(x)", "\\frac{dy}{dx}"],

  ["d2ydx2", "\\frac{d^{2}y}{dx^{2}}"],
  ["d2y", "\\frac{d^{2}y}{dx^{2}}"],
  ["f''(x)", "\\frac{d^{2}y}{dx^{2}}"],
  ["d^2y", "\\frac{d^{2}y}{dx^{2}}"],

  // General "d%" stays last in derivative section (so it doesn't steal matches)
  ["d%", "\\frac{d$1}{dx}"],

  // -------------------------
  // Vectors (2 rules -> 1 wildcard)
  // -------------------------
  ["%ec(%)", "\\overrightarrow{$1}"], // matches Vec(...) and Vector(...)

  // -------------------------
  // Roots (2 rules -> 1 wildcard + keep sqrt)
  // -------------------------
  ["squareroot(%)", "\\sqrt{$1}"],
  ["%root(%)", "\\sqrt{$1}"],         // square root(x), squareroot(x) -> √
  ["cube%root(%)", "\\sqrt[3]{$1}"],  // cube root(x), cuberoot(x)
  ["sqrt(%)", "\\sqrt{$1}"],

  // -------------------------
  // Exponents (general; keep specific first)
  // -------------------------
  ["x2", "x^{2}"],
  ["x3", "x^{3}"],
  ["%^2", "{$1}^{2}"],
  ["%^3", "{$1}^{3}"],
  ["%^(%)", "{$1}^{$2}"],   // x^(n)
  ["%^%", "{$1}^{$2}"],     // x^n

  // -------------------------
  // Comparisons & operators
  // -------------------------
  ["<=", "\\leq"],
  [">=", "\\geq"],
  ["!=", "\\neq"],
  ["+-", "\\pm"],

  // degrees
  ["deg", "^{\\circ}"],
  ["degree", "^{\\circ}"],

  // constants / sets / etc.
  ["pi", "\\pi"],
  ["inf", "\\infty"],
  ["infinity", "\\infty"],
  ["union", "\\cup"],
  ["intersection", "\\cap"],
  ["subset", "\\nsubseteq"],
  ["approx", "\\approx"],
  ["app", "\\approx"],

  // integrals (case-insensitive already)
  ["int", "\\int_{}^{}"],

  // multiplication (I recommend removing ["x","\\times"] if x is usually a variable)
  ["times", "\\times"],
  ["time", "\\times"],

  // -------------------------
  // Greek (keep common typos)
  // -------------------------
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

  // Uppercase greek (KaTeX needs exact case, but your regex is case-insensitive)
  ["Delta", "\\Delta"],
  ["Omega", "\\Omega"],

  // -------------------------
  // Trig suggestions (keep as-is; these are "menu" style)
  // -------------------------
  ["Sin", ["\\sin(\\theta)", "\\sin^2(\\theta)", "\\sin^{-1}(\\theta)", "\\sin(\\theta)^2", "\\sin(\\theta)^{-1}"]],
  ["Sin^", ["\\sin^2(\\theta)", "\\sin^{-1}(\\theta)", "\\sin(\\theta)^2", "\\sin(\\theta)^{-1}"]],

  ["Cos", ["\\cos(\\theta)", "\\cos^2(\\theta)", "\\cos^{-1}(\\theta)", "\\cos(\\theta)^2", "\\cos(\\theta)^{-1}"]],
  ["Cos^", ["\\cos^2(\\theta)", "\\cos^{-1}(\\theta)", "\\cos(\\theta)^2", "\\cos(\\theta)^{-1}"]],

  ["Tan", ["\\tan(\\theta)", "\\tan^2(\\theta)", "\\tan^{-1}(\\theta)", "\\tan(\\theta)^2", "\\tan(\\theta)^{-1}"]],
  ["Tan^", ["\\tan^2(\\theta)", "\\tan^{-1}(\\theta)", "\\tan(\\theta)^2", "\\tan(\\theta)^{-1}"]],

  // trig with pi (keep)
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

  // Hats & bars
  ["hat", ["\\hat{a}", "\\hat{b}"]],
  ["bar", ["\\bar{a}", "\\bar{b}"]]
]


// Precompile rules (same as before)
function compileRules(rules) {
  const compiled = [];
  for (const [pattern, replacement] of rules) {
    if (pattern.includes('%')) {
      let escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      escaped = escaped.replace(/%/g, '(.+)');
      const regex = new RegExp(`^${escaped}$`, 'i');
      compiled.push({ regex, replacement, isWildcard: true });
    } else {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escaped}$`, 'i');
      compiled.push({ regex, replacement, isWildcard: false });
    }
  }
  return compiled;
}

const COMPILED_RULES = compileRules(RULES);

/**
 * Get top LaTeX suggestions (1 or more) for a math input.
 * @param {string} input
 * @param {number} maxSuggestions - max number of suggestions to return
 * @returns {string[]} Array of LaTeX strings
 */
export function getLatexSuggestions(input, maxSuggestions = 5) {
  if (typeof input !== 'string') return [input];

  for (const rule of COMPILED_RULES) {
    const match = input.match(rule.regex);
    if (match) {
      let suggestions = Array.isArray(rule.replacement) 
        ? rule.replacement 
        : [rule.replacement];

      // Apply wildcards if needed
      if (rule.isWildcard) {
        suggestions = suggestions.map(template => {
          let result = template;
          for (let i = 1; i < match.length; i++) {
            result = result.replace(new RegExp(`\\$${i}`, 'g'), match[i]);
          }
          return result;
        });
      }

      return suggestions.slice(0, maxSuggestions);
    }
  }

  return [input]; // fallback
}

/**
 * Backward-compatible single-output function (your original interface)
 * Returns the FIRST suggestion only.
 */
export function mathToLatex(input) {
  const suggestions = getLatexSuggestions(input, 1);
  return suggestions[0];
}