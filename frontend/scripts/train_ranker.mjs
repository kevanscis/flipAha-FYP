#!/usr/bin/env node
// ============================================================================
// train_ranker.mjs — Offline training script for the suggestion GBDT ranker
//
// Usage:
//   node frontend/scripts/train_ranker.mjs [--db path/to/app.db] [--out frontend/src/core/ranker-model.json]
//
// Reads suggestion_feedback data from the SQLite database, constructs
// training pairs, trains a GBDTRanker, and writes the resulting model to JSON.
// ============================================================================

import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the ranker module via vm to avoid ESM/CJS resolution issues
// (the file uses an IIFE that assigns to globalThis and module.exports)
const rankerCode = fs.readFileSync(
  path.resolve(__dirname, '../src/core/suggestion-ranker.js'), 'utf8'
);
const rankerContext = vm.createContext({
  globalThis: {}, module: { exports: {} }, console,
  Set, Array, Math, Object, String, Number, parseInt, parseFloat,
  RegExp, Infinity, NaN, undefined, isNaN,
});
vm.runInContext(rankerCode, rankerContext);
const rankerModule = rankerContext.module.exports;

const { GBDTRanker, extractFeatures, FEATURE_NAMES } = rankerModule;

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const dbPath = getArg('--db', path.resolve(__dirname, '../../backend/database/app.db'));
const outPath = getArg('--out', path.resolve(__dirname, '../src/core/ranker-model.json'));

// ---------------------------------------------------------------------------
// Load feedback data from SQLite
// ---------------------------------------------------------------------------
let Database;
try {
  const require = createRequire(import.meta.url);
  Database = require('better-sqlite3');
} catch {
  console.error(
    'Error: better-sqlite3 is required for training.\n' +
    'Install it with:  npm install better-sqlite3'
  );
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

console.log(`Reading feedback from ${dbPath} ...`);

const rows = db.prepare(`
  SELECT sf.suggestion_text, sf.rating,
         q.question_id, q.topic
  FROM suggestion_feedback sf
  LEFT JOIN questions q ON sf.question_id = q.question_id
  ORDER BY sf.feedback_timestamp
`).all();

db.close();

console.log(`Found ${rows.length} feedback records.`);

if (rows.length < 10) {
  console.warn(
    'Warning: Very few feedback records. The trained model may not improve ' +
    'over the default cold-start heuristics. Collecting more feedback is recommended.'
  );
}

// ---------------------------------------------------------------------------
// Build training data
// ---------------------------------------------------------------------------
// Each feedback record tells us: for a given suggestion_text + rating,
// was the suggestion considered useful (rating=1) or not (rating=0)?
//
// Since we don't have the original raw input stored alongside the feedback,
// we approximate by treating the suggestion_text itself as both input (stripped
// of LaTeX commands) and suggestion. This gives the model a signal about which
// *types* of suggestions are preferred (degree notations, explicit parens, etc.)
// regardless of the specific input that triggered them.

function stripLatex(latex) {
  return String(latex || '')
    .replace(/\\[a-zA-Z]+/g, '')  // remove commands
    .replace(/[{}^_]/g, '')        // remove braces/powers/subscripts
    .replace(/\s+/g, '')
    .trim();
}

const X = [];
const y = [];

rows.forEach((row, index) => {
  const suggestion = row.suggestion_text || '';
  const rating = Number(row.rating) || 0;

  // Approximate the input as the stripped version of the suggestion
  const rawInput = stripLatex(suggestion);

  const features = extractFeatures(rawInput, suggestion, {
    position: 0,
    totalCount: 1,
  });

  X.push(features);
  y.push(rating > 0 ? 1.0 : 0.0);
});

if (X.length === 0) {
  console.log('No training data available. Writing default model.');
  fs.writeFileSync(outPath, JSON.stringify(rankerModule.getModel(), null, 2));
  console.log(`Model written to ${outPath}`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Train
// ---------------------------------------------------------------------------
console.log(`Training GBDT on ${X.length} samples ...`);

const model = new GBDTRanker({
  learningRate: 0.1,
  nTrees: 40,
  maxDepth: 2,
  lambda: 1.5,
  minSamplesLeaf: 3,
});

model.fit(X, y);

// ---------------------------------------------------------------------------
// Evaluate (quick in-sample accuracy)
// ---------------------------------------------------------------------------
let correct = 0;
for (let i = 0; i < X.length; i++) {
  const pred = model.predict(X[i]);
  const predicted = pred >= 0.5 ? 1 : 0;
  if (predicted === y[i]) correct++;
}
const accuracy = (correct / X.length * 100).toFixed(1);
console.log(`In-sample accuracy: ${accuracy}% (${correct}/${X.length})`);

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
const modelJSON = model.toJSON();
modelJSON.trainedAt = new Date().toISOString();
modelJSON.trainingSamples = X.length;
modelJSON.accuracy = parseFloat(accuracy);

fs.writeFileSync(outPath, JSON.stringify(modelJSON, null, 2));
console.log(`\nTrained model written to ${outPath}`);
console.log(`  Trees: ${modelJSON.trees.length}`);
console.log(`  Bias:  ${modelJSON.bias.toFixed(4)}`);
console.log(`  LR:    ${modelJSON.lr}`);
console.log('\nTo use in the browser, the model will be loaded automatically');
console.log('if placed at src/core/ranker-model.json, or can be loaded via:');
console.log('  globalThis.suggestionRanker.loadModel(modelJSON)');
