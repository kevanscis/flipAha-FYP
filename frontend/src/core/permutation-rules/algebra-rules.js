// permutation-rules/algebra-rules.js
// Algebra-specific permutation rules
// Works with parsed components from math-extractor-enhanced

(function() {
  'use strict';

  if (typeof Set !== 'undefined' && !Set.prototype.addAll) {
    Set.prototype.addAll = function(other) {
      for (const item of other) this.add(item);
      return this;
    };
  }

  /**
   * Function application: fx → f(x) or f*x
   * Called with: generateFunctionAppPermutations(func, variable, prefix, suffix)
   */
  function generateFunctionAppPermutations(func, variable, prefix = '', suffix = '') {
    const perms = new Set();
    if (!func || !variable) return perms;
    
    perms.add(`${prefix}${func}(${variable})${suffix}`);
    perms.add(`${prefix}${func}*${variable}${suffix}`);
    
    return perms;
  }

  /**
   * Implicit multiplication: 2x3 → 2*x*3 or 2*x^3
   * Called with: generateImplicitMultiplicationPermutations(num1, variable, num2, prefix, suffix)
   */
  function generateImplicitMultiplicationPermutations(num1, variable, num2, prefix = '', suffix = '') {
    const perms = new Set();
    if (!num1 || !variable || !num2) return perms;
    
    perms.add(`${prefix}${num1}*${variable}*${num2}${suffix}`);
    perms.add(`${prefix}${num1}*${variable}^${num2}${suffix}`);
    
    return perms;
  }

  /**
   * Power ambiguity: e^2x → e^(2x) or e^2*x
   * Called with: generatePowerAmbiguityPermutations(base, exponent, variable, prefix, suffix)
   */
  function generatePowerAmbiguityPermutations(base, exponent, variable, prefix = '', suffix = '') {
    const perms = new Set();
    if (!base || !exponent || !variable) return perms;
    
    perms.add(`${prefix}${base}^(${exponent}${variable})${suffix}`);
    perms.add(`${prefix}${base}^${exponent}*${variable}${suffix}`);
    
    return perms;
  }

  /**
   * General dispatcher for backward compatibility
   * Takes full input string and applies all algebra rules
   */
  function generateAlgebraPermutations(input) {
    if (!input || typeof input !== 'string') return [];
    const trimmed = input.trim();
    const perms = new Set();
    
    // Try function application pattern (still using string matching)
    const funcAppMatch = trimmed.match(/^(.*?)([fghpqrstuv])([a-zθαβγ])(.*)$/i);
    if (funcAppMatch) {
      const [_, prefix, func, varName, suffix] = funcAppMatch;
      const compactPair = `${String(func || '').toLowerCase()}${String(varName || '').toLowerCase()}`;
      const prefixEndsWithLetter = /[a-z]$/i.test(prefix);
      const suffixStartsWithLetter = /^[a-z]/i.test(suffix || '');
      if (compactPair !== 'pi' && !prefixEndsWithLetter && !suffixStartsWithLetter && !suffix.startsWith('(')) {
        perms.addAll(generateFunctionAppPermutations(func, varName, prefix, suffix));
      }
    }
    
    // Try implicit multiplication pattern
    const implicitMultMatch = trimmed.match(/^(.*?)(\d)([a-z])(\d)(.*)$/i);
    if (implicitMultMatch) {
      const [_, prefix, num1, varName, num2, suffix] = implicitMultMatch;
      perms.addAll(generateImplicitMultiplicationPermutations(num1, varName, num2, prefix, suffix));
    }
    
    // Try power ambiguity pattern
    const powerMatch = trimmed.match(/^(.*?)([a-z0-9eπ])\^(\d)([a-z])(.*)$/i);
    if (powerMatch) {
      const [_, prefix, base, exp, varName, suffix] = powerMatch;
      perms.addAll(generatePowerAmbiguityPermutations(base, exp, varName, prefix, suffix));
    }
    
    return Array.from(perms).filter(perm => isValidAlgebraExpression(perm));
  }

  function isValidAlgebraExpression(expr) {
    if (!expr || typeof expr !== 'string') return false;
    const trimmed = expr.trim();
    if (trimmed.length === 0) return false;
    
    if (!/\d|[a-zθπα-ω]|π|∞/i.test(trimmed)) return false;
    if (trimmed.includes('()')) return false;
    if (/\+\+|\*\*|\^\^|--(?!\>)/.test(trimmed)) return false;
    
    let parenCount = 0;
    for (const char of trimmed) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) return false;
    }
    if (parenCount !== 0) return false;
    
    const lastChar = trimmed.split(/[\\{}]/).pop();
    if (/^[-+*^/]|[-+*^/]$/.test(lastChar)) return false;
    if (trimmed.match(/\/\s*0(?:\s|$|\))/)) return false;
    
    return true;
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.algebraPermutationRules = {
      generateAlgebraPermutations,
      generateFunctionAppPermutations,
      generateImplicitMultiplicationPermutations,
      generatePowerAmbiguityPermutations,
      isValidAlgebraExpression
    };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      generateAlgebraPermutations,
      generateFunctionAppPermutations,
      generateImplicitMultiplicationPermutations,
      generatePowerAmbiguityPermutations,
      isValidAlgebraExpression
    };
  }
})();
