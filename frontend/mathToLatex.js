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

  // Single variables (suggest powers including cube root)
  ["x", ["x", "x^{1/3}", "x^{2}", "x^{3}", "x^{n}"]],
  ["y", ["y", "y^{1/3}", "y^{2}", "y^{3}", "y^{n}"]],
  ["z", ["z", "z^{1/3}", "z^{2}", "z^{3}", "z^{n}"]],
  ["a", ["a", "a^{1/3}", "a^{2}", "a^{3}", "a^{n}"]],
  
  // Exponents
  ["sin%2", ["\\sin^{2}($1)", "\\sin($1^2)"]],
  ["cos%2", ["\\cos^{2}($1)", "\\cos($1^2)"]],
  ["tan%2", ["\\tan^{2}($1)", "\\tan($1^2)"]],
  ["csc%2", ["\\csc^{2}($1)", "\\csc($1^2)"]],
  ["sec%2", ["\\sec^{2}($1)", "\\sec($1^2)"]],
  ["cot%2", ["\\cot^{2}($1)", "\\cot($1^2)"]],

  ["sin%3", ["\\sin^{3}($1)", "\\sin($1^3)"]],
  ["cos%3", ["\\cos^{3}($1)", "\\cos($1^3)"]],
  ["tan%3", ["\\tan^{3}($1)", "\\tan($1^3)"]],
  ["csc%3", ["\\csc^{3}($1)", "\\csc($1^3)"]],
  ["sec%3", ["\\sec^{3}($1)", "\\sec($1^3)"]],
  ["cot%3", ["\\cot^{3}($1)", "\\cot($1^3)"]],

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
  ["sin(%o)", "\\sin($1^{\\circ})"],
  ["cos(%o)", "\\cos($1^{\\circ})"],
  ["tan(%o)", "\\tan($1^{\\circ})"],
  ["csc(%o)", "\\csc($1^{\\circ})"],
  ["cosec(%o)", "\\csc($1^{\\circ})"],
  ["sec(%o)", "\\sec($1^{\\circ})"],
  ["cot(%o)", "\\cot($1^{\\circ})"],
  ["\\sin(%o)", "\\sin($1^{\\circ})"],
  ["\\cos(%o)", "\\cos($1^{\\circ})"],
  ["\\tan(%o)", "\\tan($1^{\\circ})"],
  ["\\csc(%o)", "\\csc($1^{\\circ})"],
  ["\\sec(%o)", "\\sec($1^{\\circ})"],
  ["\\cot(%o)", "\\cot($1^{\\circ})"],
  
  ["sin%o", "\\sin($1^{\\circ})"],
  ["cos%o", "\\cos($1^{\\circ})"],
  ["tan%o", "\\tan($1^{\\circ})"],
  ["csc%o", "\\csc($1^{\\circ})"],
  ["cosec%o", "\\csc($1^{\\circ})"],
  ["sec%o", "\\sec($1^{\\circ})"],
  ["cot%o", "\\cot($1^{\\circ})"],
  ["\\sin%o", "\\sin($1^{\\circ})"],
  ["\\cos%o", "\\cos($1^{\\circ})"],
  ["\\tan%o", "\\tan($1^{\\circ})"],
  ["\\csc%o", "\\csc($1^{\\circ})"],
  ["\\sec%o", "\\sec($1^{\\circ})"],
  ["\\cot%o", "\\cot($1^{\\circ})"],
  
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
  ["%pi", "\\pi"],
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

  // Cosecant (csc/cosec)
  ["\\csc(%)", "\\csc($1)"],
  ["\\csc (%)", "\\csc($1)"],
  ["\\csc", ["\\csc(x)", "\\csc(\\theta)"]],
  ["\\csc %", "\\csc($1)"],
  ["csc(%)", "\\csc($1)"],
  ["csc (%)", "\\csc($1)"],
  ["csc %", "\\csc($1)"],
  ["csc", ["\\csc(x)", "\\csc(\\theta)"]],
  ["cosec(%)", "\\csc($1)"],
  ["cosec (%)", "\\csc($1)"],
  ["cosec %", "\\csc($1)"],
  ["cosec", ["\\csc(x)", "\\csc(\\theta)"]],

  // Secant (sec)
  ["\\sec(%)", "\\sec($1)"],
  ["\\sec (%)", "\\sec($1)"],
  ["\\sec", ["\\sec(x)", "\\sec(\\theta)"]],
  ["\\sec %", "\\sec($1)"],
  ["sec(%)", "\\sec($1)"],
  ["sec (%)", "\\sec($1)"],
  ["sec %", "\\sec($1)"],
  ["sec", ["\\sec(x)", "\\sec(\\theta)"]],

  // Cotangent (cot)
  ["\\cot(%)", "\\cot($1)"],
  ["\\cot (%)", "\\cot($1)"],
  ["\\cot", ["\\cot(x)", "\\cot(\\theta)"]],
  ["\\cot %", "\\cot($1)"],
  ["cot(%)", "\\cot($1)"],
  ["cot (%)", "\\cot($1)"],
  ["cot %", "\\cot($1)"],
  ["cot", ["\\cot(x)", "\\cot(\\theta)"]],

  ["Sin(pi)", ["\\sin( \\frac{\\pi }{6})", "\\sin( \\frac{\\pi }{4})", "\\sin( \\frac{\\pi }{3})", "\\sin( \\frac{\\pi }{2})", "\\sin( \\pi)"]],
  ["Sin(2", ["\\sin( 2\\pi)", "\\sin( \\frac{2\\pi }{3})"]],
  ["Sin(3", ["\\sin( \\frac{3\\pi }{4})", "\\sin( \\frac{3\\pi }{2})"]],
  ["Sin(5", ["\\sin( \\frac{5\\pi }{3})", "\\sin( \\frac{5\\pi }{6})"]],
  ["Sin2", ["\\sin( 2\\pi)", "\\sin( \\frac{2\\pi }{3})"]],
  ["Sin3", ["\\sin( \\frac{3\\pi }{4})", "\\sin( \\frac{3\\pi }{2})"]],
  ["Sin5", ["\\sin( \\frac{5\\pi }{3})", "\\sin( \\frac{5\\pi }{6})"]],

  ["Cos(pi)", ["\\cos( \\frac{\\pi }{6})", "\\cos( \\frac{\\pi }{4})", "\\cos( \\frac{\\pi }{3})", "\\cos( \\frac{\\pi }{2})", "\\cos( \\pi)"]],
  ["Cos(2", ["\\cos( 2\\pi)", "\\cos( \\frac{2\\pi }{3})"]],
  ["Cos(3", ["\\cos( \\frac{3\\pi }{4})", "\\cos( \\frac{3\\pi }{2})"]],
  ["Cos(5", ["\\cos( \\frac{5\\pi }{3})", "\\cos( \\frac{5\\pi }{6})"]],
  ["Cos2", ["\\cos( 2\\pi)", "\\cos( \\frac{2\\pi }{3})"]],
  ["Cos3", ["\\cos( \\frac{3\\pi }{4})", "\\cos( \\frac{3\\pi }{2})"]],
  ["Cos5", ["\\cos( \\frac{5\\pi }{3})", "\\cos( \\frac{5\\pi }{6})"]],

  ["Tan(pi)", ["\\tan( \\frac{\\pi }{6})", "\\tan( \\frac{\\pi }{4})", "\\tan( \\frac{\\pi }{3})", "\\tan( \\frac{\\pi }{2})", "\\tan( \\pi)"]],
  ["Tan(2", ["\\tan( 2\\pi)", "\\tan( \\frac{2\\pi }{3})"]],
  ["Tan(3", ["\\tan( \\frac{3\\pi }{4})", "\\tan( \\frac{3\\pi }{2})"]],
  ["Tan(5", ["\\tan( \\frac{5\\pi }{3})", "\\tan( \\frac{5\\pi }{6})"]],
  ["Tan2", ["\\tan( 2\\pi)", "\\tan( \\frac{2\\pi }{3})"]],
  ["Tan3", ["\\tan( \\frac{3\\pi }{4})", "\\tan( \\frac{3\\pi }{2})"]],
  ["Tan5", ["\\tan( \\frac{5\\pi }{3})", "\\tan( \\frac{5\\pi }{6})"]],

  ["hat", ["\\hat{a}", "\\hat{b}"]],
  ["bar", ["\\bar{a}", "\\bar{b}"]],

  // Fractions
  ["%over%", "\\frac{$1}{$2}"],
  ["%divide%", "\\frac{$1}{$2}"],
  ["mod", "\\left|x\\right|"],

  // Function-squared
  ["sin%2", "\\sin^{2}($1)"],
  ["cos%2", "\\cos^{2}($1)"],
  ["tan%2", "\\tan^{2}($1)"],
  ["csc%2", "\\csc^{2}($1)"],
  ["sec%2", "\\sec^{2}($1)"],
  ["cot%2", "\\cot^{2}($1)"],

  // Exponent inside parentheses: sin(x^2) → \sin(x^2)
  ["sin%2", ["\\sin^{2}($1)", "\\sin($1^2)"]],
  ["cos%2", ["\\cos^{2}($1)", "\\cos($1^2)"]],
  ["tan%2", ["\\tan^{2}($1)", "\\tan($1^2)"]],
  ["csc%2", ["\\csc^{2}($1)", "\\csc($1^2)"]],
  ["sec%2", ["\\sec^{2}($1)", "\\sec($1^2)"]],
  ["cot%2", ["\\cot^{2}($1)", "\\cot($1^2)"]]
];

