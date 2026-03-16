// mathToLatex.js - Centralized math notation to LaTeX conversion orchestrator
// PURE ORCHESTRATION: Delegates to subject-specific modules via globalThis

// ============================================================================
// CENTRALIZED RULES MANAGEMENT
// ============================================================================

// Initialize empty RULES array to be populated by subject modules
let RULES = [];

// Function to add subject-specific rules (called by subject modules)
function addSubjectRules(newRules) {
  if (Array.isArray(newRules)) {
    RULES = RULES.concat(newRules);
  }
}

// Load rules from subject modules (these are loaded before mathToLatex.js)
if (typeof globalThis !== 'undefined') {
  if (globalThis.LOG_RULES) addSubjectRules(globalThis.LOG_RULES);
  if (globalThis.VECTOR_RULES) addSubjectRules(globalThis.VECTOR_RULES);
  if (globalThis.NORMAL_RULES) addSubjectRules(globalThis.NORMAL_RULES);
}

// ============================================================================
// CORE RULE COMPILATION AND MATCHING
// ============================================================================

function compileRules(rules) {
  const compiled = [];
  for (const [pattern, replacement] of rules) {
    if (pattern.includes('%')) {
      let escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      escaped = escaped.replace(/%/g, '(.+)');
      const regex = new RegExp(`^${escaped}$`, 'i');
      compiled.push({ regex, replacement, isWildcard: true, pattern });
    } else {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escaped}$`, 'i');
      compiled.push({ regex, replacement, isWildcard: false, pattern });
    }
  }
  return compiled;
}

// Compile all rules once (includes all subject rules)
let COMPILED_RULES = compileRules(RULES);

function matchRules(value) {
  for (const rule of COMPILED_RULES) {
    const match = value.match(rule.regex);
    if (!match) continue;

    let suggestions = Array.isArray(rule.replacement)
      ? rule.replacement
      : [rule.replacement];

    if (rule.isWildcard) {
      suggestions = suggestions.map(template => {
        let result = template;
        for (let i = 1; i < match.length; i++) {
          const subInput = match[i];
          const subLatex = mathToLatex(subInput);
          result = result.split(`$${i}`).join(subLatex);
        }
        return result;
      });
    }

    return { found: true, suggestions };
  }

  return { found: false, suggestions: [] };
}

// ============================================================================
// MAIN SUGGESTION ORCHESTRATOR
// ============================================================================

function getLatexSuggestions(input, maxSuggestions = 5) {
  if (typeof input !== 'string') return [input];
  let trimmed = input.trim();
  if (!trimmed) return [''];

  // Normalize some common LaTeX/MathLive quirks
  trimmed = trimmed.replace(/\\textasciicircum/g, '^')
    .replace(/\\textasteriskcentered/g, '*').replace(/\\ast\b/g, '*')
    .replace(/^\*\s*(?=\\|[a-zA-Zπθ])/i, '')
    .replace(/\\cdot(?!s)/g, '*')
    .replace(/\\times/g, '*')
    .replace(/[·⋅]/g, '*')
    .replace(/−/g, '-')
    .replace(/\\left/g, '').replace(/\\right/g, '')
    .replace(/⁻¹/g, '^-1')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/ⁿ/g, '^n');

  trimmed = trimmed.replace(/^([+\-]+)\s*(?:\\pi|pi)$/i, (match, signs) => {
    const hasMinus = String(signs || '').includes('-');
    return hasMinus ? '-pi' : 'pi';
  });

  if (typeof globalThis !== 'undefined' && typeof globalThis.normalizeCommonMathTypos === 'function') {
    trimmed = globalThis.normalizeCommonMathTypos(trimmed);
  }

  // No operator extraction here - that's the UI layer's job (app.js)
  // mathToLatex.js is a PURE ORCHESTRATOR that delegates to subject modules
  const queryTerm = trimmed;

  const allSuggestions = [];

  // 0. Bracketed power fallback: (... )2, (... )^2, (... )^{2} -> (... )^{2}
  const compactQueryTerm = queryTerm.replace(/\s+/g, '');
  const bracketPowerMatch = compactQueryTerm.match(/^(.*\))(?:\^?\{?([0-9n]+)\}?)$/i);
  if (bracketPowerMatch) {
    const base = bracketPowerMatch[1];
    const exponent = bracketPowerMatch[2];
    allSuggestions.push(`${base}^{${exponent}}`);
  }

  // 0.5. Degree notation shorthand detection
  // "35o" → user typed letter 'o' as degree symbol
  const degreeOMatch = compactQueryTerm.match(/^(\d+(?:\.\d+)?)o$/i);
  if (degreeOMatch) {
    allSuggestions.push(`${degreeOMatch[1]}^{\\circ}`);
  }



  // 0.6. Fractional power shorthand: x1/2 → x^{1/2}, x2/3 → x^{2/3}
  // Students often omit ^ and brackets when writing fractional exponents
  const fracPowerMatch = compactQueryTerm.match(/^([a-zA-Zα-ωΑ-Ωπθ][a-zA-Z0-9α-ωΑ-Ωπθ]*)(\d+)\/(\d+)$/);
  if (fracPowerMatch) {
    const base = fracPowerMatch[1];
    const num = fracPowerMatch[2];
    const den = fracPowerMatch[3];
    // Fractional power interpretation: x^(1/2), x^(2/3), etc.
    allSuggestions.push(`{${base}}^{\\frac{${num}}{${den}}}`);
    // Special roots
    if (num === '1' && den === '2') {
      allSuggestions.push(`\\sqrt{${base}}`);
    } else if (num === '1' && den === '3') {
      allSuggestions.push(`\\sqrt[3]{${base}}`);
    } else if (num === '1') {
      allSuggestions.push(`\\sqrt[${den}]{${base}}`);
    }
    // Multiplication interpretation: x * 1/2
    allSuggestions.push(`${base} \\cdot \\frac{${num}}{${den}}`);
  }

  // 1. Try trig system via trig module (most comprehensive for trig)
  if (typeof globalThis !== 'undefined' && globalThis.subjects && globalThis.subjects.trig) {
    const trigSuggestions = globalThis.subjects.trig.getTrigSuggestions(queryTerm, maxSuggestions);
    if (Array.isArray(trigSuggestions) && trigSuggestions.length) {
      allSuggestions.push(...trigSuggestions);
    }
  }

  const shouldSkipCentralRuleMatching =
    typeof globalThis !== 'undefined' &&
    globalThis.subjects &&
    globalThis.subjects.trig &&
    typeof globalThis.subjects.trig.shouldSkipCentralRuleMatching === 'function'
      ? globalThis.subjects.trig.shouldSkipCentralRuleMatching(queryTerm, allSuggestions)
      : false;

  // 2. Try centralized rule matching (all subject rules)
  if (!shouldSkipCentralRuleMatching) {
    const matchResult = matchRules(queryTerm);
    if (matchResult.found) {
      allSuggestions.push(...matchResult.suggestions);
    }
  }

  // 2.5 Fraction ambiguity (algebra): a/bx can mean (a/b)x or a/(bx)
  if (typeof globalThis !== 'undefined' && typeof globalThis.buildFractionAmbiguityCandidates === 'function') {
    const fractionAmbiguities = globalThis.buildFractionAmbiguityCandidates(queryTerm);
    if (Array.isArray(fractionAmbiguities) && fractionAmbiguities.length) {
      allSuggestions.push(...fractionAmbiguities);
    }
  }

  // 3. PERMUTATION ENGINE - Generate alternative interpretations
  if (typeof globalThis !== 'undefined' && globalThis.generatePermutations) {
    console.log('[getLatexSuggestions] Calling permutation engine for:', queryTerm);
    const permutations = globalThis.generatePermutations(queryTerm);
    console.log('[getLatexSuggestions] Permutations returned:', permutations);
    if (Array.isArray(permutations) && permutations.length > 0) {
      // Filter out duplicates and the original query
      const uniquePerms = permutations.filter(perm => 
        perm !== queryTerm && !allSuggestions.includes(perm)
      );
      allSuggestions.push(...uniquePerms);
    }
  }
  
  // 4. Deduplicate and limit
  const uniqueSuggestions = [...new Set(allSuggestions)];
  
  // 5. If still nothing, return queryTerm as-is
  if (uniqueSuggestions.length === 0) {
    return [queryTerm];
  }
  
  return uniqueSuggestions.slice(0, maxSuggestions);
}

// Provide a fallback mathToLatex definition for use in matchRules
function mathToLatex(input) {
  const suggestions = getLatexSuggestions(input, 1);
  return suggestions[0];
}

// ============================================================================
// PERMUTATION ENGINE ORCHESTRATOR
// ============================================================================
// Generates alternative interpretations of ambiguous student input
// Uses math-extractor-enhanced.js for keyword + operand parsing
// Delegates to subject-specific permutation rule modules

function generatePermutations(input) {
  const mathExpr = typeof input === 'string' ? input : input?.expr || input?.toString() || '';
  if (!mathExpr || typeof mathExpr !== 'string') return [];
  
  const perms = new Set();
  perms.add(mathExpr); // Always include raw input
  
  // Try to parse the expression into keyword + operand
  let parsed = null;
  if (typeof globalThis !== 'undefined' && globalThis.parseExpression) {
    parsed = globalThis.parseExpression(mathExpr);
    if (parsed) console.log('[generatePermutations] Parsed:', mathExpr, '→', parsed);
  } else {
    console.warn('[generatePermutations] globalThis.parseExpression not available');
  }
  
  // If no parsing available, fallback to direct rule application
  if (!parsed) {
    console.log('[generatePermutations] No parse, using fallback rules for:', mathExpr);
    return applyPermutationRulesDirect(mathExpr);
  }
  
  // Route to appropriate permutation generator based on parsed type
  if (parsed.type === 'logarithm' && globalThis.logPermutationRules) {
    const logPerms = globalThis.logPermutationRules.generateLogPermutations(parsed.operand);
    console.log('[generatePermutations] Log perms for', parsed.operand, ':', logPerms);
    for (const perm of logPerms) perms.add(perm);
  }
  
  if (parsed.type === 'trigonometry' && globalThis.trigPermutationRules) {
    const trigSource = `${parsed.prefix || ''}${parsed.keyword || ''}${parsed.operand || ''}`;
    const trigPerms = globalThis.trigPermutationRules.generateTrigPermutations(trigSource);
    console.log('[generatePermutations] Trig perms for', trigSource, ':', trigPerms);
    for (const perm of trigPerms) perms.add(perm);

    const rawKeyword = String(parsed.keyword || '').toLowerCase();
    const normalizedFunc = rawKeyword === 'cosec' ? 'csc' : rawKeyword;
    const rawOperand = String(parsed.operand || '').trim();
    const trigSubject = globalThis.subjects?.trig || {};
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
        if (needsStar) {
          perms.add(`${rawPrefix}*${trigCall}`);
        }
      }
    }
  }
  
  if (parsed.type === 'inverse_trigonometry' && globalThis.trigPermutationRules) {
    const invTrigPerms = globalThis.trigPermutationRules.generateInverseTrigPermutations(mathExpr);
    console.log('[generatePermutations] Inverse trig perms for', mathExpr, ':', invTrigPerms);
    for (const perm of invTrigPerms) perms.add(perm);
  }
  
  if (parsed.type === 'implicit_multiplication' && globalThis.algebraPermutationRules) {
    // Pass parsed structure instead of string
    const algPerms = globalThis.algebraPermutationRules.generateImplicitMultiplicationPermutations(
      parsed.num1, parsed.variable, parsed.num2, parsed.prefix, parsed.suffix
    );
    console.log('[generatePermutations] Algebra perms (mult):', algPerms);
    for (const perm of algPerms) perms.add(perm);
  }
  
  if (parsed.type === 'function_application' && globalThis.algebraPermutationRules) {
    const algPerms = globalThis.algebraPermutationRules.generateFunctionAppPermutations(
      parsed.keyword, parsed.variable, parsed.prefix, parsed.suffix
    );
    console.log('[generatePermutations] Algebra perms (func):', algPerms);
    for (const perm of algPerms) perms.add(perm);
  }
  
  if (parsed.type === 'power_ambiguity' && globalThis.algebraPermutationRules) {
    const algPerms = globalThis.algebraPermutationRules.generatePowerAmbiguityPermutations(
      parsed.base, parsed.exponent, parsed.variable, parsed.prefix, parsed.suffix
    );
    console.log('[generatePermutations] Algebra perms (power):', algPerms);
    for (const perm of algPerms) perms.add(perm);
  }
  
  const result = Array.from(perms).filter(perm => isValidPermutation(perm));
  console.log('[generatePermutations] Final result:', result);
  return result;
}

/**
 * Fallback: Apply rules directly without parsing (for backward compatibility)
 */
function applyPermutationRulesDirect(input) {
  const perms = new Set();
  perms.add(input);
  
  if (typeof globalThis !== 'undefined') {
    if (globalThis.logPermutationRules) {
      const logPerms = globalThis.logPermutationRules.generateLogPermutations(input);
      for (const perm of logPerms) perms.add(perm);
    }
    if (globalThis.trigPermutationRules) {
      const trigPerms = globalThis.trigPermutationRules.generateTrigPermutations(input);
      for (const perm of trigPerms) perms.add(perm);
    }
    if (globalThis.algebraPermutationRules) {
      const algPerms = globalThis.algebraPermutationRules.generateAlgebraPermutations(input);
      for (const perm of algPerms) perms.add(perm);
    }
  }
  
  return Array.from(perms).filter(perm => isValidPermutation(perm));
}

function isValidPermutation(expr) {
  if (!expr || typeof expr !== 'string') return false;
  
  const trimmed = expr.trim();
  if (trimmed.length === 0) return false;
  
  // Try subject-specific validators first
  if (typeof globalThis !== 'undefined') {
    if (globalThis.logPermutationRules?.isValidLogExpression(trimmed)) return true;
    if (globalThis.trigPermutationRules?.isValidTrigExpression?.(trimmed)) return true;
    if (globalThis.algebraPermutationRules?.isValidAlgebraExpression?.(trimmed)) return true;
  }
  
  // Fallback general validation
  if (!/\d|[a-zθπα-ω]|π|∞/i.test(trimmed)) return false;
  if (/\+\+|\*\*|\^\^|--(?!\>)/.test(trimmed)) return false;
  
  let parenCount = 0;
  for (const char of trimmed) {
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
    if (parenCount < 0) return false;
  }
  if (parenCount !== 0) return false;
  
  if (trimmed.includes('()')) return false;
  if (trimmed.match(/\/\s*0(?:\s|$|\))/)) return false;
  if (/^[-+*^/]|[-+*^/]$/.test(trimmed.split('\\').pop())) return false;
  
  return true;
}

// Export for use in app and Node
if (typeof globalThis !== 'undefined') {
  globalThis.getLatexSuggestions = getLatexSuggestions;
  globalThis.mathToLatex = mathToLatex;
  globalThis.generatePermutations = generatePermutations;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getLatexSuggestions, mathToLatex, generatePermutations };
}
