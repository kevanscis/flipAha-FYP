
const path = require('path');
const { pathToFileURL } = require('url');

// The project keeps the canonical mathToLatex at frontend/mathToLatex.js
// Older path used 'frontend/src/utils/mathToLatex.js' which does not exist.
const MATH_UTILS_PATH = path.resolve(
  __dirname,
  '..',
  'frontend',
  'mathToLatex.js'
);

async function loadMathUtils() {
  const fileUrl = pathToFileURL(MATH_UTILS_PATH).href;
  // Import may return a CommonJS module wrapped under `default` or an ESM namespace.
  const mod = await import(fileUrl);
  return (mod && mod.default) ? mod.default : mod;
}

/**
 * Get LaTeX suggestions based on frontend rules.
 * @param {string} input
 * @param {number} maxSuggestions
 * @returns {Promise<string[]>}
 */
async function getLatexSuggestions(input, maxSuggestions = 5) {
  const mathUtils = await loadMathUtils();
  return mathUtils.getLatexSuggestions(input, maxSuggestions);
}

/**
 * Backward-compatible single-output function.
 * @param {string} input
 * @returns {Promise<string>}
 */
async function mathToLatex(input) {
  const mathUtils = await loadMathUtils();
  return mathUtils.mathToLatex(input);
}

async function runCli() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  const maxIndex = args.indexOf('--max');

  const input = inputIndex >= 0 ? args[inputIndex + 1] : '';
  const maxSuggestions = maxIndex >= 0 ? Number(args[maxIndex + 1]) : 5;

  const suggestions = await getLatexSuggestions(input || '', maxSuggestions || 5);
  process.stdout.write(JSON.stringify({ suggestions }));
}

if (require.main === module) {
  runCli().catch((error) => {
    process.stderr.write(error?.stack || String(error));
    process.exit(1);
  });
}

module.exports = { getLatexSuggestions, mathToLatex };