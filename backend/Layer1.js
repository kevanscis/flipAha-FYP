
// Define your rules: [input_pattern_with_%_as_wildcard, latex_output_with_$1,$2...]
const RULES = [
  // Fractions
  ["%/%", "\\frac{$1}{$2}"],
  ["%over%", "\\frac{$1}{$2}"],
  ["%divide%", "\\frac{$1}{$2}"],

  // Logarithms
  ["log_%(%)", "\\log_{$1}($2)"],
  ["log(%,%)", "\\log_{$1}($2)"],
  ["ln%", "\\ln($1)"],
  ["log%", "\\log_{$1}"],
  ["log_e(%)", "\\ln($1)"],
  ["loge(%)", "\\ln($1)"],
  ["Ln(%)", "\\ln($1)"],

  // Sums & Mod
  ["%SUM%", "\\sum_{$1}^{$2}"],
  ["mod", "\\left|x\\right|"],

  // Derivatives
  ["d%", "\\frac{d$1}{dx}"],
  ["dy", "\\frac{dy}{dx}"],
  ["dydx", "\\frac{dy}{dx}"],
  ["dy/dx", "\\frac{dy}{dx}"],
  ["f'(x)", "\\frac{dy}{dx}"],
  ["d2y", "\\frac{d^{2}y}{dx^{2}}"],
  ["d2ydx2", "\\frac{d^{2}y}{dx^{2}}"],
  ["f''(x)", "\\frac{d^{2}y}{dx^{2}}"],
  ["d^2y", "\\frac{d^{2}y}{dx^{2}}"],

  // Vectors
  ["Vector(%)", "\\overrightarrow{$1}"],
  ["Vec(%)", "\\overrightarrow{$1}"],

  // Roots
  ["square root(%)", "\\sqrt{$1}"],
  ["cube root(%)", "\\sqrt[3]{$1}"],
  ["sqrt(%)", "\\sqrt{$1}"],

  // Exponents (with %)
  ["^(1/2)", "\\sqrt"],
  ["^(1/2)", "^{\\frac{1}{2}}"],
  ["^1/2", "\\sqrt"],
  ["^1/2", "^{\\frac{1}{2}}"],
  ["^(1/3)", "^{\\frac{1}{3}}"],
  ["^1/3", "^{\\frac{1}{3}}"],
  ["^(1/3)", "\\sqrt[3]{}"],
  ["^1/3", "\\sqrt[3]{}"],
  ["x^1/2", "x^{\\frac{1}{2}}"],

  // Fixed tokens (NO %) — must come AFTER wildcard rules!
  ["<=", "\\leq"],
  [">=", "\\geq"],
  ["!=", "\\neq"],
  ["+-", "\\pm"],
  ["deg", "^{\\circ}"],
  ["degree", "^{\\circ}"],
  ["pi", "\\pi"],
  ["inf", "\\infty"],
  ["infinity", "\\infty"],
  ["union", "\\cup"],
  ["intersection", "\\cap"],
  ["subset", "\\nsubseteq"],
  ["theater", "\\theta"],
  ["theter", "\\theta"],
  ["theta", "\\theta"],
  ["alpha", "\\alpha"],
  ["beta", "\\beta"],
  ["delta", "\\delta"],
  ["Delta", "\\Delta"],
  ["omega", "\\omega"],
  ["Omega", "\\Omega"],
  ["lambda", "\\lambda"],
  ["gamma", "\\gamma"],
  ["mu", "\\mu"],
  ["mew", "\\mu"],
  ["mule", "\\mu"],
  ["approx", "\\approx"],
  ["app", "\\approx"],
  ["Integrate", "\\int_{}^{}"],
  ["Int", "\\int_{}^{}"],
  ["x", "\\times"],
  ["times", "\\times"],
  ["time", "\\times"],
  ["^2", "^{2}"],
  ["^3", "^{3}"],
  ["log(x)", "\\log(x)"],
  ["log10(", "\\log(x)"],
  ["lg(x)", "\\log(x)"],
  ["log_10(x)", "\\log(x)"],
  ["lg", "\\log(x)"],
  ["log", "\\log(x)"],
  ["log(x", "\\log(x)"],
  ["log[x]", "\\log(x)"],
  ["ln", "\\ln(x)"],
  ["loge", "\\ln(x)"],
  ["log_e", "\\ln(x)"],
  ["log e", "\\ln(x)"],

  // Trigonometric (case-insensitive via regex flag)
  ["Sin", "\\sin(\\theta)"],
  ["Sin^", "\\sin^2(\\theta)"],
  ["Cos", "\\cos(\\theta)"],
  ["Cos^", "\\cos^2(\\theta)"],
  ["Tan", "\\tan(\\theta)"],
  ["Tan^", "\\tan^2(\\theta)"],

  // Trig with pi (simplified — you may extend these)
  ["Sin(pi)", "\\sin( \\frac{\\pi }{6})"],
  ["Sin(2", "\\sin( 2\\pi)"],
  ["Sin(3", "\\sin( \\frac{3\\pi }{4})"],
  ["Sin(5", "\\sin( \\frac{5\\pi }{6})"],
  ["Cos(pi)", "\\cos( \\frac{\\pi }{6})"],
  ["Cos(2", "\\cos( 2\\pi)"],
  ["Cos(3", "\\cos( \\frac{3\\pi }{4})"],
  ["Cos(5", "\\cos( \\frac{5\\pi }{6})"],
  ["Tan(pi)", "\\tan( \\frac{\\pi }{6})"],
  ["Tan(2", "\\tan( 2\\pi)"],
  ["Tan(3", "\\tan( \\frac{3\\pi }{4})"],
  ["Tan(5", "\\tan( \\frac{5\\pi }{6})"],

  // Hats & bars
  ["hat", "\\hat{a}"],
  ["bar", "\\bar{a}"]
];

