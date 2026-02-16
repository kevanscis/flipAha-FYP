// permutation-rules/trig-rules.js
// Trigonometry-specific permutation rules

(function() {
  'use strict';

  if (typeof Set !== 'undefined' && !Set.prototype.addAll) {
    Set.prototype.addAll = function(other) {
      for (const item of other) this.add(item);
      return this;
    };
  }

  function generateTrigPermutations(input) {
    if (!input || typeof input !== 'string') return [];
    const trimmed = input.trim();
    const perms = new Set();
    
    perms.addAll(generateTrigDigitPermutations(trimmed));
    perms.addAll(generateTrigVarPermutations(trimmed));
    perms.addAll(generateInverseTrigPermutations(trimmed));
    perms.addAll(generateTrigPiPermutations(trimmed));
    
    return Array.from(perms).filter(perm => isValidTrigExpression(perm));
  }

  function generateTrigDigitPermutations(input) {
    const perms = new Set();
    const match = input.match(/^(.*?)(sin|cos|tan|sec|csc|cot|cosec)(\d{2,})(.*)$/i);
    if (!match) return perms;
    
    const [_, prefix, func, digits, suffix] = match;
    const normalizedFunc = normalizeTrigFunc(func);
    
    perms.add(`${prefix}\\${normalizedFunc}(${digits})${suffix}`);
    for (let splitPos = 1; splitPos < digits.length; splitPos++) {
      const left = digits.slice(0, splitPos);
      const right = digits.slice(splitPos);
      perms.add(`${prefix}\\${normalizedFunc}(${left}*${right})${suffix}`);
    }
    
    if (['45', '90', '180', '270', '360', '30', '60', '0'].includes(digits)) {
      perms.add(`${prefix}\\${normalizedFunc}(${digits}^\\circ)${suffix}`);
    }
    
    return perms;
  }

  function generateTrigVarPermutations(input) {
    const perms = new Set();
    const match = input.match(/^(.*?)(sin|cos|tan|sec|csc|cot|cosec)(\d+)([a-zθαβγ])(.*)$/i);
    if (!match) return perms;
    
    const [_, prefix, func, num, varName, suffix] = match;
    const normalizedFunc = normalizeTrigFunc(func);
    
    perms.add(`${prefix}\\${normalizedFunc}(${num}${varName})${suffix}`);
    perms.add(`${prefix}\\${normalizedFunc}(${varName}^${num})${suffix}`);
    perms.add(`${prefix}\\${normalizedFunc}(${varName})^${num}${suffix}`);
    perms.add(`${prefix}\\${normalizedFunc}(${num})*${varName}${suffix}`);
    
    return perms;
  }

  function generateInverseTrigPermutations(input) {
    const perms = new Set();
    
    let match = input.match(/^(.*?)(arc)(sin|cos|tan|sec|csc|cot|cosec)(.*)$/i);
    if (match) {
      const [_, prefix, arc, func, suffix] = match;
      const normalizedFunc = normalizeTrigFunc(func);
      perms.add(`${prefix}\\${normalizedFunc}^{-1}${suffix}`);
      perms.add(`${prefix}\\text{arc${normalizedFunc}}${suffix}`);
      return perms;
    }
    
    match = input.match(/^(.*?)(a)(sin|cos|tan)(.*)$/i);
    if (match) {
      const [_, prefix, a, func, suffix] = match;
      const normalizedFunc = normalizeTrigFunc(func);
      perms.add(`${prefix}\\${normalizedFunc}^{-1}${suffix}`);
      return perms;
    }
    
    match = input.match(/^(.*?)(sin|cos|tan|sec|csc|cot|cosec)(?:\^)?-?1(?:\(([^)]*)\))?(.*)$/i);
    if (match) {
      const [_, prefix, func, arg, suffix] = match;
      const normalizedFunc = normalizeTrigFunc(func);
      if (arg) {
        perms.add(`${prefix}\\${normalizedFunc}^{-1}(${arg})${suffix}`);
      } else {
        perms.add(`${prefix}\\${normalizedFunc}^{-1}${suffix}`);
      }
      return perms;
    }
    
    return perms;
  }

  function generateTrigPiPermutations(input) {
    const perms = new Set();
    const match = input.match(/^(.*?)(sin|cos|tan|sec|csc|cot|cosec)(\d*)(?:pi|π)(?:\/(\d+))?(.*)$/i);
    if (!match) return perms;
    
    const [_, prefix, func, coeff, denom, suffix] = match;
    const normalizedFunc = normalizeTrigFunc(func);
    const c = coeff || '1';
    
    if (denom) {
      perms.add(`${prefix}\\${normalizedFunc}(${c}\\pi/${denom})${suffix}`);
      perms.add(`${prefix}\\${normalizedFunc}(${c}*\\pi/${denom})${suffix}`);
      if (c !== '1') {
        perms.add(`${prefix}\\${normalizedFunc}(\\frac{${c}\\pi}{${denom}})${suffix}`);
      }
    } else {
      perms.add(`${prefix}\\${normalizedFunc}(${c}\\pi)${suffix}`);
      if (c !== '1') {
        perms.add(`${prefix}\\${normalizedFunc}(${c}*\\pi)${suffix}`);
      }
    }
    
    return perms;
  }

  function isValidTrigExpression(expr) {
    if (!expr || typeof expr !== 'string') return false;
    const trimmed = expr.trim();
    if (!/\\(sin|cos|tan|sec|csc|cot)/.test(trimmed)) return false;
    
    const argMatch = trimmed.match(/\\(sin|cos|tan|sec|csc|cot)\((-?[\d.]+)(?:\^[^)]+)?\)/);
    if (argMatch) {
      const arg = parseFloat(argMatch[2]);
    }
    
    const invArgMatch = trimmed.match(/\\(sin|cos)(?:\^{-1})?\((-?[\d.]+)\)/);
    if (invArgMatch && invArgMatch[1] !== 'tan') {
      const arg = parseFloat(invArgMatch[2]);
      if (!isNaN(arg) && (arg < -1 || arg > 1)) return false;
    }
    
    return true;
  }

  function normalizeTrigFunc(func) {
    const lower = func.toLowerCase();
    return lower === 'cosec' ? 'csc' : lower;
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.trigPermutationRules = {
      generateTrigPermutations,
      generateTrigDigitPermutations,
      generateTrigVarPermutations,
      generateInverseTrigPermutations,
      generateTrigPiPermutations,
      isValidTrigExpression
    };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      generateTrigPermutations,
      generateTrigDigitPermutations,
      generateTrigVarPermutations,
      generateInverseTrigPermutations,
      generateTrigPiPermutations,
      isValidTrigExpression
    };
  }
})();
