// core/permutation-engine.js - Re-export wrapper
// The actual permutation logic is now orchestrated by mathToLatex.js
// This module exists for backward compatibility and ES6 module imports

/**
 * Export generatePermutations for use in ES6 modules (like suggestor.js)
 * The actual implementation is in mathToLatex.js via globalThis
 */
export function generatePermutations(input) {
  // Use the orchestrator version from mathToLatex.js if available
  if (typeof globalThis !== 'undefined' && globalThis.generatePermutations) {
    try {
      return globalThis.generatePermutations(input);
    } catch (error) {
      console.error('Error in generatePermutations from mathToLatex:', error);
      return [];
    }
  }
  
  // Fallback: basic validation if mathToLatex.js hasn't loaded yet
  const mathExpr = typeof input === 'string' ? input : input?.expr || input?.toString() || '';
  if (!mathExpr || typeof mathExpr !== 'string') {
    console.warn('permutation-engine.js: No input or invalid type:', input);
    return [];
  }
  
  console.warn('permutation-engine.js: globalThis.generatePermutations not available! mathToLatex.js may not have loaded.');
  return [mathExpr]; // Return raw input if orchestrator unavailable
}

/**
 * Helper exports for use in modules
 */
export function processAndPermute(mathInput) {
  if (Array.isArray(mathInput)) {
    const allPerms = {};
    for (const expr of mathInput) {
      allPerms[expr] = generatePermutations(expr);
    }
    return allPerms;
  }
  return generatePermutations(mathInput);
}

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