// ============================================================================
// TRIGONOMETRY SYSTEM - Smart trig function detection and suggestion
// ============================================================================

const TRIG_CONFIG = {
  // Core trigonometric functions
  functions: ['sin', 'cos', 'tan', 'csc', 'cosec', 'sec', 'cot'],
  
  // Common argument suggestions
  arguments: [
    'x',
    '\\theta',
    '\\alpha',
    '\\beta',
    '\\gamma',
    '\\pi',
    '\\frac{\\pi}{6}',
    '\\frac{\\pi}{4}',
    '\\frac{\\pi}{3}',
    '\\frac{\\pi}{2}',
    '\\frac{2\\pi}{3}',
    '\\frac{3\\pi}{4}',
    '\\frac{5\\pi}{6}',
    '\\frac{3\\pi}{2}'
  ],
  
  // Modifiers that can apply to trig functions
  modifiers: {
    '^-1': { latex: '^{-1}', label: 'inverse' },
    '^2': { latex: '^{2}', label: 'squared' },
    '^2': { latex: '^{2}', label: 'squared' },
    '^3': { latex: '^{3}', label: 'cubed' },
    '^n': { latex: '^{n}', label: 'nth power' }
  }
};

/**
 * Parse a trig expression to extract function, modifiers, and argument
 * Examples: "sin", "sin(", "sin^-1", "cos(theta", "tan^2(pi/4)"
 */
