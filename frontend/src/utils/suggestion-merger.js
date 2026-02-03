// utils/suggestion-merger.js
import { getLatexSuggestions as originalGetLatexSuggestions } from './mathToLatex';

/**
 * SEAB ambiguity permutation rules
 */
const SEAB_AMBIGUITY_RULES = [
  // Rule 1: logAB → log_A(B) OR log(AB)
  [/^log(\d+)([a-z]?)$/i, (match) => {
    const digits = match[1];
    const suffix = match[2] || '';
    const perms = [];
    if (digits.length >= 2) perms.push(`log_${digits[0]}(${digits.slice(1)}${suffix})`);
    if (digits.length >= 3) perms.push(`log_${digits.slice(0, 2)}(${digits.slice(2)}${suffix})`);
    perms.push(`log(${digits}${suffix})`);
    return perms;
  }],
  
  // Rule 2: sinXN / cosXN / tanXN → 3 interpretations
  [/^(sin|cos|tan)([a-zθαβ])(\d)$/i, (match) => {
    const [_, func, varName, num] = match;
    return [
      `${func}(${num}${varName})`,
      `${func}(${varName}^${num})`,
      `${func}(${varName})^${num}`
    ];
  }],
  
  // Rule 3: Function application (fx → f(x))
  [/^([fghpq])([a-zθ])$/i, (match) => {
    const [_, func, varName] = match;
    return [`${func}(${varName})`, `${func}*${varName}`];
  }],
  
  // Rule 4: Implicit multiplication (2x3 → 2*x*3 OR 2*x^3)
  [/^(\d)([a-z])(\d)$/i, (match) => {
    const [_, num1, varName, num2] = match;
    return [`${num1}*${varName}*${num2}`, `${num1}*${varName}^${num2}`];
  }],
  
  // Rule 5: Power ambiguity (e^2x → e^(2x) OR e^2*x)
  [/^([a-z0-9])\^(\d)([a-z])$/i, (match) => {
    const [_, base, num, varName] = match;
    return [`${base}^(${num}${varName})`, `${base}^${num}*${varName}`];
  }],
  
  // Rule 6: Trig power notation (sin^2x → sin(x)^2)
  [/^(sin|cos|tan)\^(\d)([a-zθ])$/i, (match) => {
    const [_, func, power, varName] = match;
    return [`${func}(${varName})^${power}`];
  }]
];

/**
 * NEW: Concatenated function detection (2xlog, 2xsin, x^2log, etc.)
 */
const CONCATENATED_FUNCTION_RULES = [
  // Pattern: number + variable + function (2xlog, 3ysin, etc.)
  [/^(\d+)([a-zθαβπλμω]+)(sin|cos|tan|log|ln|sqrt|exp)(.*)$/i, (match) => {
    const [_, num, varName, func, rest] = match;
    return [
      `${num}*${varName}*${func}(${rest || 'x'})`,  // 2*x*log(x)
      `${num}${varName}*${func}(${rest || 'x'})`,   // 2x*log(x)
      `${num}*${varName}${func}(${rest || 'x'})`    // 2*xlog(x) - less common
    ];
  }],
  
  // Pattern: variable + function (xlog, ysin, etc.)
  [/^([a-zθαβπλμω]+)(sin|cos|tan|log|ln|sqrt|exp)(.*)$/i, (match) => {
    const [_, varName, func, rest] = match;
    return [
      `${varName}*${func}(${rest || 'x'})`,  // x*log(x)
      `${varName}${func}(${rest || 'x'})`    // xlog(x) - implicit mult
    ];
  }],
  
  // Pattern: expression + function (x^2log, (x+1)sin, etc.)
  [/^(.+)(sin|cos|tan|log|ln|sqrt|exp)(.*)$/i, (match) => {
    const [_, expr, func, rest] = match;
    // Only apply if expr ends with math character (not operator)
    if (/[a-z0-9θαβπλμω)\]]$/i.test(expr)) {
      return [
        `${expr}*${func}(${rest || 'x'})`,  // x^2*log(x)
        `${expr}${func}(${rest || 'x'})`    // x^2log(x)
      ];
    }
    return [];
  }]
];

function generateSEABPermutations(input) {
  const perms = new Set([input]);
  
  // Apply SEAB ambiguity rules
  for (const [pattern, generator] of SEAB_AMBIGUITY_RULES) {
    const match = input.match(pattern);
    if (match) {
      const generated = generator(match);
      generated.forEach(p => perms.add(p));
    }
  }
  
  // Apply concatenated function rules
  for (const [pattern, generator] of CONCATENATED_FUNCTION_RULES) {
    const match = input.match(pattern);
    if (match) {
      const generated = generator(match);
      generated.forEach(p => perms.add(p));
    }
  }
  
  return Array.from(perms);
}

/**
 * Get merged suggestions:
 * - 3 SEAB ambiguity suggestions (including concatenated functions)
 * - 5 original LaTeX suggestions
 * Total max: 8 suggestions
 */
export function getMergedSuggestions(input, maxTotal = 8) {
  if (typeof input !== 'string' || !input.trim()) return [];
  
  const trimmed = input.trim();
  const suggestions = [];
  const seen = new Set();
  
  // Step 1: Original LaTeX suggestions (max 5)
  const originalSugs = originalGetLatexSuggestions(trimmed, 5);
  for (const latex of originalSugs) {
    const normalized = latex.trim();
    if (!seen.has(normalized)) {
      suggestions.push({
        text: normalized,
        display: normalized,
        score: 0.9,
        type: 'latex_original'
      });
      seen.add(normalized);
    }
  }
  
  // Step 2: SEAB ambiguity suggestions (max 3)
  const seabPerms = generateSEABPermutations(trimmed);
  let seabCount = 0;
  for (const perm of seabPerms) {
    if (perm === trimmed || seabCount >= 3) continue;
    
    const latexVariants = originalGetLatexSuggestions(perm, 1);
    for (const latex of latexVariants) {
      const normalized = latex.trim();
      if (!seen.has(normalized)) {
        suggestions.push({
          text: normalized,
          display: normalized,
          score: 0.8,
          type: 'seab_ambiguity'
        });
        seen.add(normalized);
        seabCount++;
        break;
      }
    }
  }
  
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, maxTotal)
    .map((s, idx) => ({ ...s, rank: idx + 1 }));
}