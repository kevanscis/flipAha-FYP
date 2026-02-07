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

const samples = [];
const classCounts = {};
for (const row of rows) {
  if (!/(sin|cos|tan)/i.test(row.input_text + row.target_latex)) continue;
  const inputKey = normalizeInput(row.input_text);
  const type = classifyTarget(row.target_latex);
  if (!type) continue;

  samples.push({ input: inputKey, label: type });
  classCounts[type] = (classCounts[type] || 0) + 1;
}

const model = trainLogisticRegression(samples, {
  ngramMin: 1,
  ngramMax: 3,
  maxVocab: 400,
  epochs: 250,
  learningRate: 0.4,
  l2: 0.001
});

model.priors = classCounts;
model.total = samples.length;

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

function trainLogisticRegression(samples, config) {
  const extraFeatures = [
    'has_power',
    'has_inverse',
    'has_degree',
    'has_ratio',
    'has_product',
    'has_expression',
    'has_parentheses'
  ];

  const classes = Array.from(
    new Set(samples.map(sample => sample.label))
  ).sort();

  const vocab = buildVocab(samples, config.ngramMin, config.ngramMax, config.maxVocab);
  const vocabIndex = new Map(vocab.map((gram, index) => [gram, index]));
  const featureCount = vocab.length + extraFeatures.length;

  const xVectors = samples.map(sample =>
    buildFeatureVector(
      sample.input,
      vocabIndex,
      config.ngramMin,
      config.ngramMax,
      extraFeatures
    )
  );
  const yIndices = samples.map(sample => classes.indexOf(sample.label));

  const weights = Array.from({ length: classes.length }, () =>
    Array(featureCount).fill(0)
  );
  const bias = Array(classes.length).fill(0);

  const epochs = config.epochs || 200;
  const baseLr = config.learningRate || 0.3;
  const l2 = config.l2 || 0;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradW = Array.from({ length: classes.length }, () =>
      Array(featureCount).fill(0)
    );
    const gradB = Array(classes.length).fill(0);

    for (let i = 0; i < xVectors.length; i += 1) {
      const x = xVectors[i];
      const y = yIndices[i];
      const logits = weights.map((row, k) => dot(row, x) + bias[k]);
      const probs = softmax(logits);

      for (let k = 0; k < classes.length; k += 1) {
        const diff = probs[k] - (k === y ? 1 : 0);
        gradB[k] += diff;
        const gradRow = gradW[k];
        for (let j = 0; j < featureCount; j += 1) {
          gradRow[j] += diff * x[j];
        }
      }
    }

    const invN = 1 / xVectors.length;
    const lr = baseLr / (1 + epoch * 0.01);
    for (let k = 0; k < classes.length; k += 1) {
      for (let j = 0; j < featureCount; j += 1) {
        const grad = gradW[k][j] * invN + l2 * weights[k][j];
        weights[k][j] -= lr * grad;
      }
      bias[k] -= lr * (gradB[k] * invN);
    }
  }

  return {
    type: 'logreg',
    classes,
    vocab,
    features: extraFeatures,
    ngramMin: config.ngramMin,
    ngramMax: config.ngramMax,
    weights,
    bias
  };
}

function buildVocab(samples, ngramMin, ngramMax, maxVocab) {
  const counts = new Map();
  for (const sample of samples) {
    const grams = extractNgrams(sample.input, ngramMin, ngramMax);
    for (const gram of grams) {
      counts.set(gram, (counts.get(gram) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxVocab)
    .map(([gram]) => gram);
}

function extractNgrams(input, ngramMin, ngramMax) {
  const text = String(input || '');
  const grams = [];
  for (let n = ngramMin; n <= ngramMax; n += 1) {
    for (let i = 0; i <= text.length - n; i += 1) {
      grams.push(text.slice(i, i + n));
    }
  }
  return grams;
}

function buildFeatureVector(input, vocabIndex, ngramMin, ngramMax, extraFeatures) {
  const vector = Array(vocabIndex.size + extraFeatures.length).fill(0);
  const grams = extractNgrams(input, ngramMin, ngramMax);
  for (const gram of grams) {
    const index = vocabIndex.get(gram);
    if (index !== undefined) vector[index] += 1;
  }

  const extra = computeExtraFeatures(input);
  extraFeatures.forEach((name, idx) => {
    vector[vocabIndex.size + idx] = extra[name] ? 1 : 0;
  });

  return vector;
}

function computeExtraFeatures(input) {
  const text = String(input || '');
  return {
    has_power: text.includes('^'),
    has_inverse: /(sin|cos|tan)(\^-?1|-?1)|arc(sin|cos|tan)/.test(text),
    has_degree: /°|(?:sin|cos|tan)\d+(?:°|o)?$/.test(text),
    has_ratio: text.includes('/'),
    has_product:
      /(?:sin|cos|tan)[a-z](?:sin|cos|tan)[a-z]/.test(text) ||
      /^\d+(sin|cos|tan)/.test(text),
    has_expression: /[+\-]/.test(text),
    has_parentheses: /[()]/.test(text)
  };
}

function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

function softmax(values) {
  const max = Math.max(...values);
  const exps = values.map(value => Math.exp(value - max));
  const sum = exps.reduce((acc, value) => acc + value, 0) || 1;
  return exps.map(value => value / sum);
}