function parseTrigExpression(input) {
  const normalized = input.toLowerCase().trim();
  
  // Match patterns: func[modifiers](args)
  // Examples: sin, sin^-1, sin(theta, sin^2(pi/6
  const patterns = [
    // With modifiers and arguments: sin^-1(theta
    /^(?:\\)?(sin|cos|tan|csc|cosec|sec|cot)((?:\^\{?-?1\}?|\^2|\^3|\^n)?)\s*\(\s*(.*)$/i,
    // With modifiers and pi/fraction inline: sin^2pi/6, sinpi/4, sin2pi/3
    /^(?:\\)?(sin|cos|tan|csc|cosec|sec|cot)((?:\^\{?-?1\}?|\^2|\^3|\^n)?)\s*(\d*(?:\\pi|π|pi)(?:\/\d+)?|\d*(?:\\pi|π|pi)\s*\/\s*\d+)$/i,
    // With modifiers and inline arguments: sin^2x, sin2x, cos3\theta
    /^(?:\\)?(sin|cos|tan|csc|cosec|sec|cot)((?:\^\{?-?1\}?|\^2|\^3|\^n)?)\s*([a-z0-9\\πθ]+)$/i,
    // With modifiers, no args: sin^-1, sin^2
    /^(?:\\)?(sin|cos|tan|csc|cosec|sec|cot)((?:\^\{?-?1\}?|\^2|\^3|\^n)?)\s*$/i,
    // With arguments, no modifiers: sin(theta
    /^(?:\\)?(sin|cos|tan|csc|cosec|sec|cot)\s*\(\s*(.*)$/i,
    // Just function: sin, cos
    /^(?:\\)?(sin|cos|tan|csc|cosec|sec|cot)\s*$/i
  ];
  
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const func = match[1].toLowerCase();
      const modifier = match[2] || '';
      let arg = match[3] || '';
      // Strip a trailing closing parenthesis if the regex captured it
      if (typeof arg === 'string') {
        arg = arg.trim();
        if (arg.endsWith(')')) arg = arg.slice(0, -1).trim();
      }
      
      return {
        function: func,
        modifier: modifier,
        argument: arg,
        isComplete: false,
        matched: true
      };
    }
  }
  
  return { matched: false };
}

