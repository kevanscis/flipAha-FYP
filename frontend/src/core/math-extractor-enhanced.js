// core/math-extractor-enhanced.js
// Enhanced parser that separates keyword + operand for better permutation generation
// Uses IIFE pattern for synchronous loading in browser context

(function() {
  'use strict';

  /**
   * Parse math expression into keyword + operand
   * 
   * Examples:
   * - "log234" → { keyword: "log", operand: "234", type: "logarithm" }
   * - "sin2x" → { keyword: "sin", operand: "2x", type: "trigonometry" }
   * - "2x3" → { keyword: null, operand: "2x3", type: "implicit_mult", pattern: "num-var-num" }
   * - "fx" → { keyword: "f", operand: "x", type: "function_app", pattern: "func-var" }
   * - "e^2x" → { keyword: "^", operand: { base: "e", exp: "2x" }, type: "power_ambiguity" }
   */
  function parseExpression(input) {
    if (!input || typeof input !== 'string') return null;
    
    const trimmed = input.trim();
    
    // === LOGARITHM PATTERNS ===
    // log234, log2x, logxy, log_2(x), etc.
    const logMatch = trimmed.match(/^(.*?)log([_\(]?)(.+)$/i);
    if (logMatch) {
      const [_, prefix, notation, operand] = logMatch;
      return {
        keyword: 'log',
        prefix,
        operand: operand.trim(),
        notation, // empty, '_', or '('
        type: 'logarithm',
        originalExpr: trimmed
      };
    }
    
    // === INVERSE TRIG PATTERNS (must check BEFORE regular trig!) ===
    // arcsin, asin, sin-1, sin^-1
    const invTrigMatch = trimmed.match(/^(.*?)(arc|a)?(sin|cos|tan|sec|csc|cot|cosec)(?:\^)?-1(.*)$/i);
    if (invTrigMatch && (invTrigMatch[2] || invTrigMatch[0].includes('-1'))) {
      const [_, prefix, arc, func, suffix] = invTrigMatch;
      return {
        keyword: func.toLowerCase(),
        prefix,
        suffix,
        pattern: 'inverse_trig',
        isInverse: true,
        type: 'inverse_trigonometry',
        originalExpr: trimmed
      };
    }
    
    // === TRIGONOMETRY PATTERNS ===
    // sin, cos, tan, etc. followed by digits/variables
    const trigMatch = trimmed.match(/^(.*?)(sin|cos|tan|sec|csc|cot|cosec|arcsin|arccos|arctan|asin|acos|atan)([^a-z]?.*)$/i);
    if (trigMatch) {
      const [_, prefix, func, operand] = trigMatch;
      return {
        keyword: func.toLowerCase(),
        prefix,
        operand: operand.trim(),
        type: 'trigonometry',
        originalExpr: trimmed
      };
    }
    
    // === IMPLICIT MULTIPLICATION: digit-var-digit ===
    // 2x3 → { pattern: "num-var-num", num1: 2, var: x, num2: 3 }
    const implicitMultMatch = trimmed.match(/^(.*?)(\d)([a-z])(\d)(.*)$/i);
    if (implicitMultMatch) {
      const [_, prefix, num1, varName, num2, suffix] = implicitMultMatch;
      return {
        keyword: null,
        prefix,
        suffix,
        pattern: 'num-var-num',
        num1,
        variable: varName,
        num2,
        type: 'implicit_multiplication',
        originalExpr: trimmed
      };
    }
    
    // === FUNCTION APPLICATION: letter-var ===
    // fx → f(x) or f*x
    const funcAppMatch = trimmed.match(/^(.*?)([fghpqrstuv])([a-zθαβγ])(.*)$/i);
    if (funcAppMatch) {
      const [_, prefix, func, varName, suffix] = funcAppMatch;
      const prefixEndsWithLetter = /[a-z]$/i.test(prefix);
      const suffixStartsWithLetter = /^[a-z]/i.test(suffix || '');
      // Only treat as function application in math-like context, not inside normal words like "solve"
      if (!prefixEndsWithLetter && !suffixStartsWithLetter && !suffix.startsWith('(')) {
        return {
          keyword: func,
          prefix,
          suffix,
          pattern: 'func-var',
          variable: varName,
          type: 'function_application',
          originalExpr: trimmed
        };
      }
    }
    
    // === POWER AMBIGUITY: base^num-var ===
    // e^2x → e^(2x) or e^2*x
    const powerMatch = trimmed.match(/^(.*?)([a-z0-9eπ])\^(\d)([a-z])(.*)$/i);
    if (powerMatch) {
      const [_, prefix, base, exp, varName, suffix] = powerMatch;
      return {
        keyword: '^',
        prefix,
        suffix,
        pattern: 'power-ambiguity',
        base,
        exponent: exp,
        variable: varName,
        type: 'power_ambiguity',
        originalExpr: trimmed
      };
    }
    
    // === PI PATTERNS ===
    // sinpi/6, cos2pi/3
    const piMatch = trimmed.match(/^(.*?)(sin|cos|tan)(\d*)(?:pi|π)(?:\/(\d+))?(.*)$/i);
    if (piMatch) {
      const [_, prefix, func, coeff, denom, suffix] = piMatch;
      return {
        keyword: func.toLowerCase(),
        prefix,
        suffix,
        pattern: 'trig_pi',
        coefficient: coeff || '1',
        denominator: denom,
        type: 'trigonometry_pi',
        originalExpr: trimmed
      };
    }
    
    // Not a recognized pattern
    return {
      keyword: null,
      operand: trimmed,
      type: 'unknown',
      originalExpr: trimmed
    };
  }

  /**
   * Get math vocabulary keywords from an expression
   */
  function extractKeywords(input) {
    const parsed = parseExpression(input);
    
    const keywords = [];
    
    if (parsed.keyword) keywords.push(parsed.keyword);
    if (parsed.pattern) keywords.push(parsed.pattern);
    if (parsed.type) keywords.push(parsed.type);
    
    return keywords;
  }

  /**
   * Check if expression matches a specific math vocabulary type
   */
  function matchesType(input, type) {
    const parsed = parseExpression(input);
    return parsed?.type === type;
  }

  // Export for browser context
  if (typeof globalThis !== 'undefined') {
    globalThis.parseExpression = parseExpression;
    globalThis.extractKeywords = extractKeywords;
    globalThis.matchesType = matchesType;
  }

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseExpression, extractKeywords, matchesType };
  }
})();
