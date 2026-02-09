// core/permutation-engine.js
// SEAB E-Math/A-Math ambiguity patterns

/**
 * Generate permutations from extracted math input
 * Input can be raw string or result from math-extractor
 * Example: "log234" → ["log_2(34)", "log_23(4)", "log(234)"]
 */
export function generatePermutations(input) {
  // Handle both string input and parsed objects from math-extractor
  const mathExpr = typeof input === 'string' ? input : input?.expr || input?.toString() || '';
  
  if (!mathExpr || typeof mathExpr !== 'string') return [];
  
  const perms = new Set(); // Dedupe results
  perms.add(mathExpr); // Always include raw input
  
  // === RULE 1: logABC... → log_A(BC...) OR log_AB(C...) OR ... OR log(ABC...) ===
  // Covers: log23, log100, log234, log5x
  // Example: log234 → ["log_2(34)", "log_23(4)", "log(234)"]
  const logMatch = mathExpr.match(/^(.*)log(\d+)([a-z]?)(.*)$/i);
  if (logMatch) {
    const [_, prefix, digits, suffix, postfix] = logMatch;
    
    // Generate all possible base/argument splits
    // For "log234": split 1 (log_2(34)), split 2 (log_23(4))
    for (let splitPos = 1; splitPos < digits.length; splitPos++) {
      const base = digits.slice(0, splitPos);
      const argument = digits.slice(splitPos) + suffix;
      perms.add(`${prefix}log_${base}(${argument})${postfix}`);
    }
    
    // Always add the no-base version: log(234)
    perms.add(`${prefix}log(${digits}${suffix})${postfix}`);
  }
  
  // === RULE 2: sinXN / cosXN / tanXN → 3 interpretations ===
  // Covers: sinx2, cos2x, tanθ3
  const trigMatch = mathExpr.match(/^(.*)?(sin|cos|tan)([a-zθαβ])(\d)(.*)$/i);
  if (trigMatch) {
    const [_, prefix, func, varName, num, suffix] = trigMatch;
    const pre = prefix || '';
    
    perms.add(`${pre}${func}(${num}${varName})${suffix}`);   // sin(2x)
    perms.add(`${pre}${func}(${varName}^${num})${suffix}`);   // sin(x^2)
    perms.add(`${pre}${func}(${varName})^${num}${suffix}`);   // sin(x)^2
  }
  
  // === RULE 3: Function application (fx → f(x)) ===
  // Covers: fx, gx, hθ (common in A-Math function notation)
  const funcAppMatch = mathExpr.match(/^(.*)([fghpq])([a-zθ])(.*)$/);
  if (funcAppMatch) {
    const [_, prefix, func, varName, suffix] = funcAppMatch;
    
    perms.add(`${prefix}${func}(${varName})${suffix}`); // f(x)
    perms.add(`${prefix}${func}*${varName}${suffix}`);  // f*x (less common but valid)
  }
  
  // === RULE 4: Implicit multiplication (2x3 → 2*x*3 OR 2*x^3) ===
  // Covers: 2x3, 3y4 (E-Math algebra)
  const multMatch = mathExpr.match(/^(.*?)(\d)([a-z])(\d)(.*)$/i);
  if (multMatch) {
    const [_, prefix, num1, varName, num2, suffix] = multMatch;
    
    perms.add(`${prefix}${num1}*${varName}*${num2}${suffix}`); // 2*x*3
    perms.add(`${prefix}${num1}*${varName}^${num2}${suffix}`); // 2*x^3
  }
  
  // === RULE 5: Power ambiguity (e^2x → e^(2x) OR e^2*x) ===
  // Covers: e^2x, 2^3x (A-Math exponential functions)
  const expMatch = mathExpr.match(/^(.*?)([a-z0-9])\^(\d)([a-z])(.*)$/i);
  if (expMatch) {
    const [_, prefix, base, num, varName, suffix] = expMatch;
    
    perms.add(`${prefix}${base}^(${num}${varName})${suffix}`); // e^(2x)
    perms.add(`${prefix}${base}^${num}*${varName}${suffix}`);  // e^2*x
  }
  
  // === RULE 6: Trig power notation (sin^2x → sin(x)^2) ===
  // Covers: sin^2x, cos^2θ (VERY common in A-Math trig identities)
  const trigPowMatch = mathExpr.match(/^(.*?)(sin|cos|tan)\^(\d)([a-zθ])(.*)$/i);
  if (trigPowMatch) {
    const [_, prefix, func, power, varName, suffix] = trigPowMatch;
    
    perms.add(`${prefix}${func}(${varName})^${power}${suffix}`); // sin(x)^2
  }
  
  return Array.from(perms).filter(perm => isValidExpression(perm));
}

/**
 * Pipeline function: Extract math from text, then generate permutations
 * This connects math-extractor.js with permutation-engine.js
 * 
 * Usage with math-extractor:
 * import { extractMathExpression, analyzeMathContent } from './math-extractor.js';
 * import { processAndPermute } from './permutation-engine.js';
 * 
 * const mathExprs = extractMathExpression("Help solve log234");
 * const allPermutations = processAndPermute(mathExprs);
 */
export function processAndPermute(mathInput) {
  // Handle array of expressions from math-extractor
  if (Array.isArray(mathInput)) {
    const allPerms = {};
    for (const expr of mathInput) {
      allPerms[expr] = generatePermutations(expr);
    }
    return allPerms;
  }
  
  // Handle single expression
  return generatePermutations(mathInput);
}

/**
 * Process detailed analysis from math-extractor's analyzeMathContent()
 * Returns: { expr: string, type: string, permutations: [strings] }[]
 */
export function processDetailedAnalysis(analysisResult) {
  if (!analysisResult || !analysisResult.expressions) {
    return [];
  }
  
  return analysisResult.expressions.map(item => ({
    expr: item.expr,
    type: item.type,
    permutations: generatePermutations(item.expr)
  }));
}

/**
 * Validation: Check if expression is valid (filter nonsense)
 */
function isValidExpression(expr) {
  if (!expr || typeof expr !== 'string') return false;
  
  const trimmed = expr.trim();
  if (trimmed.length === 0) return false;
  
  // Reject empty parentheses
  if (trimmed.includes('()')) return false;
  
  // Reject log with invalid base or argument
  const logBaseMatch = trimmed.match(/log_(-?\d+\.?\d*)/);
  if (logBaseMatch) {
    const base = parseFloat(logBaseMatch[1]);
    if (base <= 0 || base === 1) return false; // log base must be positive and ≠ 1
  }
  
  // Reject log with 0 or negative argument
  const logArgMatch = trimmed.match(/log(?:_\d+)?\((-?[\d.]+)\)/);
  if (logArgMatch) {
    const arg = parseFloat(logArgMatch[1]);
    if (arg <= 0) return false; // log argument must be positive
  }
  
  // Reject division by zero
  if (trimmed.match(/\/\s*0(?:\s|$|\))/)) return false;
  
  return true;
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generatePermutations, processAndPermute, processDetailedAnalysis };
}