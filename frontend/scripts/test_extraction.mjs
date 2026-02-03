import { extractMathExpression, isValidMathExpression } from '../src/core/math-extractor.js';
import { generatePermutations } from '../src/core/permutation-engine.js';
import { suggest } from '../src/core/suggestor.js';
import { getMergedSuggestions } from '../src/utils/suggestion-merger.js';
import { getLatexSuggestions, mathToLatex } from '../src/utils/mathToLatex.js';

const samples = [
  'Solve for x: 2x + 3 = 7',
  'What is sin^2x + cos^2x?',
  'Find log23',
  'simplify e^2x',
  'Is 2x3 equal to 6?',
  'Hello, I need help',
  'x',
  '5',
  'sinx2'
];

for (const s of samples) {
  console.log('---');
  console.log('Input:', s);
  const math = extractMathExpression(s);
  console.log('Extracted:', math, 'Valid?', isValidMathExpression(math));
  console.log('Permutations:', generatePermutations(math).slice(0,10));
  console.log('Suggestor:', suggest(s));
  console.log('Merged suggestions:', getMergedSuggestions(math, 5));
  console.log('LaTeX of perm:', getLatexSuggestions(math, 3));
}

console.log('mathToLatex("sin x") =>', mathToLatex('sin x'));
console.log('mathToLatex("log23") =>', mathToLatex('log23'));
