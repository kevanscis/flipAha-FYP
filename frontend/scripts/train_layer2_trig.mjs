import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.resolve(__dirname, '../src/core/layer2.csv');
const outputPath = path.resolve(__dirname, '../src/core/layer2-trig-model.js');

const csv = fs.readFileSync(csvPath, 'utf8');
const lines = csv.split(/\r?\n/).filter(Boolean);
const rows = lines.slice(1).map(line => {
  const [input_text, target_latex] = line.split(/,(.+)/);
  return {
    input_text: (input_text || '').trim(),
    target_latex: (target_latex || '').trim()
  };
});

const model = {
  total: 0,
  priors: {},
  inputTypeCounts: {}
};

for (const row of rows) {
  if (!/(sin|cos|tan)/i.test(row.input_text + row.target_latex)) continue;
  const inputKey = normalizeInput(row.input_text);
  const type = classifyTarget(row.target_latex);
  if (!type) continue;

  model.total += 1;
  model.priors[type] = (model.priors[type] || 0) + 1;
  if (!model.inputTypeCounts[inputKey]) model.inputTypeCounts[inputKey] = {};
  model.inputTypeCounts[inputKey][type] =
    (model.inputTypeCounts[inputKey][type] || 0) + 1;
}

const content = `// Auto-generated from layer2.csv by train_layer2_trig.mjs
export const trigModel = ${JSON.stringify(model, null, 2)};
`;

fs.writeFileSync(outputPath, content);
console.log(`Wrote trig model to ${outputPath}`);

function normalizeInput(input) {
  return String(input)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[×*]/g, '*')
    .replace(/[÷]/g, '/')
    .trim();
}

function classifyTarget(target) {
  if (!target) return null;
  const lower = target.toLowerCase();

  if (/\\(sin|cos|tan)\^\{-?1\}/.test(lower)) return 'trig_inverse';
  if (/\\(sin|cos|tan)\^\{?\d+\}?/.test(lower)) return 'trig_power';
  if (/\^\\circ/.test(lower)) return 'trig_degree';
  if (/\\frac\{\\(sin|cos|tan)\(/.test(lower)) return 'trig_ratio';
  if (/\\(sin|cos|tan)\(.*\)\\(sin|cos|tan)\(/.test(lower)) return 'trig_product';
  if (/\d\\(sin|cos|tan)\(/.test(lower)) return 'trig_product';

  const argMatch = lower.match(/\\(sin|cos|tan)\((.*)\)/);
  if (argMatch) {
    const arg = argMatch[2] || '';
    if (/[+\-\/]/.test(arg)) return 'trig_expression';
    if (/[\^]/.test(arg)) return 'trig_argument';
    if (/[a-z].*\d|\d.*[a-z]/.test(arg)) return 'trig_argument';
    return 'trig_basic';
  }

  return null;
}
