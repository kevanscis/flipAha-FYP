// permutation-rules/log-rules.js
// Logarithm-specific permutation rules
// Works with parsed { keyword: "log", operand: "234", ... } from math-extractor-enhanced

(function() {
  'use strict';

  /**
   * Generate log permutations from parsed operand
   * operand: "234" or "2x" or "xy"
   * 
   * Examples:
   * - "234" → log_2(34), log_23(4), log(234)
   * - "2x" → log_2(x), log(2x), log(2)*x
   * - "xy" → log_x(y), log(xy), log(x)*y
   */
  function generateLogPermutations(operand) {
    const perms = new Set();
    if (!operand || typeof operand !== 'string') return Array.from(perms);
    
    const trimmed = operand.trim();
    
    // Check if operand is pure digits
    if (/^\d+$/.test(trimmed)) {
      perms.add(`\\log(${trimmed})`);
      
      // Generate all meaningful base splits
      for (let splitPos = 1; splitPos < trimmed.length; splitPos++) {
        const base = trimmed.slice(0, splitPos);
        const arg = trimmed.slice(splitPos);
        perms.add(`\\log_{${base}}(${arg})`);
      }
    }
    // Digit + variable
    else if (/^\d+[a-z]$/i.test(trimmed)) {
      const match = trimmed.match(/^(\d+)([a-z])$/i);
      const [_, digits, varName] = match;
      
      perms.add(`\\log_{${digits}}(${varName})`);
      perms.add(`\\log(${digits}${varName})`);
      perms.add(`\\log(${digits})*${varName}`);
    }
    // Variable + variable
    else if (/^[a-z][a-z]$/i.test(trimmed)) {
      const [base, arg] = trimmed.split('');
      
      perms.add(`\\log_{${base}}(${arg})`);
      perms.add(`\\log(${base}${arg})`);
      perms.add(`\\log(${base})*${arg}`);
    }
    
    return Array.from(perms).filter(perm => isValidLogExpression(perm));
  }

  function isValidLogExpression(expr) {
    if (!expr || typeof expr !== 'string') return false;
    const trimmed = expr.trim();
    if (!trimmed.includes('log')) return false;
    
    // Check log base validity (must be > 0 and ≠ 1)
    const baseMatch = trimmed.match(/\\log_\{([^}]+)\}/);
    if (baseMatch) {
      const base = baseMatch[1];
      const baseNum = parseFloat(base);
      if (!isNaN(baseNum) && (baseNum <= 0 || baseNum === 1)) return false;
    }
    
    return true;
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.logPermutationRules = { generateLogPermutations, isValidLogExpression };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateLogPermutations, isValidLogExpression };
  }
})();
