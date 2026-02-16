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
    .replace(/\\left/g, '').replace(/\\right/g, '');

  // Extract the last term (after operators like +, -, *, /, ÷, \div, \times, etc.)
  // This handles: "sin^2(x)+cos^2(x)" or "sin^2(x) + cos^2(x)" → suggests for "cos^2(x)"
  let queryTerm = trimmed;
  // Match any top-level operator: +, -, *, /, ÷, ×, with or without spaces
  const operatorMatch = trimmed.match(/(?:[+\-*\/÷×]|\\\w+)\s*(.+)$/);
  if (operatorMatch && operatorMatch[1]) {
    queryTerm = operatorMatch[1].trim();
  }

  // 1. Try trig system via trig module (most comprehensive for trig)
  if (typeof globalThis !== 'undefined' && globalThis.subjects && globalThis.subjects.trig) {
    const trigSuggestions = globalThis.subjects.trig.getTrigSuggestions(queryTerm, maxSuggestions);
    if (Array.isArray(trigSuggestions) && trigSuggestions.length) {
      return trigSuggestions;
    }
  }

  // 2. Fallback: use centralized rule matching (all subject rules)
  const matchResult = matchRules(queryTerm);
  if (matchResult.found) {
    return matchResult.suggestions.slice(0, maxSuggestions);
  }
  
  // 3. If still nothing, return queryTerm as-is
  return [queryTerm];
}

// Provide a fallback mathToLatex definition for use in matchRules
function mathToLatex(input) {
  const suggestions = getLatexSuggestions(input, 1);
  return suggestions[0];
}

// Export for use in app and Node
if (typeof globalThis !== 'undefined') {
  globalThis.getLatexSuggestions = getLatexSuggestions;
  globalThis.mathToLatex = mathToLatex;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getLatexSuggestions, mathToLatex };
}
