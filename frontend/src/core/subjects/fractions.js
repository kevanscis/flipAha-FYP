(function(){
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
      buildFractionAmbiguityCandidates
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      buildFractionAmbiguityCandidates
    };
  }
})();
