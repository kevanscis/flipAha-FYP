(function(){
  function normalizeFractionComponent(componentInput){
    const raw = String(componentInput ?? '').trim();
    if (!raw) return raw;

    const normalizeTypos =
      typeof globalThis !== 'undefined' && typeof globalThis.normalizeCommonMathTypos === 'function'
        ? globalThis.normalizeCommonMathTypos
        : (value) => String(value || '');

    const toLatexCore = (value) => {
      let output = normalizeTypos(String(value || '').trim());

      output = output
        .replace(/π/g, '\\pi')
        .replace(/θ/g, '\\theta')
        .replace(/α/g, '\\alpha')
        .replace(/β/g, '\\beta')
        .replace(/γ/g, '\\gamma')
        .replace(/δ/g, '\\delta')
        .replace(/λ/g, '\\lambda')
        .replace(/μ/g, '\\mu')
        .replace(/σ/g, '\\sigma')
        .replace(/ω/g, '\\omega');

      const replaceWordToken = (source, token, latex) => {
        const pattern = new RegExp(`(^|[^a-zA-Z\\\\])${token}(?=[^a-zA-Z]|$)`, 'gi');
        return source.replace(pattern, (match, prefix) => `${prefix}${latex}`);
      };

      output = replaceWordToken(output, 'pi', '\\pi');
      output = replaceWordToken(output, 'theta', '\\theta');
      output = replaceWordToken(output, 'alpha', '\\alpha');
      output = replaceWordToken(output, 'beta', '\\beta');
      output = replaceWordToken(output, 'gamma', '\\gamma');
      output = replaceWordToken(output, 'delta', '\\delta');
      output = replaceWordToken(output, 'lambda', '\\lambda');
      output = replaceWordToken(output, 'mu', '\\mu');
      output = replaceWordToken(output, 'sigma', '\\sigma');
      output = replaceWordToken(output, 'omega', '\\omega');

      output = output
        .replace(/^root\((.+)\)$/i, '\\sqrt{$1}')
        .replace(/^sqrt\((.+)\)$/i, '\\sqrt{$1}')
        .replace(/^squareroot\((.+)\)$/i, '\\sqrt{$1}')
        .replace(/^(?:root|sqrt|squareroot)([a-z0-9\\pi\\theta]+)$/i, '\\sqrt{$1}')
        .replace(/\\sqrt\{(\\pi|\\theta)([a-z0-9]+)\}/gi, '\\sqrt{$1$2}');

      return output;
    };

    if (raw.startsWith('(') && raw.endsWith(')')) {
      const inner = raw.slice(1, -1).trim();
      if (inner) return toLatexCore(inner);
    }

    return toLatexCore(raw);
  }

  function splitTopLevelFraction(rawInput){
    const raw = String(rawInput ?? '').trim();
    if (!raw) return null;

    let depth = 0;
    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw[i];
      if (ch === '(') {
        depth += 1;
        continue;
      }
      if (ch === ')') {
        depth = Math.max(0, depth - 1);
        continue;
      }
      if (ch === '/' && depth === 0) {
        const left = raw.slice(0, i).trim();
        const right = raw.slice(i + 1).trim();
        if (!left || !right) return null;
        return { numerator: left, denominator: right };
      }
    }

    return null;
  }

  function buildRationalizedCandidates(numeratorLatex, denominatorLatex){
    const candidates = [];
    if (String(numeratorLatex).trim() !== '1') return candidates;

    const simpleSqrt = String(denominatorLatex).match(/^\\sqrt\{(\d+)\}$/);
    if (simpleSqrt) {
      const n = Number(simpleSqrt[1]);
      if (Number.isFinite(n) && n > 0) {
        candidates.push(`\\frac{\\sqrt{${n}}}{${n}}`);
      }
      return candidates;
    }

    const coeffSqrt = String(denominatorLatex).match(/^([+\-]?\d+(?:\.\d+)?)\\sqrt\{(\d+)\}$/);
    if (coeffSqrt) {
      const coeff = Number(coeffSqrt[1]);
      const n = Number(coeffSqrt[2]);
      if (Number.isFinite(coeff) && coeff !== 0 && Number.isFinite(n) && n > 0) {
        const sign = coeff < 0 ? '-' : '';
        const denomValue = Number.isInteger(coeff * n) ? String(coeff * n) : String(coeff * n);
        candidates.push(`${sign}\\frac{\\sqrt{${n}}}{${Math.abs(Number(denomValue))}}`);
        if (coeff < 0) {
          candidates[candidates.length - 1] = `\\frac{-\\sqrt{${n}}}{${Math.abs(Number(denomValue))}}`;
        }
      }
    }

    return candidates;
  }

  function normalizeFractionTail(tailInput){
    const tail = String(tailInput ?? '').trim();
    if (!tail) return tail;

    const trigMatch = tail.match(/^(sin|cos|tan|sec|csc|cot|cosec)(.*)$/i);
    if (trigMatch) {
      const rawFunc = String(trigMatch[1] || '').toLowerCase();
      const normalizedFunc = rawFunc === 'cosec' ? 'csc' : rawFunc;
      const rawArg = String(trigMatch[2] || '').trim();
      if (!rawArg) return `\\${normalizedFunc}`;

      const normalizeTrigArgument =
        typeof globalThis !== 'undefined' &&
        globalThis.subjects &&
        globalThis.subjects.trig &&
        typeof globalThis.subjects.trig.normalizeTrigArgument === 'function'
          ? globalThis.subjects.trig.normalizeTrigArgument
          : (value) => String(value || '').trim();

      const arg = normalizeTrigArgument(rawArg);
      const alreadyGrouped = /^\(.*\)$/.test(arg);
      if (alreadyGrouped) return `\\${normalizedFunc}${arg}`;
      return `\\${normalizedFunc}(${arg})`;
    }

    const greekMap = {
      theta: '\\theta',
      alpha: '\\alpha',
      beta: '\\beta',
      gamma: '\\gamma',
      delta: '\\delta',
      lambda: '\\lambda',
      mu: '\\mu',
      sigma: '\\sigma',
      omega: '\\omega',
      pi: '\\pi'
    };
    const key = tail.replace(/^\\/, '').toLowerCase();
    return greekMap[key] || tail;
  }

  function buildFractionAmbiguityCandidates(input){
    const raw = String(input ?? '').trim().replace(/\s+/g, '');
    if (!raw || !raw.includes('/')) return [];

    const suggestions = new Set();

    const split = splitTopLevelFraction(raw);
    if (split) {
      const compactNumerator = String(split.numerator || '').replace(/\s+/g, '');
      const numeratorLooksLikeTrigCall = /^(?:\\)?(?:(?:arc|a)?(?:sin|cos|tan|sec|csc|cot|cosec))(?:\^\{?-?1\}?|[−-]1|⁻¹)?[a-z0-9\\πθα-ω]*$/i.test(compactNumerator);
      if (numeratorLooksLikeTrigCall) {
        return [];
      }

      const numeratorLatex = normalizeFractionComponent(split.numerator);
      const denominatorLatex = normalizeFractionComponent(split.denominator);

      if (numeratorLatex && denominatorLatex) {
        suggestions.add(`\\frac{${numeratorLatex}}{${denominatorLatex}}`);
        buildRationalizedCandidates(numeratorLatex, denominatorLatex).forEach(candidate => suggestions.add(candidate));
      }
    }

    const plainFraction = raw.match(/^([+\-]?\d+(?:\.\d+)?)\/([+\-]?\d+(?:\.\d+)?)$/);
    if (plainFraction) {
      const numerator = plainFraction[1];
      const denominator = plainFraction[2];
      suggestions.add(`\\frac{${numerator}}{${denominator}}`);
      suggestions.add(`${numerator}/${denominator}`);
    }

    const tailFraction = raw.match(/^([+\-]?\d+(?:\.\d+)?)\/([+\-]?\d+(?:\.\d+)?)([A-Za-z\\α-ωΑ-Ωπθδλμσωβγ][A-Za-z0-9_\\^{}()α-ωΑ-Ωπθδλμσωβγ]*)$/i);
    if (tailFraction) {
      const numerator = tailFraction[1];
      const denominator = tailFraction[2];
      const tail = normalizeFractionTail(tailFraction[3]);
      suggestions.add(`\\frac{${numerator}}{${denominator}}${tail}`);
      suggestions.add(`\\frac{${numerator}}{${denominator}${tail}}`);
    }

    return Array.from(suggestions);
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.buildFractionAmbiguityCandidates = buildFractionAmbiguityCandidates;
    globalThis.subjects = globalThis.subjects || {};
    globalThis.subjects.fractions = {
      getSuggestions: buildFractionAmbiguityCandidates,
      buildFractionAmbiguityCandidates
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      getSuggestions: buildFractionAmbiguityCandidates,
      buildFractionAmbiguityCandidates
    };
  }
})();