// Precompile all rules into regex + replacement
function compileRules(rules) {
  const compiled = [];
  for (const [pattern, replacement] of rules) {
    if (pattern.includes('%')) {
      // Escape all regex special characters
      let escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Replace each % with a capture group (.+)
      escaped = escaped.replace(/%/g, '(.+)');
      const regex = new RegExp(`^${escaped}$`, 'i'); // case-insensitive
      compiled.push({ regex, replacement, isWildcard: true });
    } else {
      // Exact match (escape special chars)
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escaped}$`, 'i');
      compiled.push({ regex, replacement, isWildcard: false });
    }
  }
  return compiled;
}

const COMPILED_RULES = compileRules(RULES);

/**
 * Converts a math input string to LaTeX using rule-based matching.
 * @param {string} input - The user's input (e.g., "a/b", "log_a(b)", "<=")
 * @returns {string} - Corresponding LaTeX (e.g., "\frac{a}{b}", "\log_{a}(b)", "\leq")
 */
function mathToLatex(input) {
  if (typeof input !== 'string') return input;
  
  for (const rule of COMPILED_RULES) {
    const match = input.match(rule.regex);
    if (match) {
      if (rule.isWildcard) {
        let result = rule.replacement;
        // Replace $1, $2, ... with captured groups
        for (let i = 1; i < match.length; i++) {
          result = result.replace(new RegExp(`\\$${i}`, 'g'), match[i]);
        }
        return result;
      } else {
        return rule.replacement;
      }
    }
  }
  // If no rule matches, return original input
  return input;
}

// ====== Example Usage ======
// You can test here or call mathToLatex() from elsewhere

console.log("Testing conversions:");
console.log(mathToLatex("a/b"));                // \frac{a}{b}
console.log(mathToLatex("log_a(b)"));           // \log_{a}(b)
console.log(mathToLatex("lnx"));                // \ln(x)
console.log(mathToLatex("Vector(v)"));          // \overrightarrow{v}
console.log(mathToLatex("square root(5)"));     // \sqrt{5}
console.log(mathToLatex("<="));                 // \leq
console.log(mathToLatex("Sin"));                // \sin(\theta)
console.log(mathToLatex("delta"));              // \delta
console.log(mathToLatex("Delta"));              // \Delta
console.log(mathToLatex("x"));                  // \times
console.log(mathToLatex("5/3"));                // \frac{5}{3}
console.log(mathToLatex("log_e(x)"));           // \ln(x)

// Export for Node.js (optional)
if (typeof module !== 'undefined' && module.exports) {
module.exports = { mathToLatex };
}