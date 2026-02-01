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
  // Logarithms (specific -> general)
  // -------------------------
  ["log(%,%)", "\\log_{$1}($2)"],   // log(2,8)
  ["log_%(%)", "\\log_{$1}($2)"],   // log_2(8)
  ["log(%)", "\\log($1)"],          // log(x)  <-- Moved up to prevent log% from greedily matching log(x)
  ["log (%)", "\\log($1)"],         // log (x) -> avoid double parens
  ["log%(%)", "\\log_{$1}($2)"],    // log2(8)
  ["log_%", "\\log_{$1}"],          // log_2
  ["log%", "\\log_{$1}"],           // log2
  ["log", ["\\log(x)", "\\log_{10}(x)", "\\ln(x)"]],              // log -> template

  // natural log
  ["ln(%)", "\\ln($1)"],
  ["ln (%)", "\\ln($1)"],           // ln (x) -> avoid double parens
  ["ln", "\\ln(x)"],
  ["loge(%)", "\\ln($1)"],
  ["log_e(%)", "\\ln($1)"],
  ["log e(%)", "\\ln($1)"],

  // base-10 shortcut
  ["lg(%)", "\\log_{10}($1)"],
  ["lg (%)", "\\log_{10}($1)"],     // lg (x) -> avoid double parens
  ["lg", "\\log_{10}(x)"],

  // -------------------------
  // Roots (2 rules -> 1 wildcard + keep sqrt)
  // -------------------------
  ["squareroot(%)", "\\sqrt{$1}"],
  ["cbrt", "\\sqrt[3]{x}"],           // cbrt -> ∛x
  ["cbrt(", "\\sqrt[3]{x}"],          // cbrt( -> ∛x (trigger support)
  ["cbrt(%)", "\\sqrt[3]{$1}"],       // cbrt(x)
  ["cbrt (%)", "\\sqrt[3]{$1}"],      // cbrt (x) -> avoid double parens
  ["cbrt %", "\\sqrt[3]{$1}"],        // cbrt x -> ∛x (Space support)
  ["cuberoot(%)", "\\sqrt[3]{$1}"],   // "cuberoot" override
  ["cuberoot", "\\sqrt[3]{x}"],       
  ["root3", "\\sqrt[3]{x}"],
  ["root3(%)", "\\sqrt[3]{$1}"],
  ["cube root(%)", "\\sqrt[3]{$1}"],  // Explicit space rule
  ["%root(%)", "\\sqrt{$1}"],         // square root(x), squareroot(x) -> √ (Keeping as legacy but might need check)
  ["sqrt(%)", "\\sqrt{$1}"],
  ["sqrt (%)", "\\sqrt{$1}"],         // sqrt (x) -> avoid double parens
  ["sqrt %", "\\sqrt{$1}"],           // sqrt x -> √x (Space support)
  ["sqrt", "\\sqrt{x}"],              // sqrt -> √x
  ["sqrt(", "\\sqrt{x}"],             // sqrt( -> √x (trigger support)

  // -------------------------
  // Logarithms (Variable base shortcuts)
  // -------------------------
  // "log10 30" -> \log_{10}(30)
  ["log% %", "\\log_{$1}($2)"], 
  ["log %", "\\log($1)"],           // log x -> log(x)
  ["ln %", "\\ln($1)"],             // ln x -> ln(x)
  ["lg %", "\\log_{10}($1)"],       // lg x -> log_10(x)

  // -------------------------
  // Vectors (Explicit rules only - avoid wildcard prefix issues)
  // -------------------------
  ["vector(%)", "\\overrightarrow{$1}"],
  ["Vector(%)", "\\overrightarrow{$1}"],
  ["vec(%)", "\\overrightarrow{$1}"],
  ["vec (%)", "\\overrightarrow{$1}"], // vec (AB)
  ["Vec(%)", "\\overrightarrow{$1}"],
  ["vec %", "\\overrightarrow{$1}"], // vec AB
  ["vec%", "\\overrightarrow{$1}"],  // vecAB
  
  // Hats and Bars (Generic)
  ["hat(%)", "\\hat{$1}"],
  ["hat (%)", "\\hat{$1}"], // hat (a)
  ["hat %", "\\hat{$1}"],  // hat a
  ["hat%", "\\hat{$1}"],   // hata
  ["hat", ["\\hat{a}", "\\hat{v}", "\\hat{\\imath}", "\\hat{\\jmath}"]], // Common physics vectors
  
  ["bar(%)", "\\bar{$1}"],
  ["bar (%)", "\\bar{$1}"], // bar (a)
  ["bar %", "\\bar{$1}"],  // bar a
  ["bar%", "\\bar{$1}"],   // bara
  ["bar", ["\\bar{x}", "\\bar{z}", "\\bar{active}"]],

  // Sums
  // Specific rules WITH terms (to prevent greedy match swallowing the term into the limit)
  ["sum from % to % (%)", "\\sum_{$1}^{$2} ($3)"],
  ["sum % to % (%)", "\\sum_{$1}^{$2} ($3)"],
  ["sum % % (%)", "\\sum_{$1}^{$2} ($3)"],

  ["sum from % to %", "\\sum_{$1}^{$2}"],
  ["sum % to %", "\\sum_{$1}^{$2}"],
  ["sum % %", "\\sum_{$1}^{$2}"], // sum n=1 10
  
  ["sum", ["\\sum", "\\sum_{n=1}^{\\infty}", "\\sum_{i=0}^{n}"]], // Offer variations
  ["summation", ["\\sum", "\\sum_{n=1}^{\\infty}", "\\sum_{i=0}^{n}"]],
  ["%SUM%", "\\sum_{$1}^{$2}"],
  // "mod" matched here or at the end. Removed duplicate here.

  // -------------------------
  // Derivatives (keep explicit ones)
  // -------------------------
  ["diff", "\\frac{d}{dx}"],          // diff -> d/dx operator
  ["differentiation", "\\frac{d}{dx}"],
  ["derive", "\\frac{d}{dx}"],
  
  ["dy/dx", "\\frac{dy}{dx}"],
  ["dydx", "\\frac{dy}{dx}"],
  ["dy", ["\\frac{dy}{dx}", "dy"]],   // suggest derivative OR just "dy" differential
  ["dx", ["dx", "\\frac{d}{dx}"]],    // suggest differential OR derivative operator
  
  ["f'(x)", "f'(x)"],                 // Keep prime notation as prime notation
  ["f''(x)", "f''(x)"],
  ["f\"(x)", "f''(x)"],               // Double quote support
  ["f'''(x)", "f'''(x)"],
  ["f'", "f'"],
  ["f", ["f(x)", "f'(x)", "f''(x)"]], // Suggest function forms for 'f'
  
  ["y'", "y'"],                       // Standard prime notation
  ["y''", "y''"],
  ["y\"", "y''"],
  ["y", ["y", "y(x)", "y'"]],         // Suggest y(x) or y' for 'y'

  ["d2ydx2", "\\frac{d^{2}y}{dx^{2}}"],
  ["d2y", "\\frac{d^{2}y}{dx^{2}}"],
  ["d^2y", "\\frac{d^{2}y}{dx^{2}}"],

  // General "d%" stays last in derivative section
  // d(something) -> d/dx(something)
  ["d(%)", "\\frac{d}{dx}($1)"],      
  // d<var> -> d<var>/dx or just d<var>
  ["d%", ["\\frac{d$1}{dx}", "d$1"]],

  // -------------------------
  // Vectors (2 rules -> 1 wildcard)
  // -------------------------
  // Removed duplicate %ec rule here (it is present below in its own section if I recall, wait let's check input)
  // Actually, in the read_file output, it appeared twice. 
  // Line 186: ["%ec(%)", "\\overrightarrow{$1}"], 
  // Line 147: ["%ec(%)", "\\overrightarrow{$1}"],
  // I will just remove this block if it duplicates.
  // The first block (line 147 in original/previous context) was near Roots/Sums.
  // The second block (line 186) was after derivatives.
  // I'll keep the one after derivatives as it seems to be the "original" location in the flow.

  // -------------------------
  // Roots definitions moved up
  // -------------------------


  // -------------------------
  // Exponents (general; keep specific first)
  // -------------------------
  ["x2", "x^{2}"],
  ["x3", "x^{3}"],  ["e^(%)", "e^{$1}"],
  ["exp(%)", "e^{$1}"],     // exp(x) -> e^x  ["%^2", "{$1}^{2}"],
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
  ["subset", ["\\subseteq", "\\subset"]], // Default to subseteq often preferred
  ["approx", "\\approx"],
  ["app", "\\approx"],

  // integrals (case-insensitive already)
  ["int", ["\\int", "\\int_{a}^{b}"]],   // Suggest simple integral first, then definite
  
  ["integral", ["\\int", "\\int_{a}^{b}"]],
  ["integrate", ["\\int", "\\int_{a}^{b}"]],
  ["defint", "\\int_{a}^{b}"],           // Explicit definite integral shortcuts
  ["dint", "\\int_{a}^{b}"],             
  ["intab", "\\int_{a}^{b}"],            
  ["intlimits", "\\int_{a}^{b}"],
  
  // Smart Patterns (ORDER MATTERS: most specific first)
  // "int from 0 to 10"
  ["int from % to %", "\\int_{$1}^{$2}"], 
  // "int_0^10"
  ["int_%^%", "\\int_{$1}^{$2}"],         
  
  // "int0 10" -> ∫_0^10 (Intuitive shorthand: lower upper)
  ["int% %", "\\int_{$1}^{$2}"],

  // "int0" -> ∫_0^x (Intuitive shorthand: lower only -> assume x is upper)
  // Must come after specific keywords like "integral" to avoid greedy match
  ["int%", "\\int_{$1}^{x}"],

  // multiplication (I recommend removing ["x","\\times"] if x is usually a variable)
  ["x", ["{x}", "x^{2}", "x^{3}", "x^{n}", "\\times"]], // x variable preferred, but times is an option
  ["times", "\\times"],
  ["time", "\\times"],
  ["mult", "\\times"],
  ["multiply", "\\times"],
  ["*", "\\times"],
  ["×", "\\times"],
  ["dot", "\\cdot"],

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
  ["Sin", ["\\sin(x)", "\\sin(\\theta)", "\\sin^2(\\theta)", "\\sin^{-1}(\\theta)"]],
  ["Sin^", ["\\sin^2(\\theta)", "\\sin^{-1}(\\theta)", "\\sin(\\theta)^2", "\\sin(\\theta)^{-1}"]],
  ["sin(%)", "\\sin($1)"],
  ["sin (%)", "\\sin($1)"],         // sin (x) -> avoiding double parens
  ["sin^2(%)", "\\sin^{2}($1)"],
  ["sin^-1(%)", "\\sin^{-1}($1)"],
  ["sin %", "\\sin($1)"],           // sin x (Space support)
  ["asin(%)", "\\sin^{-1}($1)"],    // asin(x)
  ["arcsin(%)", "\\sin^{-1}($1)"],  // arcsin(x)

  ["Cos", ["\\cos(x)", "\\cos(\\theta)", "\\cos^2(\\theta)", "\\cos^{-1}(\\theta)"]],
  ["Cos^", ["\\cos^2(\\theta)", "\\cos^{-1}(\\theta)", "\\cos(\\theta)^2", "\\cos(\\theta)^{-1}"]],
  ["cos(%)", "\\cos($1)"],
  ["cos (%)", "\\cos($1)"],       // cos (x) -> avoiding double parens
  ["cos^2(%)", "\\cos^{2}($1)"],
  ["cos^-1(%)", "\\cos^{-1}($1)"],
  ["cos %", "\\cos($1)"],           // cos x (Space support)
  ["acos(%)", "\\cos^{-1}($1)"],    // acos(x)
  ["arccos(%)", "\\cos^{-1}($1)"],  // arccos(x)

  ["Tan", ["\\tan(x)", "\\tan(\\theta)", "\\tan^2(\\theta)", "\\tan^{-1}(\\theta)"]],
  ["Tan^", ["\\tan^2(\\theta)", "\\tan^{-1}(\\theta)", "\\tan(\\theta)^2", "\\tan(\\theta)^{-1}"]],
  ["tan(%)", "\\tan($1)"],
  ["tan (%)", "\\tan($1)"],       // tan (x) -> avoiding double parens
  ["tan^2(%)", "\\tan^{2}($1)"],
  ["tan^-1(%)", "\\tan^{-1}($1)"],
  ["tan %", "\\tan($1)"],           // tan x (Space support)
  ["atan(%)", "\\tan^{-1}($1)"],    // atan(x)
  ["arctan(%)", "\\tan^{-1}($1)"],  // arctan(x)

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
  ["bar", ["\\bar{a}", "\\bar{b}"]],

  // -------------------------
  // Fractions (Matches last to act as fallback - but now prioritized in split)
  // -------------------------
  // We keep explicit keywords, but remove greedy %/% if it causes trouble.
  // Actually, split handles fractions now, so we can probably comment out greedy %/%.
  // BUT we need it for short patterns "1/2" if split fails or for single units.
  // Let's refine it to be less greedy: NO parens allowed in parts for simple regex match.
  // This pushes complex fraction handling to the recursive split.
  ["%over%", "\\frac{$1}{$2}"],
  ["%divide%", "\\frac{$1}{$2}"],
  ["mod", "\\left|x\\right|"]
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
 * Finds the index of a top-level operator (+, -, =) in the string
 * respecting parenthesis/braces balance.
 * Returns -1 if no suitable split found.
 */