/**
 * Generate trig suggestions based on parsed expression
 */
function generateTrigSuggestions(parsed, maxSuggestions = 5) {
  if (!parsed.matched) return [];
  
  const { function: func, modifier, argument } = parsed;
  const normalizedFunc = func === 'cosec' ? 'csc' : func;
  const latexFunc = `\\${normalizedFunc}`;
  
  // Normalize modifier
  let modifierLatex = '';
  if (modifier) {
    if (modifier.includes('-1') || modifier === '^-1') {
      modifierLatex = '^{-1}';
    } else if (modifier === '^2') {
      modifierLatex = '^{2}';
    } else if (modifier === '^3') {
      modifierLatex = '^{3}';
    }
  }
  
  const suggestions = [];
  
  // If we have a partial argument, suggest completions
  if (argument) {
    const rawArg = String(argument).trim();

    const inlineCoeffMatch = rawArg.match(/^(\d+)(\\[a-zA-Z]+|[a-zA-Z]|π|θ)$/);
    if (inlineCoeffMatch) {
      const coeff = inlineCoeffMatch[1];
      const varToken = inlineCoeffMatch[2];
      const key = varToken.replace(/^\\/, '').toLowerCase();
      const map = {
        'theta': '\\theta',
        'θ': '\\theta',
        'x': 'x',
        't': 't',
        'alpha': '\\alpha',
        'beta': '\\beta',
        'gamma': '\\gamma',
        'pi': '\\pi',
        'π': '\\pi'
      };
      const mapped = map[key] || varToken;
      const direct = `${latexFunc}${modifierLatex}(${coeff}${mapped})`;

      if (!modifierLatex && Number.isFinite(Number(coeff)) && Number(coeff) >= 2) {
        const power = `${latexFunc}^{${coeff}}(${mapped})`;
        return [direct, power].slice(0, maxSuggestions);
      }

      return [direct];
    }

    // Directly handle common pi/fraction forms like pi/6, \pi/3, π/4, 2pi/3
    const piMatch = rawArg.match(/^(?:([0-9]+)\s*)?(?:\\pi|π|pi)(?:\s*\/\s*([0-9]+))?$/i);
    if (piMatch) {
      const num = piMatch[1] ? Number(piMatch[1]) : 1;
      const den = piMatch[2] ? Number(piMatch[2]) : null;
      const suggestions = [];
      
      if (den) {
        // Fraction form - sin(pi/6) as \sin(\frac{\pi}{6})
        if (num === 1) {
          suggestions.push(`${latexFunc}${modifierLatex}(\\frac{\\pi}{${den}})`);
        } else {
          suggestions.push(`${latexFunc}${modifierLatex}(\\frac{${num}\\pi}{${den}})`);
        }
        // Function applied to pi, then divided as fraction: \frac{\sin(\pi)}{6}
        if (num === 1) {
          suggestions.push(`\\frac{${latexFunc}${modifierLatex}(\\pi)}{${den}}`);
        } else {
          suggestions.push(`\\frac{${latexFunc}${modifierLatex}(${num}\\pi)}{${den}}`);
        }
      } else {
        // No denominator
        if (num === 1) {
          suggestions.push(`${latexFunc}${modifierLatex}(\\pi)`);
        } else {
          suggestions.push(`${latexFunc}${modifierLatex}(${num}\\pi)`);
          suggestions.push(`${latexFunc}${modifierLatex}(${num} \\cdot \\pi)`);
        }
      }
      
      return suggestions.slice(0, maxSuggestions);
    }

    // Handle theta and common variable names (θ, theta, t)
    const thetaMatch = rawArg.match(/^(?:\\theta|θ|theta|x|t|alpha|beta|gamma)$/i);
    if (thetaMatch) {
      // map plain names to LaTeX forms
      const map = {
        'theta': '\\theta',
        'θ': '\\theta',
        'x': 'x',
        't': 't',
        'alpha': '\\alpha',
        'beta': '\\beta',
        'gamma': '\\gamma'
      };
      const key = rawArg.replace(/\\/g, '').toLowerCase();
      const mapped = map[key] || rawArg;
      return [`${latexFunc}${modifierLatex}(${mapped})`];
    }

    // Fallback: try fuzzy-match against configured arguments (normalize both)
    const lowerArg = rawArg.toLowerCase().replace(/\\/g, '').replace(/[{}\\]/g, '').replace(/\s+/g, '');
    const completedArgs = TRIG_CONFIG.arguments
      .filter(a => {
        const norm = a.toLowerCase().replace(/\\/g, '').replace(/[{}\\]/g, '').replace(/\s+/g, '');
        return norm.includes(lowerArg) || lowerArg.includes(norm);
      })
      .slice(0, maxSuggestions);
    
    return completedArgs.map(arg => `${latexFunc}${modifierLatex}(${arg})`);
  }
  
  // If no argument yet, suggest common arguments
  return TRIG_CONFIG.arguments
    .slice(0, maxSuggestions)
    .map(arg => `${latexFunc}${modifierLatex}(${arg})`);
}

