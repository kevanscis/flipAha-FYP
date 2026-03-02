// permutation-rules/exponent-rules.js
// Exponent/root permutation grammar with fuzzy partial parse handling

(function() {
  'use strict';

  function normalizeInput(input) {
    return String(input || '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/−/g, '-')
      .replace(/⁻/g, '-')
      .replace(/¹/g, '1')
      .replace(/²/g, '^2')
      .replace(/³/g, '^3');
  }

  function stripOuterParens(value) {
    let output = String(value || '').trim();
    if (!output) return output;

    while (output.startsWith('(') && output.endsWith(')')) {
      let depth = 0;
      let wrapsWhole = true;
      for (let i = 0; i < output.length; i += 1) {
        const ch = output[i];
        if (ch === '(') depth += 1;
        if (ch === ')') depth -= 1;
        if (depth === 0 && i < output.length - 1) {
          wrapsWhole = false;
          break;
        }
      }
      if (!wrapsWhole || depth !== 0) break;
      output = output.slice(1, -1).trim();
    }

    return output;
  }

  function isSimpleBase(base) {
    return /^[a-zA-Z\\α-ωΑ-Ωπθ][a-zA-Z0-9_\\α-ωΑ-Ωπθ]*$/.test(String(base || ''));
  }

  function wrapBase(baseRaw) {
    const base = stripOuterParens(baseRaw);
    if (!base) return '';
    if (isSimpleBase(base)) return base;
    return `{${base}}`;
  }

  function isLikelyFunctionToken(value) {
    const token = String(value || '').replace(/^\\/, '').toLowerCase();
    if (!token) return false;
    const functionLike = new Set([
      'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'cosec',
      'asin', 'acos', 'atan', 'arcsin', 'arccos', 'arctan',
      'log', 'ln', 'sqrt', 'root', 'cbrt', 'abs', 'exp', 'sum', 'mod'
    ]);
    return functionLike.has(token);
  }

  function addFractionalPowerCandidates(perms, baseRaw, numeratorRaw, denominatorRaw) {
    const base = wrapBase(baseRaw);
    const numerator = String(numeratorRaw || '').trim();
    const denominator = String(denominatorRaw || '').trim();
    if (!base || !/^[+\-]?\d+$/.test(numerator) || !/^[+\-]?\d+$/.test(denominator) || denominator === '0') return;

    perms.add(`${base}^{\\frac{${numerator}}{${denominator}}}`);

    const bareBase = stripOuterParens(baseRaw);
    if (numerator === '1') {
      if (denominator === '2') perms.add(`\\sqrt{${bareBase}}`);
      else if (denominator === '3') perms.add(`\\sqrt[3]{${bareBase}}`);
      else perms.add(`\\sqrt[${denominator}]{${bareBase}}`);
    }
  }

  function parseFractionalPowerByGrammar(compact) {
    const patterns = [
      /^(.+)\^\(([-+]?\d+)\/(\d+)\)$/,
      /^(.+)\^([-+]?\d+)\/(\d+)$/,
      /^(.+)\^\{([-+]?\d+)\/(\d+)\}$/,
      /^(.+)\^\{([-+]?\d+)\}\/(\d+)$/,
      /^(.+)\^\(?([-+]?\d+)\/(\d+)\)?$/
    ];

    for (const pattern of patterns) {
      const match = compact.match(pattern);
      if (match) {
        return {
          base: match[1],
          numerator: match[2],
          denominator: match[3]
        };
      }
    }

    return null;
  }

  function parsePartialPowerTree(compact) {
    if (!compact.includes('^')) return null;
    const caretIdx = compact.indexOf('^');
    if (caretIdx <= 0 || caretIdx >= compact.length - 1) return null;

    const base = compact.slice(0, caretIdx);
    const rhs = compact.slice(caretIdx + 1);
    const cleanedRhs = stripOuterParens(rhs).replace(/[{}]/g, '');
    const frac = cleanedRhs.match(/^([-+]?\d+)\/(\d+)$/);
    if (!frac) return null;

    return {
      base,
      numerator: frac[1],
      denominator: frac[2]
    };
  }

  function generateExponentPermutations(input) {
    const compact = normalizeInput(input);
    const perms = new Set();
    if (!compact) return [];

    const strictFrac = parseFractionalPowerByGrammar(compact);
    if (strictFrac) {
      addFractionalPowerCandidates(perms, strictFrac.base, strictFrac.numerator, strictFrac.denominator);
    }

    const fuzzyFrac = parsePartialPowerTree(compact);
    if (fuzzyFrac) {
      addFractionalPowerCandidates(perms, fuzzyFrac.base, fuzzyFrac.numerator, fuzzyFrac.denominator);
    }

    const inlinePower = compact.match(/^([a-zA-Z\\α-ωΑ-Ωπθ][a-zA-Z_\\α-ωΑ-Ωπθ]*)(\d+)$/);
    if (inlinePower) {
      if (!isLikelyFunctionToken(inlinePower[1])) {
        perms.add(`${wrapBase(inlinePower[1])}^{${inlinePower[2]}}`);
      }
    }

    const groupedInlinePower = compact.match(/^\((.+)\)(\d+)$/);
    if (groupedInlinePower) {
      perms.add(`${wrapBase(groupedInlinePower[1])}^{${groupedInlinePower[2]}}`);
    }

    const compactFracPower = compact.match(/^([a-zA-Z\\α-ωΑ-Ωπθ][a-zA-Z0-9_\\α-ωΑ-Ωπθ]*)(\d+)\/(\d+)$/);
    if (compactFracPower) {
      if (!isLikelyFunctionToken(compactFracPower[1])) {
        addFractionalPowerCandidates(perms, compactFracPower[1], compactFracPower[2], compactFracPower[3]);
        perms.add(`${wrapBase(compactFracPower[1])}*\\frac{${compactFracPower[2]}}{${compactFracPower[3]}}`);
      }
    }

    return Array.from(perms).filter(isValidExponentExpression);
  }

  function isValidExponentExpression(expr) {
    if (!expr || typeof expr !== 'string') return false;
    const trimmed = expr.trim();
    if (!trimmed) return false;
    if (!/[\^\\]|sqrt|frac/.test(trimmed)) return false;
    if (/\^\^|\*\*|\/\//.test(trimmed)) return false;
    return true;
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.exponentPermutationRules = {
      generateExponentPermutations,
      isValidExponentExpression
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      generateExponentPermutations,
      isValidExponentExpression
    };
  }
})();
