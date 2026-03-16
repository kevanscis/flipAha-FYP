// core/suggester.js
import { getPrimaryMathExpression, isValidMathExpression } from './math-extractor.js';
import { generatePermutations } from './permutation-engine.js';
import { trigModel } from './layer2-trig-model.js';

export function suggest(input, curriculum = 'general', options = {}) {
  const math = getPrimaryMathExpression(input);
  if (!isValidMathExpression(math)) return [];

  const maxSuggestions = Number.isFinite(options.maxSuggestions)
    ? Math.max(1, options.maxSuggestions)
    : 5;

  const minConfidence = Number.isFinite(options.minConfidence)
    ? Math.min(1, Math.max(0, options.minConfidence))
    : 0.7;

  const layer1 = generatePermutations(math).map(text => ({
    text,
    display: text,
    source: 'layer1',
    type: 'rule',
    baseScore: 0.6
  }));

  const layer2 = generateLayer2Candidates(math).map(candidate => ({
    ...candidate,
    source: 'layer2',
    baseScore: candidate.baseScore ?? 0.9
  }));

  const merged = dedupeCandidates([...layer2, ...layer1]);
  const canonical = normalizeExpression(math);
  const ranked = rankCandidates(merged, {
    canonical,
    curriculum,
    sessionContext: options.sessionContext,
    rawInput: math,
    trigModel
  });

  return ranked
    .filter(candidate => (candidate.score ?? 0) >= minConfidence)
    .slice(0, maxSuggestions)
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1
    }));
}

function generateLayer2Candidates(input) {
  const normalized = normalizeExpression(input);
  const tokens = tokenizeExpression(normalized);
  const candidates = [];

  // Pattern: number, identifier, number (e.g., 2x3)
  if (
    tokens.length === 3 &&
    tokens[0].type === 'number' &&
    tokens[1].type === 'identifier' &&
    tokens[2].type === 'number'
  ) {
    const left = tokens[0].value;
    const middle = tokens[1].value;
    const right = tokens[2].value;

    // 1) Multiplication (interpret middle as ×)
    candidates.push({
      text: `${left}*${right}`,
      display: `${left} × ${right}`,
      type: 'multiplication',
      baseScore: 0.95
    });

    // 2) Exponentiation (interpret middle as "to the power of")
    candidates.push({
      text: `${left}^${right}`,
      display: `${left}${toSuperscript(right)}`,
      type: 'exponentiation',
      baseScore: 0.75
    });

    // 3) Function evaluation (interpret middle as function name)
    candidates.push({
      text: `${left}${middle}(${right})`,
      display: `${left}${middle}(${right})`,
      type: 'function_evaluation',
      baseScore: 0.6
    });
  }

  generateTrigCandidates(normalized).forEach(candidate => {
    candidates.push(candidate);
  });

  // Fallback: ensure raw normalized input is included
  if (candidates.length === 0) {
    candidates.push({
      text: normalized,
      display: normalized,
      type: 'raw',
      baseScore: 0.5
    });
  }

  return candidates;
}

