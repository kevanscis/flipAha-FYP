
(function(){
  function normalizeCommonMathTypos(input){
    let output = String(input ?? '');

    const typoPatterns = [
      { regex: /alpah|alhpa|aplha/gi, canonical: 'alpha' },
      { regex: /betha|btea/gi, canonical: 'beta' },
      { regex: /gama|gammar|gammma/gi, canonical: 'gamma' },
      { regex: /delat|detla|dalta/gi, canonical: 'delta' },
      { regex: /thetha|tetha|thta|thita|theeta/gi, canonical: 'theta' },
      { regex: /lamda|lamba|lmbda|lambada/gi, canonical: 'lambda' },
      { regex: /mew/gi, canonical: 'mu' },
      { regex: /sigam|simga|sogma/gi, canonical: 'sigma' },
      { regex: /omgea|omeag|oemga|omeega/gi, canonical: 'omega' }
    ];

    for (const entry of typoPatterns) {
      output = output.replace(entry.regex, entry.canonical);
    }

    return output;
  }

  // Export normal/general rules for centralized compilation in mathToLatex.js
  const NORMAL_RULES = [
    ["%over%", "\\frac{$1}{$2}"],
    ["%divide%", "\\frac{$1}{$2}"],
    ["pi", "\\pi"],
    ["-pi", "-\\pi"],
    ["1/root(2)", ["\\frac{1}{\\sqrt{2}}", "\\frac{\\sqrt{2}}{2}"]],
    ["1/root2", ["\\frac{1}{\\sqrt{2}}", "\\frac{\\sqrt{2}}{2}"]],
    ["1/sqrt(2)", ["\\frac{1}{\\sqrt{2}}", "\\frac{\\sqrt{2}}{2}"]],
    ["1/sqrt2", ["\\frac{1}{\\sqrt{2}}", "\\frac{\\sqrt{2}}{2}"]],
    ["1/root(3)", ["\\frac{1}{\\sqrt{3}}", "\\frac{\\sqrt{3}}{3}"]],
    ["1/root3", ["\\frac{1}{\\sqrt{3}}", "\\frac{\\sqrt{3}}{3}"]],
    ["1/sqrt(3)", ["\\frac{1}{\\sqrt{3}}", "\\frac{\\sqrt{3}}{3}"]],
    ["1/sqrt3", ["\\frac{1}{\\sqrt{3}}", "\\frac{\\sqrt{3}}{3}"]],
    ["mod", "\\left|x\\right|"],
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
    ["%^(1/2)", "\\sqrt{$1}"],
    ["%^(1/3)", "\\sqrt[3]{$1}"],
    ["%^(%/%)", "{$1}^{\\frac{$2}{$3}}"],
    ["x", ["x", "\\sqrt[3]{x}", "x^{2}", "x^{3}", "x^{n}"]],
    ["y", ["y", "\\sqrt[3]{y}", "y^{2}", "y^{3}", "y^{n}"]],
    ["z", ["z", "\\sqrt[3]{z}", "z^{2}", "z^{3}", "z^{n}"]],
    ["a", ["a", "\\sqrt[3]{a}", "a^{2}", "a^{3}", "a^{n}"]],
    ["x2", "x^{2}"],
    ["x3", "x^{3}"],
    ["e^(%)", "e^{$1}"],
    ["exp(%)", "e^{$1}"],
    ["%)^2", "$1)^{2}"],
    ["%)^{2}", "$1)^{2}"],
    ["%)2", "$1)^{2}"],
    ["%^2", "{$1}^{2}"],
    ["%^3", "{$1}^{3}"],
    ["%^(%)", "{$1}^{$2}"],
    ["%^%", "{$1}^{$2}"],
    ["<=", "\\leq"],
    [">=", "\\geq"],
    ["!=", "\\neq"],
    ["+-", "\\pm"],

    // Degree notation: 35degree, 35deg, 35° → 35°
    ["%degree", "$1^{\\circ}"],
    ["%degrees", "$1^{\\circ}"],
    ["%deg", "$1^{\\circ}"],
    ["% degree", "$1^{\\circ}"],
    ["% degrees", "$1^{\\circ}"],
    ["% deg", "$1^{\\circ}"],
    ["%°", "$1^{\\circ}"],
    ["% °", "$1^{\\circ}"],

    // Greek letters - lowercase (with wildcard support for partial typing)
    ["al%", "\\alpha"],
    ["be%", "\\beta"],
    ["gam%", "\\gamma"],
    ["del%", "\\delta"],
    ["the%", "\\theta"],
    ["lam%", "\\lambda"],
    ["mu", "\\mu"],
    ["sig%", "\\sigma"],
    ["ome%", "\\omega"],

    // Greek letters - uppercase
    ["Al%", "\\Alpha"],
    ["Be%", "\\Beta"],
    ["Gam%", "\\Gamma"],
    ["Del%", "\\Delta"],
    ["The%", "\\Theta"],
    ["Lam%", "\\Lambda"],
    ["Mu", "\\Mu"],
    ["Sig%", "\\Sigma"],
    ["Ome%", "\\Omega"]
  
  ];

    if (typeof globalThis !== 'undefined'){
    globalThis.NORMAL_RULES = NORMAL_RULES;
    globalThis.normalizeCommonMathTypos = normalizeCommonMathTypos;
  }

  const exportedFractionBuilder =
    typeof globalThis !== 'undefined' && typeof globalThis.buildFractionAmbiguityCandidates === 'function'
      ? globalThis.buildFractionAmbiguityCandidates
      : () => [];

  if (typeof module !== 'undefined' && module.exports){
    module.exports = { NORMAL_RULES, normalizeCommonMathTypos, buildFractionAmbiguityCandidates: exportedFractionBuilder };
  }
})();
