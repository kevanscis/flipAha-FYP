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
    perms.addAll(generateTrigAmbiguityPermutations(trimmed));
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
    const match = input.match(/^(.*?)(sin|cos|tan|sec|csc|cot|cosec)(\d+)([a-zθαβγδλωμπσ])(?![a-z])(.*)$/i);
    if (!match) return perms;
    
    const [_, prefix, func, num, varName, suffix] = match;
    const normalizedFunc = normalizeTrigFunc(func);
    
    perms.add(`${prefix}\\${normalizedFunc}(${num}${varName})${suffix}`);
    perms.add(`${prefix}\\${normalizedFunc}(${varName}^${num})${suffix}`);
    perms.add(`${prefix}\\${normalizedFunc}(${varName})^${num}${suffix}`);
    perms.add(`${prefix}\\${normalizedFunc}(${num})*${varName}${suffix}`);
    
    return perms;
  }

  function generateTrigAmbiguityPermutations(input) {
    const perms = new Set();
    if (!input || typeof input !== 'string') return perms;

    const normalizedInput = normalizeMathTypos(input.trim());
    if (!normalizedInput) return perms;

    let match = normalizedInput.match(/^(.*?)(sin|cos|tan|sec|csc|cot|cosec)\s*(\d+)([a-zα-ω\\]+)([+\-].+)?$/i);
    if (match) {
      const [_, prefix, func, coeff, varToken, tailRaw] = match;
      const normalizedFunc = normalizeTrigFunc(func);
      const normalizedVar = normalizeGreekToken(varToken);
      const tail = normalizeTrigText(tailRaw || '');
      perms.add(`${prefix}\\${normalizedFunc}(${coeff}${normalizedVar}${tail})`);
      perms.add(`${prefix}\\${normalizedFunc}^{${coeff}}(${normalizedVar})${tail}`);
      if (tail) {
        perms.add(`${prefix}\\${normalizedFunc}^{${coeff}}(${normalizedVar}${tail})`);
      }
      return perms;
    }

    match = normalizedInput.match(/^(.*?)(sin|cos|tan|sec|csc|cot|cosec)\s*(\d+)\((.+)\)(.*)$/i);
    if (match) {
      const [_, prefix, func, coeff, inside, suffix] = match;
      const normalizedFunc = normalizeTrigFunc(func);
      const normalizedInside = normalizeTrigText(inside);
      const normalizedSuffix = normalizeTrigText(suffix || '');
      perms.add(`${prefix}\\${normalizedFunc}(${coeff}(${normalizedInside}))${normalizedSuffix}`);
      perms.add(`${prefix}\\${normalizedFunc}^{${coeff}}(${normalizedInside})${normalizedSuffix}`);
      return perms;
    }

    return perms;
  }

  function normalizeMathTypos(text) {
    return String(text ?? '')
      .replace(/thetha|tetha|thta|thita|theeta/gi, 'theta')
      .replace(/alpah|alhpa|aplha/gi, 'alpha')
      .replace(/betha|btea/gi, 'beta')
      .replace(/gama|gammar|gammma/gi, 'gamma')
      .replace(/delat|detla|dalta/gi, 'delta')
      .replace(/lamda|lamba|lmbda|lambada/gi, 'lambda')
      .replace(/sigam|simga|sogma/gi, 'sigma')
      .replace(/omgea|omeag|oemga|omeega/gi, 'omega');
  }

  function normalizeGreekToken(token) {
    const raw = String(token ?? '').trim();
    const key = raw.replace(/^\\/, '').toLowerCase();
    const map = {
      theta: '\\theta',
      alpha: '\\alpha',
      beta: '\\beta',
      gamma: '\\gamma',
      delta: '\\delta',
      lambda: '\\lambda',
      mu: '\\mu',
      sigma: '\\sigma',
      omega: '\\omega',
      pi: '\\pi',
      'θ': '\\theta',
      'α': '\\alpha',
      'β': '\\beta',
      'γ': '\\gamma',
      'δ': '\\delta',
      'λ': '\\lambda',
      'μ': '\\mu',
      'σ': '\\sigma',
      'ω': '\\omega',
      'π': '\\pi'
    };
    return map[key] || raw;
  }

  function normalizeTrigText(text) {
    let output = normalizeMathTypos(String(text ?? ''));
    output = output.replace(/(\d+(?:\.\d+)?)\s*(?:°|deg|degree|degrees)/gi, '$1^{\\circ}');
    output = output.replace(/π/g, '\\pi').replace(/θ/g, '\\theta');

    const replacements = [
      ['theta', '\\theta'], ['alpha', '\\alpha'], ['beta', '\\beta'], ['gamma', '\\gamma'],
      ['delta', '\\delta'], ['lambda', '\\lambda'], ['mu', '\\mu'], ['sigma', '\\sigma'],
      ['omega', '\\omega'], ['pi', '\\pi']
    ];
    for (const [token, latex] of replacements) {
      const pattern = new RegExp(`(^|[^a-zA-Z\\\\])${token}(?=[^a-zA-Z]|$)`, 'gi');
      output = output.replace(pattern, (m, prefix) => `${prefix}${latex}`);
    }

    output = output
      .replace(/\b(?:sqrt|root)\(([^()]+)\)/gi, '\\sqrt{$1}')
      .replace(/\b(?:sqrt|root)([a-z0-9\\pi\\theta]+)/gi, '\\sqrt{$1}')
      .replace(/\\sqrt\{(\\pi|\\theta)([a-z0-9]+)\}/gi, '\\sqrt{$1$2}')
      .replace(/(?<!\\)\bsquareroot\(([^()]+)\)/gi, '\\sqrt{$1}')
      .replace(/(?<!\\)\bsquareroot([a-z0-9]+)/gi, '\\sqrt{$1}');

    if (!/\\frac\{/.test(output)) {
      const simpleFrac = output.match(/^([^/]+)\/([^/]+)$/);
      if (simpleFrac) {
        const numerator = simpleFrac[1];
        const denominator = simpleFrac[2];
        if (numerator && denominator) {
          output = `\\frac{${numerator}}{${denominator}}`;
        }
      }
    }

    return output;
  }

  function generateInverseTrigPermutations(input) {
    const perms = new Set();
    const trimmed = typeof input === 'string' ? input.trim() : '';
    if (!trimmed) return perms;

    const addInverse = (func, arg) => {
      const normalizedFunc = normalizeTrigFunc(func);
      const cleanArg = typeof arg === 'string' ? normalizeTrigText(arg).trim() : '';
      if (cleanArg) {
        perms.add(`\\${normalizedFunc}^{-1}(${cleanArg})`);
      } else {
        perms.add(`\\${normalizedFunc}^{-1}`);
      }
    };

    const readBalancedParenArg = (source, startIdx) => {
      if (!source || source[startIdx] !== '(') return null;
      let depth = 0;
      for (let i = startIdx; i < source.length; i++) {
        const ch = source[i];
        if (ch === '(') depth++;
        if (ch === ')') {
          depth--;
          if (depth === 0) {
            return {
              arg: source.slice(startIdx + 1, i),
              endIndex: i + 1
            };
          }
        }
      }
      return null;
    };

    const readInlineArg = (source, startIdx) => {
      if (!source || startIdx >= source.length) return '';
      let idx = startIdx;
      while (idx < source.length && /\s/.test(source[idx])) idx++;
      if (idx >= source.length) return '';

      if (source[idx] === '(') {
        const balanced = readBalancedParenArg(source, idx);
        return balanced ? balanced.arg.trim() : '';
      }

      const tail = source.slice(idx);
      const rawMatch = tail.match(/^([a-zθαβγ0-9\\π√\[\]{}().+\-*/^_\s]+)/i);
      if (!rawMatch) return '';

      const cleaned = rawMatch[1]
        .replace(/\s+(?:in|for|where|when|if)\b.*$/i, '')
        .replace(/\s+(?:degrees?|radians?|rad)\b.*$/i, '')
        .trim();

      return cleaned;
    };

    let inlineMatch = trimmed.match(/\b(?:arc\s*(sin|cos|tan|sec|csc|cot|cosec)|a(sin|cos|tan))\b/i);
    if (inlineMatch) {
      const func = inlineMatch[1] || inlineMatch[2];
      const arg = normalizeTrigText(readInlineArg(trimmed, inlineMatch.index + inlineMatch[0].length));
      addInverse(func, arg);
      perms.add(`\\text{arc${normalizeTrigFunc(func)}}${arg ? `(${arg.trim()})` : ''}`);
      return perms;
    }

    inlineMatch = trimmed.match(/\b(sin|cos|tan|sec|csc|cot|cosec)\s*(?:\^\s*[−-]\s*1|⁻¹)/i);
    if (inlineMatch) {
      const func = inlineMatch[1];
      const arg = readInlineArg(trimmed, inlineMatch.index + inlineMatch[0].length);
      addInverse(func, arg);
      return perms;
    }

    inlineMatch = trimmed.match(/\b(sin|cos|tan|sec|csc|cot|cosec)\s*[−-]\s*1(?=\s|\(|$)/i);
    if (inlineMatch) {
      const func = inlineMatch[1];
      const arg = readInlineArg(trimmed, inlineMatch.index + inlineMatch[0].length);
      addInverse(func, arg);
      return perms;
    }
    
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
    
    match = input.match(/^(.*?)(sin|cos|tan|sec|csc|cot|cosec)(?:\^\s*)?[−-]\s*1(?=\s|\(|$)(?:\(([^)]*)\))?(.*)$/i);
    if (match) {
      const [_, prefix, func, arg, suffix] = match;
      const normalizedFunc = normalizeTrigFunc(func);
      if (arg) {
        perms.add(`${prefix}\\${normalizedFunc}^{-1}(${normalizeTrigText(arg)})${suffix}`);
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
    if (invArgMatch) {
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
      generateTrigAmbiguityPermutations,
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
      generateTrigAmbiguityPermutations,
      generateInverseTrigPermutations,
      generateTrigPiPermutations,
      isValidTrigExpression
    };
  }
})();
