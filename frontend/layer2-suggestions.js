import { suggest } from './src/core/suggestor.js';

window.getLayer2Suggestions = (input, options = {}) => {
  const curriculum = options.curriculum || 'general';
  return suggest(input, curriculum, options);
};
