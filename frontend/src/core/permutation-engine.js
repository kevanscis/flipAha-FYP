// core/permutation-engine.js
// SEAB E-Math/A-Math ambiguity patterns

export function generatePermutations(input) {
  const perms = new Set(); // Dedupe results
  perms.add(input); // Always include raw input
  
  // === RULE 1: logAB → log_A(B) OR log(AB) ===
  // Covers: log23, log100, log5x
  const logMatch = input.match(/log(\d+)([a-z]?)$/);
  if (logMatch) {
    const digits = logMatch[1];
    const suffix = logMatch[2] || '';
    const prefix = input.slice(0, input.indexOf('log'));
    
    // Split after 1st digit (most common: log₂(3))
    if (digits.length >= 2) {
      perms.add(`${prefix}log_${digits[0]}(${digits.slice(1)}${suffix})`);
    }
    // Split after 2nd digit (log₁₀(0) for log100)
    if (digits.length >= 3) {
      perms.add(`${prefix}log_${digits.slice(0,2)}(${digits.slice(2)}${suffix})`);
    }
    // Single argument: log(23)
    perms.add(`${prefix}log(${digits}${suffix})`);
  }
  
  // === RULE 2: sinXN / cosXN / tanXN → 3 interpretations ===
  // Covers: sinx2, cos2x, tanθ3
  const trigMatch = input.match(/(sin|cos|tan)([a-zθαβ])(\d)$/);
  if (trigMatch) {
    const [_, func, varName, num] = trigMatch;
    const prefix = input.slice(0, input.lastIndexOf(func));
    
    perms.add(`${prefix}${func}(${num}${varName})`);   // sin(2x)
    perms.add(`${prefix}${func}(${varName}^${num})`);   // sin(x^2)
    perms.add(`${prefix}${func}(${varName})^${num}`);   // sin(x)^2
  }
  
  // === RULE 3: Function application (fx → f(x)) ===
  // Covers: fx, gx, hθ (common in A-Math function notation)
  const funcAppMatch = input.match(/([fghpq])([a-zθ])$/);
  if (funcAppMatch) {
    const [_, func, varName] = funcAppMatch;
    const prefix = input.slice(0, input.lastIndexOf(func + varName));
    
    perms.add(`${prefix}${func}(${varName})`); // f(x)
    perms.add(`${prefix}${func}*${varName}`);  // f*x (less common but valid)
  }
  
  // === RULE 4: Implicit multiplication (2x3 → 2*x*3 OR 2*x^3) ===
  // Covers: 2x3, 3y4 (E-Math algebra)
  const multMatch = input.match(/(\d)([a-z])(\d)$/);
  if (multMatch) {
    const [_, num1, varName, num2] = multMatch;
    const prefix = input.slice(0, input.lastIndexOf(num1 + varName + num2));
    
    perms.add(`${prefix}${num1}*${varName}*${num2}`); // 2*x*3
    perms.add(`${prefix}${num1}*${varName}^${num2}`); // 2*x^3
  }
  
  // === RULE 5: Power ambiguity (e^2x → e^(2x) OR e^2*x) ===
  // Covers: e^2x, 2^3x (A-Math exponential functions)
  const expMatch = input.match(/([a-z0-9])\^(\d)([a-z])$/);
  if (expMatch) {
    const [_, base, num, varName] = expMatch;
    const prefix = input.slice(0, input.lastIndexOf(base + '^' + num + varName));
    
    perms.add(`${prefix}${base}^(${num}${varName})`); // e^(2x)
    perms.add(`${prefix}${base}^${num}*${varName}`);  // e^2*x
  }
  
  // === RULE 6: Trig power notation (sin^2x → sin(x)^2) ===
  // Covers: sin^2x, cos^2θ (VERY common in A-Math trig identities)
  const trigPowMatch = input.match(/(sin|cos|tan)\^(\d)([a-zθ])$/);
  if (trigPowMatch) {
    const [_, func, power, varName] = trigPowMatch;
    const prefix = input.slice(0, input.lastIndexOf(func + '^' + power + varName));
    
    perms.add(`${prefix}${func}(${varName})^${power}`); // sin(x)^2
  }
  
  return Array.from(perms).filter(perm => isValidSEABExpression(perm));
}

// Basic SEAB-specific validation (filter nonsense)
function isValidSEABExpression(expr) {
  // Reject log with non-positive argument
  if (expr.match(/log_\d+\((0|[1-9]\d*\.?0*)\)/) && RegExp.$1 === '0') return false;
  
  // Reject log base ≤ 0 or = 1
  const baseMatch = expr.match(/log_(-?\d+\.?\d*)\(/);
  if (baseMatch) {
    const base = parseFloat(baseMatch[1]);
    if (base <= 0 || base === 1) return false;
  }
  
  // Reject empty parens
  if (expr.includes('()')) return false;
  
  return true;
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generatePermutations };
}