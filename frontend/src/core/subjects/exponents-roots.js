(function(){
  const SUPERSCRIPT_TO_ASCII = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9'
  };

  const SUBSCRIPT_TO_ASCII = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9'
  };

  function replaceNamedToken(value, token, latex){
    const pattern = new RegExp(`(^|[^a-zA-Z\\\\])${token}(?=[^a-zA-Z]|$)`, 'gi');
    return String(value || '').replace(pattern, (match, prefix) => `${prefix}${latex}`);
  }

  function normalizeMathToken(value){
    let output = String(value || '').trim();
    if (!output) return output;

    if (typeof globalThis !== 'undefined' && typeof globalThis.normalizeCommonMathTypos === 'function') {
      output = globalThis.normalizeCommonMathTypos(output);
    }

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
      .replace(/ω/g, '\\omega')
      .replace(/Σ/g, '\\Sigma')
      .replace(/σ/g, '\\sigma')
      .replace(/\s+/g, '');

    output = replaceNamedToken(output, 'pi', '\\pi');
    output = replaceNamedToken(output, 'theta', '\\theta');
    output = replaceNamedToken(output, 'alpha', '\\alpha');
    output = replaceNamedToken(output, 'beta', '\\beta');
    output = replaceNamedToken(output, 'gamma', '\\gamma');
    output = replaceNamedToken(output, 'delta', '\\delta');
    output = replaceNamedToken(output, 'lambda', '\\lambda');
    output = replaceNamedToken(output, 'mu', '\\mu');
    output = replaceNamedToken(output, 'sigma', '\\sigma');
    output = replaceNamedToken(output, 'omega', '\\omega');
    output = replaceNamedToken(output, 'sum', '\\Sigma');

    return output;
  }

  function stripOuterParens(value){
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

  function toSuperscriptDigits(value){
    return String(value || '').split('').map(ch => SUPERSCRIPT_TO_ASCII[ch] || ch).join('');
  }

  function toSubscriptDigits(value){
    return String(value || '').split('').map(ch => SUBSCRIPT_TO_ASCII[ch] || ch).join('');
  }

  function isSimpleAtom(value){
    return /^[a-zA-Z\\α-ωΑ-Ωπθ][a-zA-Z0-9_\\α-ωΑ-Ωπθ]*$/.test(String(value || ''));
  }

  function isLikelyFunctionToken(value){
    const token = String(value || '').replace(/^\\/, '').toLowerCase();
    if (!token) return false;
    const functionLike = new Set([
      'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'cosec',
      'asin', 'acos', 'atan', 'arcsin', 'arccos', 'arctan',
      'log', 'ln', 'sqrt', 'root', 'cbrt', 'abs', 'exp', 'sum', 'mod'
    ]);
    return functionLike.has(token);
  }

  function wrapBase(base){
    const normalized = normalizeMathToken(stripOuterParens(base));
    if (!normalized) return '';
    if (isSimpleAtom(normalized)) return normalized;
    return `{${normalized}}`;
  }

  function buildPowerSuggestions(baseRaw, exponentRaw, suggestions){
    const base = wrapBase(baseRaw);
    const exponentInput = stripOuterParens(String(exponentRaw || '').replace(/[{}]/g, ''));
    const exponent = normalizeMathToken(exponentInput);
    if (!base || !exponent) return;

    const fractionMatch = exponent.match(/^([+\-]?\d+)\/([+\-]?\d+)$/);
    if (fractionMatch) {
      const num = fractionMatch[1];
      const den = fractionMatch[2];
      suggestions.add(`${base}^{\\frac{${num}}{${den}}}`);
      if (num === '1' && den === '2') suggestions.add(`\\sqrt{${normalizeMathToken(stripOuterParens(baseRaw))}}`);
      if (num === '1' && den === '3') suggestions.add(`\\sqrt[3]{${normalizeMathToken(stripOuterParens(baseRaw))}}`);
      if (num === '1' && den !== '2' && den !== '3') suggestions.add(`\\sqrt[${den}]{${normalizeMathToken(stripOuterParens(baseRaw))}}`);
      return;
    }

    suggestions.add(`${base}^{${exponent}}`);
  }

  function buildRootSuggestions(indexRaw, radicandRaw, suggestions){
    const radicand = normalizeMathToken(stripOuterParens(radicandRaw));
    if (!radicand) return;

    const idx = String(indexRaw || '').trim();
    if (!idx || idx === '2') {
      suggestions.add(`\\sqrt{${radicand}}`);
      suggestions.add(`${wrapBase(radicand)}^{\\frac{1}{2}}`);
      return;
    }

    const normalizedIdx = normalizeMathToken(idx);
    suggestions.add(`\\sqrt[${normalizedIdx}]{${radicand}}`);
    suggestions.add(`${wrapBase(radicand)}^{\\frac{1}{${normalizedIdx}}}`);
  }

  function buildVariableSuggestions(tokenRaw, suggestions){
    const token = normalizeMathToken(tokenRaw);
    if (!token || !isSimpleAtom(token)) return;

    suggestions.add(token);
    suggestions.add(`${token}^{2}`);
    suggestions.add(`${token}^{3}`);
    suggestions.add(`${token}^{n}`);
    suggestions.add(`\\sqrt{${token}}`);
  }

  function getExponentRootSuggestions(input, maxSuggestions = 5){
    const raw = String(input || '').trim();
    if (!raw) return [];

    const compact = raw.replace(/\s+/g, '');
    const normalizedCompact = toSuperscriptDigits(compact);
    const suggestions = new Set();

    const subscriptSymbolMatch = normalizedCompact.match(/^(.+?)([₀₁₂₃₄₅₆₇₈₉]+)$/);
    if (subscriptSymbolMatch) {
      const base = normalizeMathToken(subscriptSymbolMatch[1]);
      const sub = toSubscriptDigits(subscriptSymbolMatch[2]);
      if (base && sub) suggestions.add(`${base}_{${sub}}`);
    }

    const subscriptMatch = normalizedCompact.match(/^([a-zA-Z\\α-ωΑ-Ωπθ][a-zA-Z0-9\\α-ωΑ-Ωπθ]*)_(\d+)$/);
    if (subscriptMatch) {
      suggestions.add(`${normalizeMathToken(subscriptMatch[1])}_{${subscriptMatch[2]}}`);
    }

    const hatMatch = normalizedCompact.match(/^(.+?)(?:_hat|hat)$/i);
    if (hatMatch) {
      const base = normalizeMathToken(hatMatch[1]);
      if (base) suggestions.add(`\\hat{${base}}`);
    }

    const absMatch = normalizedCompact.match(/^abs\((.+)\)$/i);
    if (absMatch) {
      const inner = normalizeMathToken(absMatch[1]);
      if (inner) suggestions.add(`\\left|${inner}\\right|`);
    }

    const absBarMatch = normalizedCompact.match(/^\|(.+)\|$/);
    if (absBarMatch) {
      const inner = normalizeMathToken(absBarMatch[1]);
      if (inner) suggestions.add(`\\left|${inner}\\right|`);
    }

    const rootParenMatch = normalizedCompact.match(/^(?:sqrt|root)\((.+)\)$/i);
    if (rootParenMatch) {
      buildRootSuggestions('2', rootParenMatch[1], suggestions);
    }

    const cbrtParenMatch = normalizedCompact.match(/^cbrt\((.+)\)$/i);
    if (cbrtParenMatch) {
      buildRootSuggestions('3', cbrtParenMatch[1], suggestions);
    }

    const rootIndexMatch = normalizedCompact.match(/^(?:root|sqrt)(\d+)\((.+)\)$/i);
    if (rootIndexMatch) {
      buildRootSuggestions(rootIndexMatch[1], rootIndexMatch[2], suggestions);
    }

    const rootIndexInlineRadicandMatch = normalizedCompact.match(/^(?:root|sqrt)(\d+)([a-zA-Z0-9\\α-ωΑ-Ωπθ][a-zA-Z0-9_\\^{}()α-ωΑ-Ωπθ]*)$/i);
    if (rootIndexInlineRadicandMatch) {
      buildRootSuggestions(rootIndexInlineRadicandMatch[1], rootIndexInlineRadicandMatch[2], suggestions);
    }

    const cbrtInlineMatch = normalizedCompact.match(/^cbrt([a-zA-Z0-9\\α-ωΑ-Ωπθ][a-zA-Z0-9_\\^{}()α-ωΑ-Ωπθ]*)$/i);
    if (cbrtInlineMatch) {
      buildRootSuggestions('3', cbrtInlineMatch[1], suggestions);
    }

    const rootIndexOnlyMatch = normalizedCompact.match(/^(?:root|sqrt)(\d+)$/i);
    if (rootIndexOnlyMatch) {
      const idx = rootIndexOnlyMatch[1];
      suggestions.add(`\\sqrt[${idx}]{x}`);
      suggestions.add(`x^{\\frac{1}{${idx}}}`);
    }

    if (/^cbrt$/i.test(normalizedCompact)) {
      suggestions.add('\\sqrt[3]{x}');
      suggestions.add('x^{\\frac{1}{3}}');
    }

    const rootSymbolMatch = normalizedCompact.match(/^√(.+)$/);
    if (rootSymbolMatch) {
      buildRootSuggestions('2', rootSymbolMatch[1], suggestions);
    }

    const powerMatch = normalizedCompact.match(/^(.+)\^\{?([^{}]+)\}?$/);
    if (powerMatch) {
      buildPowerSuggestions(powerMatch[1], powerMatch[2], suggestions);
    }

    const splitFracPowerMatch = normalizedCompact.match(/^(.+)\^\{?([+\-]?\d+)\}?\/([+\-]?\d+)$/);
    if (splitFracPowerMatch) {
      buildPowerSuggestions(splitFracPowerMatch[1], `${splitFracPowerMatch[2]}/${splitFracPowerMatch[3]}`, suggestions);
    }

    const groupedSplitFracPowerMatch = normalizedCompact.match(/^(.+)\^\(?([+\-]?\d+)\/([+\-]?\d+)\)?$/);
    if (groupedSplitFracPowerMatch) {
      buildPowerSuggestions(groupedSplitFracPowerMatch[1], `${groupedSplitFracPowerMatch[2]}/${groupedSplitFracPowerMatch[3]}`, suggestions);
    }

    const inlinePowerMatch = normalizedCompact.match(/^([a-zA-Z\\α-ωΑ-Ωπθ][a-zA-Z_\\α-ωΑ-Ωπθ]*)(\d+)$/);
    if (inlinePowerMatch) {
      const baseToken = inlinePowerMatch[1];
      const exponentToken = inlinePowerMatch[2];
      if (!isLikelyFunctionToken(baseToken)) {
        buildPowerSuggestions(baseToken, exponentToken, suggestions);
      }
    }

    const groupedInlinePowerMatch = normalizedCompact.match(/^\((.+)\)(\d+)$/);
    if (groupedInlinePowerMatch) {
      buildPowerSuggestions(groupedInlinePowerMatch[1], groupedInlinePowerMatch[2], suggestions);
    }

    const compactFracPowerMatch = normalizedCompact.match(/^([a-zA-Z\\α-ωΑ-Ωπθ][a-zA-Z0-9\\α-ωΑ-Ωπθ]*)(\d+)\/(\d+)$/);
    if (compactFracPowerMatch) {
      buildPowerSuggestions(compactFracPowerMatch[1], `${compactFracPowerMatch[2]}/${compactFracPowerMatch[3]}`, suggestions);
      suggestions.add(`${normalizeMathToken(compactFracPowerMatch[1])} \\cdot \\frac{${compactFracPowerMatch[2]}}{${compactFracPowerMatch[3]}}`);
    }

    const superscriptPowerMatch = normalizedCompact.match(/^(.+?)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/);
    if (superscriptPowerMatch) {
      const base = superscriptPowerMatch[1];
      const exponent = toSuperscriptDigits(superscriptPowerMatch[2]);
      if (exponent) buildPowerSuggestions(base, exponent, suggestions);
    }

    const simpleVariableMatch = normalizedCompact.match(/^[a-zA-Z\\α-ωΑ-Ωπθ]$/);
    if (simpleVariableMatch) {
      buildVariableSuggestions(normalizedCompact, suggestions);
    }

    return Array.from(suggestions).slice(0, maxSuggestions);
  }

  function normalizeExponentSuggestion(value){
    const raw = String(value ?? '').trim();
    if (!raw) return raw;

    const groupedFracExponent = raw.match(/^(.+)\^\{?\(?([+\-]?\d+)\s*\/\s*([+\-]?\d+)\)?\}?$/);
    if (groupedFracExponent) {
      const base = wrapBase(groupedFracExponent[1]);
      const numerator = groupedFracExponent[2];
      const denominator = groupedFracExponent[3];
      if (base && denominator !== '0') {
        return `${base}^{\\frac{${numerator}}{${denominator}}}`;
      }
    }

    const splitExponentAndDivision = raw.match(/^(.+)\^\{?([+\-]?\d+)\}?\/([+\-]?\d+)$/);
    if (splitExponentAndDivision) {
      const base = wrapBase(splitExponentAndDivision[1]);
      const numerator = splitExponentAndDivision[2];
      const denominator = splitExponentAndDivision[3];
      if (base && denominator !== '0') {
        return `${base}^{\\frac{${numerator}}{${denominator}}}`;
      }
    }

    return raw;
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.subjects = globalThis.subjects || {};
    globalThis.subjects.exponentsRoots = {
      getSuggestions: getExponentRootSuggestions,
      getExponentRootSuggestions,
      normalizeMathToken,
      normalizeSuggestion: normalizeExponentSuggestion
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      getSuggestions: getExponentRootSuggestions,
      getExponentRootSuggestions,
      normalizeMathToken,
      normalizeSuggestion: normalizeExponentSuggestion
    };
  }
})();