function generateTrigCandidates(normalized) {
  const candidates = [];
  const trigGroup = '(sin|cos|tan|sec|csc|cot)';

  const simpleMatch = normalized.match(new RegExp(`^${trigGroup}([a-zθ])$`));
  if (simpleMatch) {
    const [, func, arg] = simpleMatch;
    candidates.push({
      text: `${func}(${arg})`,
      display: `${func}(${arg})`,
      type: 'trig_basic',
      baseScore: 0.9
    });
  }

  const numberMatch = normalized.match(new RegExp(`^${trigGroup}(-?\\d+(?:\\.\\d+)?)(°|o)?$`));
  if (numberMatch) {
    const [, func, num, degreeSymbol] = numberMatch;
    if (degreeSymbol) {
      const displayNum = `${num}°`;
      candidates.push({
        text: `${func}(${displayNum})`,
        display: `${func}(${displayNum})`,
        type: 'trig_degree',
        baseScore: 0.9
      });
    } else if (/^\d/.test(num)) {
      candidates.push({
        text: `${func}(${num})`,
        display: `${func}(${num})`,
        type: 'trig_argument',
        baseScore: 0.9
      });
      const displayNum = `${num}°`;
      candidates.push({
        text: `${func}(${displayNum})`,
        display: `${func}(${displayNum})`,
        type: 'trig_degree',
        baseScore: 0.75
      });
    }
  }

  const argMatch = normalized.match(new RegExp(`^${trigGroup}\\((.+)\\)$`));
  if (argMatch) {
    const [, func, arg] = argMatch;
    const type = /[+\-\/]/.test(arg) ? 'trig_expression' : 'trig_argument';
    candidates.push({
      text: `${func}(${arg})`,
      display: `${func}(${arg})`,
      type,
      baseScore: 0.8
    });
  }

  const inverseMatch = normalized.match(new RegExp(`^(arc)?${trigGroup}(\\^-?1|-?1)([a-zθ]+)?$`));
  if (inverseMatch) {
    const [, arcPrefix, func, , argRaw] = inverseMatch;
    const arg = argRaw || 'x';
    const funcName = arcPrefix ? `${func}` : func;
    candidates.push({
      text: `${funcName}^-1(${arg})`,
      display: `${funcName}^-1(${arg})`,
      type: 'trig_inverse',
      baseScore: 0.75
    });
  }

  const arcMatch = normalized.match(new RegExp(`^arc${trigGroup}([a-zθ]+)$`));
  if (arcMatch) {
    const [, func, argRaw] = arcMatch;
    const arg = argRaw || 'x';
    candidates.push({
      text: `${func}^-1(${arg})`,
      display: `${func}^-1(${arg})`,
      type: 'trig_inverse',
      baseScore: 0.75
    });
  }

  const doubleMatch = normalized.match(new RegExp(`^${trigGroup}(\\d+)([a-zθ])$`));
  if (doubleMatch) {
    const [, func, num, arg] = doubleMatch;
    candidates.push({
      text: `${func}(${num}${arg})`,
      display: `${func}(${num}${arg})`,
      type: 'trig_argument',
      baseScore: 0.85
    });
    candidates.push({
      text: `${func}(${arg})^${num}`,
      display: `${func}(${arg})^${num}`,
      type: 'trig_power',
      baseScore: 0.7
    });
  }

  const powerMatch = normalized.match(new RegExp(`^${trigGroup}\\^(\\d+)([a-zθ])?$`));
  if (powerMatch) {
    const [, func, pow, argRaw] = powerMatch;
    const arg = argRaw || 'x';
    candidates.push({
      text: `${func}(${arg})^${pow}`,
      display: `${func}(${arg})^${pow}`,
      type: 'trig_power',
      baseScore: 0.85
    });
  }

  const suffixMatch = normalized.match(new RegExp(`^${trigGroup}([a-zθ])(\\d+)$`));
  if (suffixMatch) {
    const [, func, arg, pow] = suffixMatch;
    candidates.push({
      text: `${func}(${arg}^${pow})`,
      display: `${func}(${arg}^${pow})`,
      type: 'trig_argument',
      baseScore: 0.75
    });
    candidates.push({
      text: `${func}(${arg})^${pow}`,
      display: `${func}(${arg})^${pow}`,
      type: 'trig_power',
      baseScore: 0.7
    });
  }

  const exprMatch = normalized.match(new RegExp(`^${trigGroup}([a-zθ])(.*)$`));
  if (exprMatch && /[+\-\/]/.test(exprMatch[3])) {
    const [, func, arg, rest] = exprMatch;
    candidates.push({
      text: `${func}(${arg}${rest})`,
      display: `${func}(${arg}${rest})`,
      type: 'trig_expression',
      baseScore: 0.8
    });

    if (rest === '-1') {
      candidates.push({
        text: `${func}^-1(${arg})`,
        display: `${func}^-1(${arg})`,
        type: 'trig_inverse',
        baseScore: 0.65
      });
    }
  }

  const compactExprMatch = normalized.match(new RegExp(`^${trigGroup}(-?[a-zθπ][a-z0-9θπ+\\-*/().]*)$`));
  if (compactExprMatch) {
    const [, func, rawArg] = compactExprMatch;
    const arg = rawArg.replace(/\bpi\b/g, 'π').replace(/theta/g, 'θ');

    candidates.push({
      text: `${func}(${arg})`,
      display: `${func}(${arg})`,
      type: 'trig_expression',
      baseScore: 0.95
    });

    const ambigMatch = rawArg.match(/^(.+)\+((\d*)?(?:π|pi))\/(\d+)$/);
    if (ambigMatch) {
      const lhs = ambigMatch[1].replace(/\bpi\b/g, 'π').replace(/theta/g, 'θ');
      const coeff = ambigMatch[3] || '1';
      const denom = ambigMatch[4];
      const piTerm = coeff === '1' ? 'π' : `${coeff}π`;
      const rhsTerm = coeff === '1' ? 'π' : `${coeff}π`;

      candidates.push({
        text: `${func}(${lhs}+${rhsTerm}/${denom})`,
        display: `${func}(${lhs}+${rhsTerm}/${denom})`,
        type: 'trig_expression',
        baseScore: 0.92
      });

      candidates.push({
        text: `${func}((${lhs}+${piTerm})/${denom})`,
        display: `${func}((${lhs}+${piTerm})/${denom})`,
        type: 'trig_expression',
        baseScore: 0.9
      });
    }
  }

  const productMatch = normalized.match(new RegExp(`^${trigGroup}[a-zθ]${trigGroup}[a-zθ]$`));
  if (productMatch) {
    const product = normalized.replace(new RegExp(`${trigGroup}([a-zθ])`, 'g'), '$1($2)');
    candidates.push({
      text: product,
      display: product,
      type: 'trig_product',
      baseScore: 0.7
    });
  }

  const coefficientMatch = normalized.match(new RegExp(`^(\\d+)${trigGroup}([a-zθ])$`));
  if (coefficientMatch) {
    const [, coef, func, arg] = coefficientMatch;
    candidates.push({
      text: `${coef}${func}(${arg})`,
      display: `${coef}${func}(${arg})`,
      type: 'trig_product',
      baseScore: 0.75
    });
  }

  const ratioMatch = normalized.match(new RegExp(`^${trigGroup}([a-zθ])\/([0-9]+)$`));
  if (ratioMatch) {
    const [, func, arg, denom] = ratioMatch;
    candidates.push({
      text: `${func}(${arg})/${denom}`,
      display: `${func}(${arg})/${denom}`,
      type: 'trig_ratio',
      baseScore: 0.7
    });
    candidates.push({
      text: `${func}(${arg}/${denom})`,
      display: `${func}(${arg}/${denom})`,
      type: 'trig_expression',
      baseScore: 0.65
    });
  }

  return candidates;
}