function findTopLevelSplit(str) {
  let depth = 0;
  // prioritize × same as *
  // Added '/' for Fraction support (Priority 4)
  const priorities = { '=': 1, '+': 2, '-': 2, '*': 3, '×': 3, '/': 4 };
  let bestIdx = -1;
  let bestPriority = 0; 
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(' || char === '{' || char === '[') depth++;
    else if (char === ')' || char === '}' || char === ']') depth--;
    else if (depth === 0) {
       if (priorities[char]) {
         const p = priorities[char];
         // Logic: prefer '=' (lowest priority value 1) over '+' (2).
         // If prioritize same-level, we can just keep the first one found or last one.
         // Keeping the first one splits a + b + c into a and b+c.
         if (bestIdx === -1 || p < bestPriority) {
            bestIdx = i;
            bestPriority = p;
         }
       }
    }
  }
  return bestIdx;
}

/**
 * Get top LaTeX suggestions (1 or more) for a math input.
 * @param {string} input
 * @param {number} maxSuggestions - max number of suggestions to return
 * @returns {string[]} Array of LaTeX strings
 */
export function getLatexSuggestions(input, maxSuggestions = 5) {
  if (typeof input !== 'string') return [input];
  const trimmed = input.trim();
  if (!trimmed) return [''];

  // Check for atomic sentences that look like they contain operators (=) but shouldn't be split.
  // E.g. "sum from n=1 to 10" contains '=', but it is part of the user's limit definition.
  const atomicPatterns = [
    /^sum\s+from\s+/i,
    /^int\s+from\s+/i,
    /^sum\s+.+=/i,      // sum n=1 ...
    /^int\s+.+=/i,
  ];
  const isAtomic = atomicPatterns.some(p => p.test(trimmed));

  // 1. Try to split by top-level operators (+, -, =)
  // Skip if we flagged it as atomic.
  let splitIdx = -1; 
  if (!isAtomic) {
    splitIdx = findTopLevelSplit(trimmed);
  }

  if (splitIdx !== -1) {
    const left = trimmed.slice(0, splitIdx);
    const op = trimmed[splitIdx];
    const right = trimmed.slice(splitIdx + 1);
    
    // Recurse on parts
    // TRIM parts to ensure regex matching works correctly (e.g. "log(...) " vs "log(...)")
    // Use a small limit (e.g. 3) to allow mixing and matching best suggestions
    const limit = 3; 
    const leftSugs = getLatexSuggestions(left, limit);
    const rightSugs = getLatexSuggestions(right, limit);
    
    let opLatex = op;
    if (op === '*') opLatex = '\\times';
    if (op === '×') opLatex = '\\times';
    
    // Generate combinations (Cartesian product)
    const distinct = new Set();
    const results = [];
    
    for (const l of leftSugs) {
      for (const r of rightSugs) {
        let combined;
        // Special case for Fraction
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

  // 2. Try RULES
  let baseSuggestions = [];
  let foundRule = false;

  for (const rule of COMPILED_RULES) {
    const match = trimmed.match(rule.regex);
    if (match) {
      foundRule = true;
      let suggestions = Array.isArray(rule.replacement) 
        ? rule.replacement 
        : [rule.replacement];

      // Apply wildcards if needed
      if (rule.isWildcard) {
        suggestions = suggestions.map(template => {
          let result = template;
          for (let i = 1; i < match.length; i++) {
            // RECURSIVE wildcard expansion
            const subInput = match[i];
            const subLatex = mathToLatex(subInput); 
            result = result.split(`$${i}`).join(subLatex);
          }
          return result;
        });
      }
      baseSuggestions = suggestions;
      break; // Stop at first match (rules are ordered by priority)
    }
  }

  if (!foundRule) {
    baseSuggestions = [trimmed];
  }

  // 3. Augment with Logical Variations (Prediction)
  // If the input is simple (alphanumeric, no complex latex), offer variations.
  // Avoid augmenting if it's already a complex LaTeX command (starts with \)
  // or if it matched a "Function" rule like 'sin', 'log' which usually don't get hats/sqrts.
  const isSimpleTerm = /^[a-zA-Z0-9]+$/.test(trimmed) && !trimmed.startsWith('\\');
  
  // Naughty list of words we shouldn't augment because they are commands
  const commandBlacklist = new Set([
      'sin', 'cos', 'tan', 'csc', 'sec', 'cot', 
      'log', 'ln', 'lg', 'exp', 'det', 'dim', 'lim',
      'min', 'max', 'deg', 'gcd', 'primes', 'sup', 'inf',
      'int', 'sum', 'prod', 'lim', 'mod', 'pi', 'theta', 'alpha', 'beta',
      'gamma', 'delta', 'omega', 'mu', 'lambda'
  ]);

  if (isSimpleTerm && !commandBlacklist.has(trimmed.toLowerCase())) {
     const augmentations = [
         `\\vec{${trimmed}}`,        // Vector  -> \vec{10}
         `\\hat{${trimmed}}`,        // Hat     -> \hat{10}
         `\\bar{${trimmed}}`,        // Bar     -> \bar{10}
         `\\sqrt{${trimmed}}`,       // Root    -> \sqrt{10}
         `${trimmed}^{2}`,           // Square  -> 10^2
         `\\frac{1}{${trimmed}}`,    // Inverse -> 1/10
     ];
     // Append augmentations to base suggestions
     baseSuggestions = [...baseSuggestions, ...augmentations];
  }

  // Deduplicate and correct format
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


/**
 * Backward-compatible single-output function (your original interface)
 * Returns the FIRST suggestion only.
 */
export function mathToLatex(input) {
  // Pass input directly; getLatexSuggestions will handle trimming if needed for matching
  // but we might want to preserve behavior? 
  // Actually, getLatexSuggestions trims now.
  const suggestions = getLatexSuggestions(input, 1);
  return suggestions[0];
}