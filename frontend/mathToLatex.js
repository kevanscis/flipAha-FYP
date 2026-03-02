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
  const subjectModules =
    typeof globalThis !== 'undefined' && globalThis.subjects && typeof globalThis.subjects === 'object'
      ? Object.values(globalThis.subjects)
      : [];

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

  // "350" → trailing zero may be intended as degree symbol for "35°"
  if (!degreeOMatch) {
    const degreeZeroMatch = compactQueryTerm.match(/^(\d{2,})0$/);
    if (degreeZeroMatch) {
      const possibleAngle = parseInt(degreeZeroMatch[1], 10);
      if (possibleAngle > 0 && possibleAngle <= 360) {
        allSuggestions.push(`${degreeZeroMatch[1]}^{\\circ}`);
      }
    }
  }

  // 0.6 Subject-level dynamic suggestions
  for (const subject of subjectModules) {
    if (!subject || typeof subject.getSuggestions !== 'function') continue;
    const suggestions = subject.getSuggestions(queryTerm, maxSuggestions);
    if (Array.isArray(suggestions) && suggestions.length) {
      allSuggestions.push(...suggestions);
    }
  }

  const shouldSkipCentralRuleMatching =
    subjectModules.some(subject =>
      subject &&
      typeof subject.shouldSkipCentralRuleMatching === 'function' &&
      subject.shouldSkipCentralRuleMatching(queryTerm, allSuggestions)
    );

  // 2. Try centralized rule matching (all subject rules)
  if (!shouldSkipCentralRuleMatching) {
    const matchResult = matchRules(queryTerm);
    if (matchResult.found) {
      allSuggestions.push(...matchResult.suggestions);
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

  const normalizedSuggestions = allSuggestions.map((value) => {
    let output = String(value ?? '').trim();
    if (!output) return output;
    for (const subject of subjectModules) {
      if (!subject || typeof subject.normalizeSuggestion !== 'function') continue;
      const normalized = subject.normalizeSuggestion(output, queryTerm);
      if (typeof normalized === 'string' && normalized.trim()) {
        output = normalized.trim();
      }
    }
    return output;
  });
  
  // 4. Deduplicate and limit (semantic dedupe, not just exact-string dedupe)
  const canonicalizeSuggestion = (value) => {
    let normalized = String(value ?? '').trim();
    if (!normalized) return '';

    normalized = normalized
      .replace(/\left/g, '')
      .replace(/\right/g, '')
      .replace(/\s+/g, '')
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .replace(/ⁿ/g, '^n')
      .replace(/\^\{([^{}]+)\}/g, '^$1')
      .replace(/_\{([^{}]+)\}/g, '_$1')
      .replace(/\{([a-zA-Z\\α-ωΑ-Ωπθ][a-zA-Z0-9_\\α-ωΑ-Ωπθ]*)\}\^/g, '$1^')
      .replace(/\{([a-zA-Z\\α-ωΑ-Ωπθ][a-zA-Z0-9_\\α-ωΑ-Ωπθ]*)\}_/g, '$1_');

    return normalized;
  };

  const uniqueSuggestions = [];
  const seenCanonical = new Set();
  for (const suggestion of normalizedSuggestions) {
    const candidate = String(suggestion ?? '').trim();
    if (!candidate) continue;

    const canonical = canonicalizeSuggestion(candidate);
    if (!canonical || seenCanonical.has(canonical)) continue;

    seenCanonical.add(canonical);
    uniqueSuggestions.push(candidate);
  }
  
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
  
  // Route to rule modules using parsed handlers
  if (globalThis.logPermutationRules?.generateParsedLogPermutations) {
    const logPerms = globalThis.logPermutationRules.generateParsedLogPermutations(parsed);
    console.log('[generatePermutations] Log perms for', mathExpr, ':', logPerms);
    for (const perm of logPerms) perms.add(perm);
  }

  if (globalThis.trigPermutationRules?.generateParsedTrigPermutations) {
    const trigPerms = globalThis.trigPermutationRules.generateParsedTrigPermutations(parsed);
    console.log('[generatePermutations] Trig perms for', mathExpr, ':', trigPerms);
    for (const perm of trigPerms) perms.add(perm);
  }

  if (globalThis.algebraPermutationRules?.generateParsedAlgebraPermutations) {
    const algPerms = globalThis.algebraPermutationRules.generateParsedAlgebraPermutations(parsed);
    console.log('[generatePermutations] Algebra perms for', mathExpr, ':', algPerms);
    for (const perm of algPerms) perms.add(perm);
  }

  if (globalThis.exponentPermutationRules) {
    const expPerms = globalThis.exponentPermutationRules.generateExponentPermutations(mathExpr);
    console.log('[generatePermutations] Exponent perms for', mathExpr, ':', expPerms);
    for (const perm of expPerms) perms.add(perm);
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
    if (globalThis.exponentPermutationRules) {
      const expPerms = globalThis.exponentPermutationRules.generateExponentPermutations(input);
      for (const perm of expPerms) perms.add(perm);
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
    if (globalThis.exponentPermutationRules?.isValidExponentExpression?.(trimmed)) return true;
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
