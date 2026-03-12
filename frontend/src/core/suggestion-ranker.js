// ============================================================================
// suggestion-ranker.js — XGBoost-style Gradient Boosted Decision Tree ranker
//
// Re-ranks math LaTeX suggestions using a lightweight GBDT ensemble that runs
// entirely client-side. Ships with hand-crafted cold-start trees and supports
// online learning from user feedback (thumbs-up / thumbs-down).
//
// Features extracted from (raw_input, suggestion_latex) pairs are scored by
// an ensemble of shallow decision trees trained via gradient boosting with
// L2 regularisation — the same algorithmic core as XGBoost.
// ============================================================================

(function () {
  'use strict';

  // ==========================================================================
  // LEVENSHTEIN DISTANCE (optimised single-row DP)
  // ==========================================================================

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = new Array(n + 1);
    let curr = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      [prev, curr] = [curr, prev];
    }
    return prev[n];
  }

  // ==========================================================================
  // FEATURE EXTRACTION
  // ==========================================================================

  const FEATURE_NAMES = [
    'input_length',           // 0  – character count of raw input
    'suggestion_length',      // 1  – character count of suggestion LaTeX
    'length_ratio',           // 2  – suggestion_length / input_length
    'norm_edit_distance',     // 3  – Levenshtein / max(lengths)
    'has_explicit_parens',    // 4  – 1 if suggestion has matching ()
    'has_frac',               // 5  – 1 if suggestion contains \frac
    'has_power',              // 6  – 1 if suggestion contains ^
    'has_sqrt',               // 7  – 1 if suggestion contains \sqrt
    'has_degree',             // 8  – 1 if suggestion contains degree symbol
    'has_inverse',            // 9  – 1 if suggestion contains ^{-1}
    'is_trig_input',          // 10 – 1 if input contains a trig function
    'is_log_input',           // 11 – 1 if input contains log/ln
    'suggestion_cmd_count',   // 12 – number of LaTeX backslash commands
    'shared_token_ratio',     // 13 – fraction of input chars in suggestion
    'position_rank',          // 14 – normalised original position (0–1)
    'char_overlap',           // 15 – Jaccard similarity of character sets
    'prefix_match_len',       // 16 – normalised common-prefix length
    'is_common_angle',        // 17 – 1 if input contains a typical angle
    'has_subscript',          // 18 – 1 if suggestion contains subscript
    'nesting_depth',          // 19 – maximum brace/paren nesting depth
  ];

  /**
   * Extract a 20-dimensional numeric feature vector from an
   * (input, suggestion) pair.
   *
   * @param {string} rawInput        – the text the student typed
   * @param {string} suggestionLatex – one candidate LaTeX suggestion
   * @param {object} meta            – { position, totalCount }
   * @returns {number[]}
   */
  function extractFeatures(rawInput, suggestionLatex, meta) {
    const inp = String(rawInput || '');
    const sug = String(suggestionLatex || '');
    const pos = (meta && meta.position != null) ? meta.position : 0;
    const total = (meta && meta.totalCount) ? meta.totalCount : 1;

    // 0, 1, 2 — lengths
    const inputLen = inp.length;
    const sugLen = sug.length;
    const lengthRatio = sugLen / Math.max(inputLen, 1);

    // 3 — normalised edit distance
    const edist = levenshtein(inp.toLowerCase(), sug.toLowerCase());
    const normEdit = edist / Math.max(inputLen, sugLen, 1);

    // 4–9 — content flags
    const hasExplicitParens = (sug.includes('(') && sug.includes(')')) ? 1 : 0;
    const hasFrac = /\\frac\b/.test(sug) ? 1 : 0;
    const hasPower = sug.includes('^') ? 1 : 0;
    const hasSqrt = /\\sqrt/.test(sug) ? 1 : 0;
    const hasDegree = /\\circ|°/.test(sug) ? 1 : 0;
    const hasInverse = /\^\{?\s*-\s*1\s*\}?/.test(sug) ? 1 : 0;

    // 10, 11 — input type
    const isTrigInput = /(?:sin|cos|tan|sec|csc|cot|cosec)/i.test(inp) ? 1 : 0;
    const isLogInput = /\b(?:log|ln)\b/i.test(inp) ? 1 : 0;

    // 12 — LaTeX command count
    const cmdCount = (sug.match(/\\/g) || []).length;

    // 13 — shared-token ratio
    const inputChars = new Set(inp.toLowerCase().replace(/\s/g, ''));
    const sugChars = new Set(sug.toLowerCase().replace(/\s/g, ''));
    let shared = 0;
    for (const c of inputChars) { if (sugChars.has(c)) shared++; }
    const sharedTokenRatio = shared / Math.max(inputChars.size, 1);

    // 14 — normalised position
    const positionRank = pos / Math.max(total - 1, 1);

    // 15 — Jaccard char overlap
    const unionSize = new Set([...inputChars, ...sugChars]).size;
    const charOverlap = shared / Math.max(unionSize, 1);

    // 16 — normalised prefix-match length
    let prefixLen = 0;
    const minLen = Math.min(inp.length, sug.length);
    while (prefixLen < minLen && inp[prefixLen].toLowerCase() === sug[prefixLen].toLowerCase()) {
      prefixLen++;
    }
    const prefixMatchLen = prefixLen / Math.max(inputLen, 1);

    // 17 — common-angle detection
    const COMMON_ANGLES = new Set(['30', '45', '60', '90', '120', '135', '150', '180', '270', '360']);
    const numbers = inp.match(/\d+/g) || [];
    const isCommonAngle = numbers.some(n => COMMON_ANGLES.has(n)) ? 1 : 0;

    // 18 — subscript
    const hasSubscript = (/_{/.test(sug) || /(?<![\\a-zA-Z])_\d/.test(sug)) ? 1 : 0;

    // 19 — nesting depth
    let maxDepth = 0, depth = 0;
    for (const ch of sug) {
      if (ch === '{' || ch === '(') { depth++; maxDepth = Math.max(maxDepth, depth); }
      if (ch === '}' || ch === ')') { depth = Math.max(0, depth - 1); }
    }

    return [
      inputLen,           // 0
      sugLen,             // 1
      lengthRatio,        // 2
      normEdit,           // 3
      hasExplicitParens,  // 4
      hasFrac,            // 5
      hasPower,           // 6
      hasSqrt,            // 7
      hasDegree,          // 8
      hasInverse,         // 9
      isTrigInput,        // 10
      isLogInput,         // 11
      cmdCount,           // 12
      sharedTokenRatio,   // 13
      positionRank,       // 14
      charOverlap,        // 15
      prefixMatchLen,     // 16
      isCommonAngle,      // 17
      hasSubscript,       // 18
      maxDepth,           // 19
    ];
  }

  // ==========================================================================
  // DECISION TREE INFERENCE
  // ==========================================================================
  // Internal node: { f: featureIndex, t: threshold, l: leftChild, r: rightChild }
  // Leaf node:     { v: value }

  function predictTree(node, features) {
    if (node.v !== undefined) return node.v;
    return features[node.f] <= node.t
      ? predictTree(node.l, features)
      : predictTree(node.r, features);
  }

  // ==========================================================================
  // GBDT RANKER — XGBoost-style gradient boosted decision tree ensemble
  // ==========================================================================

  class GBDTRanker {
    /**
     * @param {object} config
     * @param {number} config.learningRate  – shrinkage (η), default 0.1
     * @param {number} config.nTrees        – number of boosting rounds
     * @param {number} config.maxDepth      – max tree depth (1 = stumps)
     * @param {number} config.lambda        – L2 regularisation term
     * @param {number} config.minSamplesLeaf – minimum samples per leaf
     */
    constructor(config) {
      config = config || {};
      this.trees = [];
      this.bias = 0;
      this.lr = config.learningRate != null ? config.learningRate : 0.1;
      this.nTrees = config.nTrees || 50;
      this.maxDepth = config.maxDepth || 2;
      this.lambda = config.lambda != null ? config.lambda : 1.0;
      this.minSamplesLeaf = config.minSamplesLeaf || 2;
    }

    /** Predict a relevance score for a single feature vector. */
    predict(features) {
      var score = this.bias;
      for (var i = 0; i < this.trees.length; i++) {
        score += this.lr * predictTree(this.trees[i], features);
      }
      return score;
    }

    /**
     * Re-rank an array of LaTeX suggestion strings.
     *
     * @param {string}   rawInput    – what the student typed
     * @param {string[]} suggestions – candidate LaTeX strings
     * @returns {string[]}           – suggestions sorted by predicted score
     */
    rankSuggestions(rawInput, suggestions) {
      if (!suggestions || suggestions.length <= 1) return suggestions;

      var total = suggestions.length;
      var scored = new Array(total);
      for (var i = 0; i < total; i++) {
        var feats = extractFeatures(rawInput, suggestions[i], { position: i, totalCount: total });
        scored[i] = { suggestion: suggestions[i], score: this.predict(feats) };
      }

      scored.sort(function (a, b) { return b.score - a.score; });

      var result = new Array(scored.length);
      for (var j = 0; j < scored.length; j++) result[j] = scored[j].suggestion;
      return result;
    }

    // =====================================================================
    // TRAINING (gradient boosting with MSE loss + L2 regularisation)
    // =====================================================================

    /**
     * Fit the ensemble on labelled data.
     *
     * @param {number[][]} X – feature matrix (rows = samples)
     * @param {number[]}   y – target relevance scores (e.g. 1 = selected, 0 = not)
     */
    fit(X, y) {
      var n = X.length;
      if (n === 0) return;

      // Initialise predictions with the mean of y
      var sum = 0;
      for (var i = 0; i < n; i++) sum += y[i];
      this.bias = sum / n;

      var predictions = new Array(n);
      for (var i = 0; i < n; i++) predictions[i] = this.bias;

      this.trees = [];

      for (var t = 0; t < this.nTrees; t++) {
        // Negative gradient (residuals for MSE)
        var residuals = new Array(n);
        for (var i = 0; i < n; i++) residuals[i] = y[i] - predictions[i];

        var tree = this._buildTree(X, residuals, 0);
        this.trees.push(tree);

        // Update predictions
        for (var i = 0; i < n; i++) {
          predictions[i] += this.lr * predictTree(tree, X[i]);
        }
      }
    }

    /**
     * Build a single regression tree on residuals.
     * Uses the XGBoost exact greedy split-finding algorithm.
     */
    _buildTree(X, y, depth) {
      var n = X.length;

      // Leaf condition
      if (n <= this.minSamplesLeaf || depth >= this.maxDepth) {
        var s = 0;
        for (var i = 0; i < n; i++) s += y[i];
        return { v: s / (n + this.lambda) };
      }

      var bestGain = 0;   // only split when gain > 0
      var bestFeature = -1;
      var bestThreshold = 0;
      var bestLeftIdx = null;
      var bestRightIdx = null;

      var nFeatures = X[0].length;
      var totalSum = 0;
      for (var i = 0; i < n; i++) totalSum += y[i];

      for (var f = 0; f < nFeatures; f++) {
        // Sort sample indices by feature value
        var indices = new Array(n);
        for (var i = 0; i < n; i++) indices[i] = i;
        indices.sort(function (a, b) { return X[a][f] - X[b][f]; });

        var leftSum = 0;
        var leftCount = 0;

        for (var k = 0; k < n - 1; k++) {
          var idx = indices[k];
          leftSum += y[idx];
          leftCount++;

          // Skip if same feature value as next (no valid threshold between them)
          if (X[indices[k]][f] === X[indices[k + 1]][f]) continue;

          var rightSum = totalSum - leftSum;
          var rightCount = n - leftCount;

          if (leftCount < this.minSamplesLeaf || rightCount < this.minSamplesLeaf) continue;

          // XGBoost gain: G_L²/(H_L+λ) + G_R²/(H_R+λ) − G²/(H+λ)
          // For MSE: G = sum of residuals, H = count
          var gain = (leftSum * leftSum) / (leftCount + this.lambda)
                   + (rightSum * rightSum) / (rightCount + this.lambda)
                   - (totalSum * totalSum) / (n + this.lambda);

          if (gain > bestGain) {
            bestGain = gain;
            bestFeature = f;
            bestThreshold = (X[indices[k]][f] + X[indices[k + 1]][f]) / 2;
          }
        }
      }

      // No beneficial split found → make a leaf
      if (bestFeature === -1) {
        var s = 0;
        for (var i = 0; i < n; i++) s += y[i];
        return { v: s / (n + this.lambda) };
      }

      // Partition data
      var leftX = [], leftY = [], rightX = [], rightY = [];
      for (var i = 0; i < n; i++) {
        if (X[i][bestFeature] <= bestThreshold) {
          leftX.push(X[i]); leftY.push(y[i]);
        } else {
          rightX.push(X[i]); rightY.push(y[i]);
        }
      }

      return {
        f: bestFeature,
        t: bestThreshold,
        l: this._buildTree(leftX, leftY, depth + 1),
        r: this._buildTree(rightX, rightY, depth + 1),
      };
    }

    // =====================================================================
    // SERIALISATION
    // =====================================================================

    toJSON() {
      return { trees: this.trees, bias: this.bias, lr: this.lr, featureNames: FEATURE_NAMES };
    }

    static fromJSON(json) {
      var r = new GBDTRanker();
      r.trees = json.trees || [];
      r.bias = json.bias || 0;
      r.lr = json.lr != null ? json.lr : 0.1;
      return r;
    }
  }

  // ==========================================================================
  // COLD-START DEFAULT MODEL
  // ==========================================================================
  // Hand-crafted depth-2 decision trees that encode domain knowledge about
  // which math suggestions students typically prefer. The bias plus trees
  // produce scores in roughly [0, 1] — higher = more relevant.
  //
  // These work well even with zero training data. As feedback accumulates
  // the online learner appends learned trees that progressively override
  // the heuristics.

  var DEFAULT_MODEL = {
    bias: 0.50,
    lr: 1.0,   // raw tree values (hand-tuned), so η = 1
    trees: [
      // Tree 0 – Edit distance: prefer suggestions closer to the typed input
      { f: 3, t: 0.65,
        l: { f: 3, t: 0.25,
          l: { v:  0.15 },   // very similar → strong bonus
          r: { v:  0.05 }    // moderate similarity → small bonus
        },
        r: { v: -0.18 }      // very different → penalty
      },

      // Tree 1 – Explicit parentheses: clearer mathematical notation
      { f: 4, t: 0.5,
        l: { v: -0.02 },     // no parens → slight penalty
        r: { v:  0.10 }      // has parens → bonus
      },

      // Tree 2 – Position in original list (rule-based order is a prior)
      { f: 14, t: 0.35,
        l: { v:  0.09 },     // near top → bonus
        r: { f: 14, t: 0.75,
          l: { v:  0.00 },   // middle → neutral
          r: { v: -0.07 }    // bottom → penalty
        }
      },

      // Tree 3 – Shared character-token overlap
      { f: 13, t: 0.45,
        l: { v: -0.08 },     // low overlap → penalty
        r: { v:  0.07 }      // high overlap → bonus
      },

      // Tree 4 – Length ratio: penalise suggestions vastly longer or shorter
      { f: 2, t: 2.8,
        l: { f: 2, t: 0.35,
          l: { v: -0.12 },   // much shorter → penalty
          r: { v:  0.04 }    // reasonable range → slight bonus
        },
        r: { v: -0.14 }      // much longer → penalty
      },

      // Tree 5 – Trig input + degree notation interaction
      { f: 10, t: 0.5,
        l: { v:  0.00 },     // not trig → neutral
        r: { f: 8, t: 0.5,
          l: { v:  0.00 },   // trig but no degree → neutral
          r: { v:  0.10 }    // trig + degree → bonus
        }
      },

      // Tree 6 – Suggestion complexity (too many LaTeX commands = noisy)
      { f: 12, t: 5,
        l: { v:  0.03 },     // simple → slight bonus
        r: { f: 12, t: 9,
          l: { v: -0.04 },   // moderate → slight penalty
          r: { v: -0.11 }    // heavy → penalty
        }
      },

      // Tree 7 – Prefix match: suggestions that start like the input feel natural
      { f: 16, t: 0.25,
        l: { v: -0.04 },     // no common prefix → penalty
        r: { v:  0.07 }      // good prefix → bonus
      },

      // Tree 8 – Character-level Jaccard overlap
      { f: 15, t: 0.45,
        l: { v: -0.04 },
        r: { v:  0.06 }
      },

      // Tree 9 – Deep nesting penalty
      { f: 19, t: 4,
        l: { v:  0.02 },     // shallow → slight bonus
        r: { v: -0.09 }      // deep → penalty
      },

      // Tree 10 – Common angle + trig → degree interpretation bonus
      { f: 17, t: 0.5,
        l: { v:  0.00 },
        r: { f: 10, t: 0.5,
          l: { v:  0.00 },
          r: { v:  0.06 }    // common angle + trig → bonus
        }
      },

      // Tree 11 – Inverse notation: prefer when input contains -1 pattern
      { f: 9, t: 0.5,
        l: { v:  0.00 },
        r: { f: 3, t: 0.5,
          l: { v:  0.08 },   // inverse + close to input → bonus
          r: { v:  0.02 }
        }
      },
    ]
  };

  // ==========================================================================
  // ONLINE LEARNER — incremental retraining from user feedback
  // ==========================================================================

  /**
   * Buffers pairwise feedback and periodically retrains.
   * Blends newly learned trees with the cold-start default.
   */
  function OnlineLearner(baseRanker) {
    this.ranker = baseRanker;
    this.buffer = [];          // { features: number[], label: number }
    this.minBufferSize = 20;   // retrain after 20 labelled samples
    this.learnedTrees = [];
  }

  /**
   * Record feedback for one interaction.
   *
   * @param {string}   rawInput          – what the student typed
   * @param {string}   selectedLatex     – the suggestion they chose (or '')
   * @param {string[]} allSuggestions    – full candidate list shown
   * @param {number}   rating            – 1 = positive, 0 = negative
   */
  OnlineLearner.prototype.addFeedback = function (rawInput, selectedLatex, allSuggestions, rating) {
    var total = allSuggestions.length;
    for (var i = 0; i < total; i++) {
      var sug = allSuggestions[i];
      var features = extractFeatures(rawInput, sug, { position: i, totalCount: total });
      var label;
      if (sug === selectedLatex) {
        label = rating > 0 ? 1.0 : 0.0;
      } else {
        // Unselected suggestions get a small negative label (not strongly negative)
        label = 0.2;
      }
      this.buffer.push({ features: features, label: label });
    }

    if (this.buffer.length >= this.minBufferSize) {
      this.retrain();
    }
  };

  /** Retrain from buffered data, blending with the default model. */
  OnlineLearner.prototype.retrain = function () {
    if (this.buffer.length < this.minBufferSize) return false;

    var X = this.buffer.map(function (b) { return b.features; });
    var y = this.buffer.map(function (b) { return b.label; });

    var learner = new GBDTRanker({
      learningRate: 0.08,
      nTrees: 20,
      maxDepth: 2,
      lambda: 2.0,
      minSamplesLeaf: 3,
    });
    learner.fit(X, y);

    this.learnedTrees = learner.trees;

    // Blend: default trees + learned trees
    this.ranker.trees = DEFAULT_MODEL.trees.concat(this.learnedTrees);
    this.ranker.bias = (DEFAULT_MODEL.bias + learner.bias) / 2;
    // Learned trees use the learner's lr; default trees use 1.0
    // Since both are in the same array, use a blended lr
    this.ranker.lr = 1.0;

    return true;
  };

  // ==========================================================================
  // INITIALISE
  // ==========================================================================

  var ranker = GBDTRanker.fromJSON(DEFAULT_MODEL);
  var onlineLearner = new OnlineLearner(ranker);

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  var publicAPI = {
    /**
     * Re-rank suggestions using the GBDT model.
     * @param {string}   rawInput    – the text the student typed
     * @param {string[]} suggestions – candidate LaTeX strings
     * @returns {string[]}           – re-ranked suggestions (best first)
     */
    rankSuggestions: function (rawInput, suggestions) {
      return ranker.rankSuggestions(rawInput, suggestions);
    },

    /**
     * Record feedback for online learning.
     * @param {string}   rawInput       – input text
     * @param {string}   selectedLatex  – chosen suggestion
     * @param {string[]} allSuggestions – full list that was shown
     * @param {number}   rating         – 1 = useful, 0 = not useful
     */
    addFeedback: function (rawInput, selectedLatex, allSuggestions, rating) {
      onlineLearner.addFeedback(rawInput, selectedLatex, allSuggestions, rating);
    },

    /** Extract a feature vector (useful for debugging / training export). */
    extractFeatures: extractFeatures,

    /** Feature name array (parallel to feature vectors). */
    FEATURE_NAMES: FEATURE_NAMES,

    /** The GBDTRanker class (for external training scripts). */
    GBDTRanker: GBDTRanker,

    /** Load a trained model (JSON with trees, bias, lr). */
    loadModel: function (json) {
      var loaded = GBDTRanker.fromJSON(json);
      ranker.trees = loaded.trees;
      ranker.bias = loaded.bias;
      ranker.lr = loaded.lr;
    },

    /** Export current model state as JSON. */
    getModel: function () {
      return ranker.toJSON();
    },
  };

  if (typeof globalThis !== 'undefined') { globalThis.suggestionRanker = publicAPI; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = publicAPI; }
})();
