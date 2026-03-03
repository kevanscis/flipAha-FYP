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
    const trimmedSuffix = String(suffix || '').trim();
    const degreeSuffixOnly = /^(?:°|deg|degree|degrees)$/i.test(trimmedSuffix);

    if (degreeSuffixOnly) {
      perms.add(`${prefix}\\${normalizedFunc}(${digits}^{\\circ})`);
      return perms;
    }
    
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

    // Signed fractional shorthand: cos-1/2x -> \cos(-1/2x)
    let match = normalizedInput.match(/^(.*?)(sin|cos|tan|sec|csc|cot|cosec)\s*([+\-]\s*\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)([a-zα-ω\\]+)?([+\-].+)?$/i);
    if (match) {
      const [_, prefix, func, numeratorRaw, denominator, varToken, tailRaw] = match;
      const normalizedFunc = normalizeTrigFunc(func);
      const numerator = String(numeratorRaw || '').replace(/\s+/g, '');
      const normalizedVar = varToken ? normalizeGreekToken(varToken) : '';
      const tail = normalizeTrigText(tailRaw || '');

      perms.add(`${prefix}\\${normalizedFunc}(${numerator}/${denominator}${normalizedVar}${tail})`);
      if (normalizedVar) {
        perms.add(`${prefix}\\${normalizedFunc}((${numerator}/${denominator})${normalizedVar}${tail})`);
      }
      return perms;
    }

    match = normalizedInput.match(/^(.*?)(sin|cos|tan|sec|csc|cot|cosec)\s*(\d+)([a-zα-ω\\]+)([+\-].+)?$/i);
    if (match) {
      const [_, prefix, func, coeff, varToken, tailRaw] = match;
      const normalizedFunc = normalizeTrigFunc(func);
      const varLower = String(varToken || '').toLowerCase();
      const isDegreeWord = /^(deg|degree|degrees|°)$/.test(varLower);
      if (isDegreeWord) {
        const tail = normalizeTrigText(tailRaw || '');
        perms.add(`${prefix}\\${normalizedFunc}(${coeff}^{\\circ}${tail})`);
        return perms;
      }

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
    const raw = String(text ?? '');
    if (typeof globalThis !== 'undefined' && typeof globalThis.normalizeCommonMathTypos === 'function') {
      return globalThis.normalizeCommonMathTypos(raw);
    }
    return raw;
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
    const normalizedInput = normalizeMathTypos(String(text ?? ''));
    if (
      typeof globalThis !== 'undefined' &&
      globalThis.subjects &&
      globalThis.subjects.trig &&
      typeof globalThis.subjects.trig.normalizeTrigArgument === 'function'
    ) {
      return globalThis.subjects.trig.normalizeTrigArgument(normalizedInput);
    }
    return normalizedInput;
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
    const piTerm = c === '1' ? '\\pi' : `${c}\\pi`;
    const normalizedSuffix = normalizeTrigText(suffix || '');
    const suffixStartsWithOp = /^[+\-]/.test(String(suffix || '').trim());
    
    if (denom) {
      const fracTerm = c === '1' ? `\\frac{\\pi}{${denom}}` : `\\frac{${c}\\pi}{${denom}}`;
      if (suffixStartsWithOp) {
        perms.add(`${prefix}\\${normalizedFunc}(${fracTerm}${normalizedSuffix})`);
      } else {
        perms.add(`${prefix}\\${normalizedFunc}(${piTerm}/${denom})${suffix}`);
        perms.add(`${prefix}\\${normalizedFunc}(${piTerm}*1/${denom})${suffix}`);
        perms.add(`${prefix}\\${normalizedFunc}(${fracTerm})${suffix}`);
      }
    } else {
      if (suffixStartsWithOp) {
        perms.add(`${prefix}\\${normalizedFunc}(${piTerm}${normalizedSuffix})`);
      } else {
        perms.add(`${prefix}\\${normalizedFunc}(${piTerm})${suffix}`);
        if (c !== '1') {
          perms.add(`${prefix}\\${normalizedFunc}(${c}*\\pi)${suffix}`);
        }
      }
    }
    
    return perms;
  }

  function generateParsedTrigPermutations(parsed) {
    const perms = new Set();
    if (!parsed || typeof parsed !== 'object') return [];

    if (parsed.type === 'trigonometry' || parsed.type === 'trigonometry_pi') {
      const trigSource = `${parsed.prefix || ''}${parsed.keyword || ''}${parsed.operand || ''}`;
      const trigPerms = generateTrigPermutations(trigSource || parsed.originalExpr || '');
      for (const perm of trigPerms) perms.add(perm);

      const rawKeyword = String(parsed.keyword || '').toLowerCase();
      const normalizedFunc = normalizeTrigFunc(rawKeyword);
      const rawOperand = String(parsed.operand || '').trim();
      const trigSubject =
        typeof globalThis !== 'undefined' && globalThis.subjects
          ? (globalThis.subjects.trig || {})
          : {};

      const sanitizeIncompleteOperand =
        typeof trigSubject.sanitizeIncompleteTrigOperand === 'function'
          ? trigSubject.sanitizeIncompleteTrigOperand
          : (operand) => String(operand || '').trim();

      const normalizeTrigOperand =
        typeof trigSubject.normalizeTrigArgument === 'function'
          ? trigSubject.normalizeTrigArgument
          : (operand) => String(operand || '').trim();

      const normalizedOperand = normalizeTrigOperand(sanitizeIncompleteOperand(rawOperand));
      const rawPrefix = String(parsed.prefix || '');

      if (normalizedFunc && normalizedOperand) {
        const alreadyWrapped = /^\(.*\)$/.test(normalizedOperand);
        const trigCall = alreadyWrapped
          ? `\\${normalizedFunc}${normalizedOperand}`
          : `\\${normalizedFunc}(${normalizedOperand})`;
        perms.add(trigCall);
        if (rawPrefix) {
          perms.add(`${rawPrefix}${trigCall}`);
          const needsStar = /[a-z0-9)πθα-ω]$/i.test(rawPrefix);
          if (needsStar) perms.add(`${rawPrefix}*${trigCall}`);
        }
      }
    }

    if (parsed.type === 'inverse_trigonometry') {
      const inverseSource = String(parsed.originalExpr || '').trim();
      const invTrigPerms = generateInverseTrigPermutations(inverseSource);
      for (const perm of invTrigPerms) perms.add(perm);
    }

    return Array.from(perms).filter(isValidTrigExpression);
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
      generateParsedTrigPermutations,
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
      generateParsedTrigPermutations,
      generateTrigDigitPermutations,
      generateTrigVarPermutations,
      generateTrigAmbiguityPermutations,
      generateInverseTrigPermutations,
      generateTrigPiPermutations,
      isValidTrigExpression
    };
  }
})();
