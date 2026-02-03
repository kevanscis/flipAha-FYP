// core/suggester.js
import { extractMathExpression, isValidMathExpression } from './math-extractor.js';
import { generatePermutations } from './permutation-engine.js';

export function suggest(input, curriculum = 'general') {
  const math = extractMathExpression(input);
  if (!isValidMathExpression(math)) return [];
  
  return generatePermutations(math)
    .map(text => ({ text, display: text, score: 1.0 }))
    .slice(0, 5); // Truncate to top 5
}