function tokenizeExpression(expr) {
  const tokens = [];
  const pattern = /\d+(?:\.\d+)?|[a-zA-Z]+|[+\-*/^()]/g;
  const matches = expr.match(pattern) || [];
  for (const value of matches) {
    if (/^\d/.test(value)) {
      tokens.push({ type: 'number', value });
    } else if (/^[a-zA-Z]+$/.test(value)) {
      tokens.push({ type: 'identifier', value });
    } else {
      tokens.push({ type: 'operator', value });
    }
  }
  return tokens;
}

function dedupeCandidates(candidates) {
  const seen = new Map();
  for (const candidate of candidates) {
    const key = normalizeExpression(candidate.text);
    const existing = seen.get(key);
    if (!existing || (candidate.baseScore ?? 0) > (existing.baseScore ?? 0)) {
      seen.set(key, candidate);
    }
  }
  return Array.from(seen.values());
}

function rankCandidates(candidates, { canonical, curriculum, sessionContext, rawInput, trigModel }) {
  const normalizedCanonical = normalizeExpression(canonical);
  const normalizedInput = normalizeExpression(rawInput || canonical);
  const context = Array.isArray(sessionContext) ? sessionContext : [];
  return candidates
    .map(candidate => {
      const normalizedCandidate = normalizeExpression(candidate.text);
      const distanceScore = distanceToScore(
        levenshteinDistance(normalizedCandidate, normalizedCanonical)
      );
      const curriculumScore = curriculumConstraintScore(
        normalizedCandidate,
        curriculum
      );
      const priorScore = priorForType(candidate.type);
      const contextScore = contextMatchScore(normalizedCandidate, context);
      const trainedScore = trainedTypeScore(
        candidate.type,
        normalizedInput,
        trigModel
      );

      const blended =
        0.35 * priorScore +
        0.3 * distanceScore +
        0.2 * curriculumScore +
        0.05 * contextScore +
        0.1 * trainedScore;

      const base = Number.isFinite(candidate.baseScore)
        ? candidate.baseScore
        : 0.6;
      const score = Math.max(0, Math.min(1, blended * base));

      return {
        ...candidate,
        score
      };
    })
    .sort((a, b) => b.score - a.score);
}