/**
 * Check if input looks like a trig function and return suggestions
 */
function getTrigSuggestions(input, maxSuggestions = 5) {
  const parsed = parseTrigExpression(input);
  if (!parsed.matched) return [];
  
  return generateTrigSuggestions(parsed, maxSuggestions);
}

// ============================================================================

// Compile rules
function compileRules(rules) {
  const compiled = [];
  for (const [pattern, replacement] of rules) {
    if (pattern.includes('%')) {
      // For wildcards, escape everything except % which becomes (.+)
      let escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      escaped = escaped.replace(/%/g, '(.+)');
      const regex = new RegExp(`^${escaped}$`, 'i');
      compiled.push({ regex, replacement, isWildcard: true, pattern });
    } else {
      // For non-wildcards, escape all special regex chars including backslash
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escaped}$`, 'i');
      compiled.push({ regex, replacement, isWildcard: false, pattern });
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

  // Don't suggest alternatives for basic math symbols - return as-is
  const basicSymbols = ['+', '-', '=', 'x'];
  if (basicSymbols.includes(trimmed)) {
    return [trimmed];
  }

  // MathLive sometimes escapes ^ as \textasciicircum (text mode). Normalize back.
  trimmed = trimmed.replace(/\\textasciicircum/g, '^');

  // Some renderers output \textasteriskcentered or \ast for a centered asterisk — treat as multiplication
  trimmed = trimmed.replace(/\\textasteriskcentered/g, '*').replace(/\\ast\b/g, '*');

  // If user typed a leading multiplication symbol before a function (e.g. "\textasteriskcentered cos(...)"),
  // strip it so trig detection sees the function at the start.
  trimmed = trimmed.replace(/^\*\s*(?=\\|[a-zA-Zπθ])/i, '');

  // Normalize \cdot, \times and centered dots early so trig detection sees '*' separators
  trimmed = trimmed
    .replace(/\\cdot(?!s)/g, '*')
    .replace(/\\times/g, '*')
    .replace(/[·⋅]/g, '*');

  // Remove \left and \right which commonly wrap parentheses in LaTeX output
  trimmed = trimmed.replace(/\\left/g, '').replace(/\\right/g, '');

  // Try smart trigonometry detection before inserting implicit multiplication.
  // This preserves inline forms like "sin2x" -> "sin(2x)" or "sin^2(x)".
  const earlyTrigSuggestions = getTrigSuggestions(trimmed, maxSuggestions);
  if (earlyTrigSuggestions.length > 0) {
    console.debug('[mathToLatex] input="%s" source=%s suggestions=%o', input, 'SMART_TRIG_INLINE', earlyTrigSuggestions);
    return earlyTrigSuggestions;
  }

  // Insert implicit multiplication for cases like "8cos(...)", "2x", "3\pi"
  function insertImplicitMultiplication(s) {
    if (!s || typeof s !== 'string') return s;
    let out = s;

    // 1) Digit or closing paren followed immediately by a backslash (\sin) or letter (cos) or π/pi/θ
    out = out.replace(/([0-9\)\}\]])\s*(?=\\|[a-zA-Zπθ])/g, '$1*');

    // 2) Digit immediately followed by 'pi' or 'π' without operator:  "2pi" -> "2*pi"
    out = out.replace(/([0-9])\s*(?=(?:\\pi|π|pi))/gi, '$1*');

    // 3) Treat lowercase 'x' as multiplication when it follows a number or closing paren
    //    e.g. "8xcos" -> "8*xcos" then rule (1) will insert between x and cos if needed
    out = out.replace(/([0-9\)\}\]])\s*x(?=\\|[a-zA-Zπθ\(]|$)/g, '$1*');

    // 4) If 'x' is used between two numeric/paren/function tokens like "2x3" or ")x("
    out = out.replace(/([0-9\)\}\]])\s*x\s*([0-9\\(\{\[])/g, '$1*$2');

    return out;
  }

  trimmed = insertImplicitMultiplication(trimmed);

  // Try smart trigonometry detection after normalization
  const trigSuggestions = getTrigSuggestions(trimmed, maxSuggestions);
  if (trigSuggestions.length > 0) {
    console.debug('[mathToLatex] input="%s" source=%s suggestions=%o', input, 'SMART_TRIG', trigSuggestions);
    return trigSuggestions;
  }

  const normalized = normalizeForMatching(trimmed);
  const inverseSuggestions = getInverseTrigSuggestions(normalized);
  if (inverseSuggestions.length > 0) {
    const out = inverseSuggestions.slice(0, maxSuggestions);
    console.debug('[mathToLatex] input="%s" source=%s suggestions=%o', input, 'INVERSE_TRIG', out);
    return out;
  }

  const trigNumberMatch = normalized.match(/^(sin|cos|tan)(-?\d+(?:\.\d+)?)(deg)?$/i);
  if (trigNumberMatch) {
    const [, func, num, degSuffix] = trigNumberMatch;
    const latexFunc = `\\${func.toLowerCase()}`;
    const base = `${latexFunc}(${num})`;
    const degree = `${latexFunc}(${num}^{\\circ})`;
    const suggestions = degSuffix ? [degree, base] : [base, degree];
    const out = suggestions.slice(0, maxSuggestions);
    console.debug('[mathToLatex] input="%s" source=%s suggestions=%o', input, 'TRIG_NUMBER', out);
    return out;
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

    const out = results.slice(0, maxSuggestions);
    console.debug('[mathToLatex] input="%s" source=%s suggestions=%o', input, 'COMPOSED', out);
    return out;
  }

  let baseSuggestions = [];
  let foundRule = false;
  let fuzzy = [];

  const variants = buildInputVariants(trimmed);
  for (const variant of variants) {
    const matchResult = matchRules(variant);
    if (matchResult.found) {
      foundRule = true;
      baseSuggestions = matchResult.suggestions;
      var matchedRulePattern = matchResult.rulePattern || null;
      break;
    }
  }

  if (!foundRule) {
    fuzzy = getFuzzySuggestions(trimmed);
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

  const out = finalResults.slice(0, maxSuggestions);
  const sourceTag = foundRule ? `RULES(${matchedRulePattern})` : (fuzzy.length > 0 ? 'FUZZY' : 'FALLBACK');
  console.debug('[mathToLatex] input="%s" source=%s suggestions=%o', input, sourceTag, out);
  return out;
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

// Export for use in app and Node
if (typeof globalThis !== 'undefined') {
  globalThis.getLatexSuggestions = getLatexSuggestions;
  globalThis.mathToLatex = mathToLatex;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getLatexSuggestions, mathToLatex };
}
