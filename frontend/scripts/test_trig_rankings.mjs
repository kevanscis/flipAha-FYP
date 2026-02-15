import { suggest } from '../src/core/suggestor.js';

const inputs = [
  'sinx',
  'sin2',
  'sin2x',
  'sinx2',
  'sin-1x',
  'arcsinx',
  'sin30',
  'cos60',
  'tan45',
  'sinx/2',
  'sinxcosx',
  '2sinx'
];

for (const input of inputs) {
  const suggestions = suggest(input, 'o-level', { maxSuggestions: 3 });
  console.log('---');
  console.log('Input:', input);
  suggestions.forEach((s, idx) => {
    console.log(`${idx + 1}. ${s.display} | score=${s.score.toFixed(3)} | type=${s.type}`);
  });
}