function priorForType(type) {
  switch (type) {
    case 'multiplication':
      return 0.95;
    case 'exponentiation':
      return 0.7;
    case 'function_evaluation':
      return 0.5;
    case 'trig_basic':
      return 0.85;
    case 'trig_argument':
      return 0.8;
    case 'trig_power':
      return 0.7;
    case 'trig_inverse':
      return 0.65;
    case 'trig_degree':
      return 0.8;
    case 'trig_expression':
      return 0.7;
    case 'trig_product':
      return 0.7;
    case 'trig_ratio':
      return 0.6;
    case 'rule':
      return 0.6;
    default:
      return 0.55;
  }
}

function trainedTypeScore(type, normalizedInput, model) {
  if (!model) return 0.5;
  if (!type.startsWith('trig')) return 0.5;

  if (model.type === 'logreg' && Array.isArray(model.classes)) {
    const probabilities = predictLogReg(normalizedInput, model);
    const index = model.classes.indexOf(type);
    if (index === -1) return 0.5;
    const score = probabilities[index];
    return Number.isFinite(score) ? score : 0.5;
  }

  if (!model.priors) return 0.5;

  const inputCounts = model.inputTypeCounts?.[normalizedInput];
  if (inputCounts && inputCounts[type]) {
    const total = Object.values(inputCounts).reduce((sum, val) => sum + val, 0);
    return total > 0 ? inputCounts[type] / total : 0.5;
  }

  const total = model.total || 0;
  const priorCount = model.priors[type] || 0;
  if (total === 0) return 0.5;
  return priorCount / total;
}

function predictLogReg(normalizedInput, model) {
  const input = normalizeExpression(normalizedInput);
  const ngramMin = Number.isFinite(model.ngramMin) ? model.ngramMin : 1;
  const ngramMax = Number.isFinite(model.ngramMax) ? model.ngramMax : 3;
  const vocab = Array.isArray(model.vocab) ? model.vocab : [];
  const features = Array.isArray(model.features) ? model.features : [];

  if (!model._vocabIndex) {
    model._vocabIndex = new Map(vocab.map((gram, index) => [gram, index]));
  }

  const vector = buildLogRegVector(input, model._vocabIndex, ngramMin, ngramMax, features);
  const logits = model.weights.map((row, k) => dot(row, vector) + model.bias[k]);
  return softmax(logits);
}

function buildLogRegVector(input, vocabIndex, ngramMin, ngramMax, featureNames) {
  const vector = Array(vocabIndex.size + featureNames.length).fill(0);
  const grams = extractNgrams(input, ngramMin, ngramMax);
  for (const gram of grams) {
    const index = vocabIndex.get(gram);
    if (index !== undefined) vector[index] += 1;
  }

  const extra = computeLogRegExtras(input);
  featureNames.forEach((name, idx) => {
    vector[vocabIndex.size + idx] = extra[name] ? 1 : 0;
  });

  return vector;
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

function computeLogRegExtras(input) {
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

function curriculumConstraintScore(expr, curriculum) {
  const normalized = (curriculum || '').toLowerCase();
  if (!normalized || normalized === 'general') return 1;

  const containsAdvanced = /(\bint\b|\b∫\b|\bsum\b|\blim\b|\bd\/dx\b|\bderivative\b)/i.test(expr);
  if (normalized.includes('o-level') || normalized.includes('olevel')) {
    return containsAdvanced ? 0.3 : 1;
  }

  return containsAdvanced ? 0.6 : 1;
}

function contextMatchScore(expr, sessionContext) {
  const normalizedContext = sessionContext.map(item => normalizeExpression(item));
  if (normalizedContext.includes(expr)) return 1;
  return 0.5;
}

function distanceToScore(distance) {
  const capped = Math.min(distance, 10);
  return 1 - capped / 10;
}

function levenshteinDistance(a, b) {
  if (a === b) return 0;
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function normalizeExpression(expr) {
  return String(expr)
    .toLowerCase()
    .replace(/π/g, 'pi')
    .replace(/[×*]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/\s+/g, '')
    .trim();
}

function toSuperscript(value) {
  const map = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹'
  };
  return String(value)
    .split('')
    .map(char => map[char] || char)
    .join('');
}
