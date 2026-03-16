// ============================================================================
// ambiguity-resolver.js — Multi-interpretation suggestion engine
//
// Takes an AST from grammar-parser.js and generates alternative parse trees
// for ambiguous student input. Each alternative is rendered to LaTeX.
//
// Batch 2: Ambiguity detection + suggestion generation
// ============================================================================

(function () {
  'use strict';

  // Grab the parser module (loaded before this file)
  function getParser() {
    return (typeof globalThis !== 'undefined' && globalThis.grammarParser) || {};
  }

  // ==========================================================================
  // AMBIGUITY RULES
  // ==========================================================================
  // Each rule is: { name, match(node) → bool, expand(node) → AST[] }
  // `match` checks if a node is ambiguous.
  // `expand` returns alternative ASTs for that node (including the original).

  const ambiguityRules = [];

  // --------------------------------------------------------------------------
  // Rule 1: Function + implicit multiply — sin2x
  // "sin2x" parses as implicit_mul(sin(2), x)
  // Alternatives: sin(2x), sin²(x), sin(2)·x
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'func-implicit-mul',
    match(node) {
      if (node.type !== 'implicit_multiply') return false;
      return node.factors.some(f => f.type === 'function' && !f.hasExplicitParens);
    },
    expand(node) {
      const { ASTNode, astToLatex } = getParser();
      const factors = node.factors;
      const results = [];

      // Find function nodes and their positions
      for (let i = 0; i < factors.length; i++) {
        const f = factors[i];
        if (f.type !== 'function' || f.hasExplicitParens) continue;
        if (f.args.length === 0) continue;

        const funcArg = f.args[0];
        const remaining = factors.filter((_, idx) => idx !== i);

        // --- Interpretation A: Absorb following factor(s) into function arg
        // sin(2) * x → sin(2x), sin(2*x)
        if (i < factors.length - 1) {
          const nextFactors = factors.slice(i + 1);
          const before = factors.slice(0, i);

          // Combine current arg with next factor(s)
          let combinedArg;
          const allAbsorbed = [funcArg, ...nextFactors];
          if (allAbsorbed.length === 1) {
            combinedArg = allAbsorbed[0];
          } else {
            combinedArg = ASTNode.implicitMul(allAbsorbed);
          }

          const newFunc = ASTNode.func(f.name, [combinedArg], f.modifier, true);
          if (before.length === 0) {
            results.push(newFunc);
          } else {
            results.push(ASTNode.implicitMul([...before, newFunc]));
          }
        }

        // --- Interpretation B: Number arg becomes power — sin²(x)
        // sin(2) * x → sin²(x) (only when arg is a single small digit)
        if (funcArg.type === 'number' && /^[2-9]$/.test(funcArg.value)) {
          const power = funcArg;
          // The "real" argument is the next factor
          if (i < factors.length - 1) {
            const nextFactor = factors[i + 1];
            const before = factors.slice(0, i);
            const after = factors.slice(i + 2);

            const newFunc = ASTNode.func(f.name, [nextFactor], ASTNode.number(power.value), true);
            const allParts = [...before, newFunc, ...after];
            if (allParts.length === 1) {
              results.push(allParts[0]);
            } else {
              results.push(ASTNode.implicitMul(allParts));
            }
          }
        }

        // --- Interpretation C: Original — keep as sin(2)·x (already the default parse)
        // Push the original node
        results.push(node);
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 2: Function with number-only implicit arg — sin30, cos45, tan60
  // Alternatives: sin(30°), sin(30)
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'func-degree-ambiguity',
    match(node) {
      if (node.type !== 'function') return false;
      if (node.hasExplicitParens) return false;
      if (node.args.length !== 1) return false;
      const arg = node.args[0];
      return arg.type === 'number' && isCommonAngle(arg.value);
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [];
      const arg = node.args[0];

      // Interpretation A: degrees — sin(30°)
      const degreeArg = ASTNode.degree(ASTNode.number(arg.value));
      results.push(ASTNode.func(node.name, [degreeArg], node.modifier, true));

      // Interpretation B: radians (original) — sin(30)
      results.push(ASTNode.func(node.name, [arg], node.modifier, true));

      return results;
    }
  });

  // --------------------------------------------------------------------------
  // Rule 3: Division ambiguity — a/bc
  // "1/2x" parses as frac(1, 2) * x  or could mean 1/(2x)
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'division-trailing-factor',
    match(node) {
      if (node.type !== 'implicit_multiply') return false;
      // Check if any factor is a binary '/' (frac) followed by more factors
      return node.factors.some((f, i) =>
        f.type === 'binary' && f.op === '/' && i < node.factors.length - 1
      );
    },
    expand(node) {
      const { ASTNode } = getParser();
      const factors = node.factors;
      const results = [];

      for (let i = 0; i < factors.length; i++) {
        const f = factors[i];
        if (f.type !== 'binary' || f.op !== '/') continue;
        if (i >= factors.length - 1) continue;

        const before = factors.slice(0, i);
        const after = factors.slice(i + 1);

        // Interpretation A: (a/b) * rest — already the default parse
        results.push(node);

        // Interpretation B: a / (b * rest) — absorb trailing into denominator
        let newDenom;
        const denomParts = [f.right, ...after];
        if (denomParts.length === 1) {
          newDenom = denomParts[0];
        } else {
          newDenom = ASTNode.implicitMul(denomParts);
        }
        const newFrac = ASTNode.binary('/', f.left, newDenom);
        if (before.length === 0) {
          results.push(newFrac);
        } else {
          results.push(ASTNode.implicitMul([...before, newFrac]));
        }
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 4: Power trailing ambiguity — e^2x
  // "e^2x" parses as (e^2) * x but could mean e^(2x)
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'power-trailing-factor',
    match(node) {
      if (node.type !== 'implicit_multiply') return false;
      return node.factors.some((f, i) =>
        f.type === 'power' && i < node.factors.length - 1
      );
    },
    expand(node) {
      const { ASTNode } = getParser();
      const factors = node.factors;
      const results = [];

      for (let i = 0; i < factors.length; i++) {
        const f = factors[i];
        if (f.type !== 'power') continue;
        if (i >= factors.length - 1) continue;

        const before = factors.slice(0, i);
        const after = factors.slice(i + 1);

        // Interpretation A: (base^exp) * rest — already the default
        results.push(node);

        // Interpretation B: base^(exp * rest) — absorb trailing into exponent
        const expParts = [f.exponent, ...after];
        let newExp;
        if (expParts.length === 1) {
          newExp = expParts[0];
        } else {
          newExp = ASTNode.implicitMul(expParts);
        }
        const newPower = ASTNode.power(f.base, newExp);
        if (before.length === 0) {
          results.push(newPower);
        } else {
          results.push(ASTNode.implicitMul([...before, newPower]));
        }
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 5: Function division — sinpi/6
  // "sinpi/6" parses as frac(sin(pi), 6) but could mean sin(pi/6)
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'func-division',
    match(node) {
      if (node.type !== 'binary' || node.op !== '/') return false;
      // Check if numerator contains a function with implicit arg
      return containsImplicitFunc(node.left);
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [];

      // Interpretation A: original — frac(func(arg), denom)
      results.push(node);

      // Interpretation B: absorb denominator into function arg — func(arg/denom)
      const rewritten = absorbDenomIntoFunc(node.left, node.right);
      if (rewritten) {
        results.push(rewritten);
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 6: Log base ambiguity — log2x with subscript
  // Already handled partly by parser (log10(x) → subscript),
  // but log2x without parens has base vs. multiply ambiguity
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'log-base-ambiguity',
    match(node) {
      if (node.type !== 'subscript') return false;
      if (node.base.type !== 'function') return false;
      return node.base.name === 'log' || node.base.name === 'lg';
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [];

      // Interpretation A: log_base(arg) — the default parse
      results.push(node);

      // Interpretation B: log(base * arg) — no subscript, multiply
      const base = node.sub;
      const args = node.base.args;
      if (args.length > 0) {
        const combined = ASTNode.implicitMul([base, ...args]);
        const newFunc = ASTNode.func(node.base.name, [combined], node.base.modifier, true);
        results.push(newFunc);
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 7: Implicit multiply could be subscript — x1, a0, y2
  // "x1" or "x2" → x₁ or x² (subscript vs superscript)
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'var-number-ambiguity',
    match(node) {
      if (node.type !== 'implicit_multiply') return false;
      const factors = node.factors;
      if (factors.length < 2) return false;
      const last = factors[factors.length - 1];
      const secondLast = factors[factors.length - 2];
      return secondLast.type === 'variable' && last.type === 'number' && /^[0-9]+$/.test(last.value);
    },
    expand(node) {
      const { ASTNode } = getParser();
      const factors = node.factors;
      const varNode = factors[factors.length - 2];
      const numNode = factors[factors.length - 1];
      const prefix = factors.slice(0, factors.length - 2);
      const results = [];

      function withPrefix(expr) {
        if (prefix.length === 0) return expr;
        return ASTNode.implicitMul([...prefix, expr]);
      }

      // Interpretation A: ...x² (trailing digit as power)
      results.push(withPrefix(ASTNode.power(varNode, numNode)));

      // Interpretation B: ...x₁ (trailing digit as subscript)
      results.push(withPrefix(ASTNode.subscript(varNode, numNode)));

      // Interpretation C: original (implicit multiply)
      results.push(node);

      return results;
    }
  });

  // --------------------------------------------------------------------------
  // Rule 7b: Fraction denominator split — a/(bc) ↔ (a/b)c
  // Helps with inputs like (-1/2x) where users often mean (-1/2)x.
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'fraction-denominator-split',
    match(node) {
      return node.type === 'binary' && node.op === '/' && node.right && node.right.type === 'implicit_multiply' && node.right.factors.length > 1;
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [node];
      const denomFactors = node.right.factors;
      const head = denomFactors[0];
      const tail = denomFactors.slice(1);

      const headFrac = ASTNode.binary('/', node.left, head);
      if (tail.length === 0) {
        results.push(headFrac);
      } else {
        results.push(ASTNode.implicitMul([headFrac, ...tail]));
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 8: sqrt alternative — x^(1/2) ↔ sqrt(x)
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'sqrt-power-equivalence',
    match(node) {
      if (node.type !== 'power') return false;
      const exp = node.exponent;
      // x^(1/2) or x^(1/3)
      if (exp.type === 'binary' && exp.op === '/') {
        if (exp.left.type === 'number' && exp.left.value === '1') {
          if (exp.right.type === 'number' && ['2', '3'].includes(exp.right.value)) {
            return true;
          }
        }
      }
      return false;
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [];
      const den = node.exponent.right.value;

      // Interpretation A: sqrt / cbrt form
      if (den === '2') {
        results.push(ASTNode.sqrt(node.base));
      } else {
        results.push(ASTNode.sqrt(node.base, ASTNode.number(den)));
      }

      // Interpretation B: fractional power — original
      results.push(node);

      return results;
    }
  });

  // --------------------------------------------------------------------------
  // Rule 9: Fractional power — x1/2 → x^(1/2), √x
  // "x1/2" parses as frac(x·1, 2) but could mean x^{1/2}
  // Matches: binary("/", implicit_mul([var, num]), num2)  
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'fractional-power',
    match(node) {
      if (node.type !== 'binary' || node.op !== '/') return false;
      const left = node.left;
      if (left.type !== 'implicit_multiply') return false;
      if (left.factors.length !== 2) return false;
      const [first, second] = left.factors;
      // First factor must be non-number (variable, function, etc.)
      // Second factor must be a number (the numerator of the fractional power)
      if (second.type !== 'number') return false;
      if (node.right.type !== 'number') return false;
      // Only match when a non-number is immediately followed by a fraction
      return first.type === 'variable' || first.type === 'constant' ||
             first.type === 'function' || first.type === 'power' ||
             first.type === 'group';
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [];
      const [base, numNode] = node.left.factors;
      const denomNode = node.right;
      const num = numNode.value;
      const den = denomNode.value;

      // Interpretation A: original — frac(base·num, den)
      results.push(node);

      // Interpretation B: base^(num/den) — fractional power
      const fracExp = ASTNode.binary('/', ASTNode.number(num), ASTNode.number(den));
      results.push(ASTNode.power(base, fracExp));

      // Interpretation C: sqrt / cbrt form (when num is 1)
      if (num === '1') {
        if (den === '2') {
          results.push(ASTNode.sqrt(base));
        } else if (den === '3') {
          results.push(ASTNode.sqrt(base, ASTNode.number('3')));
        }
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 9b: Power-over-number fraction — x^1/2 → x^(1/2), √x
  // Matches binary('/', power(base, 1), n)
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'power-fractional-exponent',
    match(node) {
      if (node.type !== 'binary' || node.op !== '/') return false;
      if (!node.left || node.left.type !== 'power') return false;
      if (!node.right || node.right.type !== 'number') return false;
      const exp = node.left.exponent;
      return exp && exp.type === 'number' && exp.value === '1';
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [node];

      const base = node.left.base;
      const den = node.right.value;

      // Interpretation: base^(1/n)
      const fracExp = ASTNode.binary('/', ASTNode.number('1'), ASTNode.number(den));
      results.push(ASTNode.power(base, fracExp));

      // Root forms for common indices
      if (den === '2') {
        results.push(ASTNode.sqrt(base));
      } else if (den === '3') {
        results.push(ASTNode.sqrt(base, ASTNode.number('3')));
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 10: Trig identity — sinx/cosx → tan(x), etc.
  // Recognizes common trig quotients and suggests the equivalent function.
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'trig-identity',
    match(node) {
      if (node.type !== 'binary' || node.op !== '/') return false;
      const { left, right } = node;

      // Pattern A: func(arg) / func(arg) — e.g. sin(x)/cos(x)
      if (left.type === 'function' && right.type === 'function') {
        const pair = left.name + '/' + right.name;
        return ['sin/cos', 'cos/sin', 'sin/tan', 'cos/tan'].includes(pair);
      }

      // Pattern B: 1/func(arg) — e.g. 1/sin(x)
      if (left.type === 'number' && left.value === '1' && right.type === 'function') {
        return ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'cosec'].includes(right.name);
      }

      return false;
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [];
      const { left, right } = node;

      // Always include the original
      results.push(node);

      if (left.type === 'function' && right.type === 'function') {
        const pair = left.name + '/' + right.name;
        const arg = left.args.length > 0 ? left.args[0] : ASTNode.variable('x');

        if (pair === 'sin/cos') {
          results.push(ASTNode.func('tan', [arg], null, true));
        } else if (pair === 'cos/sin') {
          results.push(ASTNode.func('cot', [arg], null, true));
        }
      }

      if (left.type === 'number' && left.value === '1' && right.type === 'function') {
        const funcName = right.name;
        const arg = right.args.length > 0 ? right.args[0] : ASTNode.variable('x');
        // Reciprocal identities
        const reciprocals = {
          'sin': 'csc', 'cos': 'sec', 'tan': 'cot',
          'csc': 'sin', 'cosec': 'sin', 'sec': 'cos', 'cot': 'tan'
        };
        if (reciprocals[funcName]) {
          results.push(ASTNode.func(reciprocals[funcName], [arg], null, true));
        }
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 11: Double angle — 2sin(x)cos(x) → sin(2x)
  // Recognizes the pattern coefficient·sin(arg)·cos(arg) where coefficient is 2.
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'double-angle',
    match(node) {
      if (node.type !== 'implicit_multiply') return false;
      const factors = node.factors;
      // Check for pattern: 2 * sin(arg) * cos(arg) in any order
      const hasTwo = factors.some(f => f.type === 'number' && f.value === '2');
      const sinNode = factors.find(f => f.type === 'function' && f.name === 'sin');
      const cosNode = factors.find(f => f.type === 'function' && f.name === 'cos');
      return hasTwo && sinNode && cosNode;
    },
    expand(node) {
      const { ASTNode, astToLatex } = getParser();
      const factors = node.factors;
      const results = [];

      // Original: 2sin(x)cos(x)
      results.push(node);

      // Find sin and cos nodes to extract arg
      const sinNode = factors.find(f => f.type === 'function' && f.name === 'sin');
      const cosNode = factors.find(f => f.type === 'function' && f.name === 'cos');

      if (sinNode && cosNode && sinNode.args.length > 0 && cosNode.args.length > 0) {
        const sinArg = astToLatex(sinNode.args[0]);
        const cosArg = astToLatex(cosNode.args[0]);

        // Only offer identity when both args are the same
        if (sinArg === cosArg) {
          const arg = sinNode.args[0];
          // sin(2x) — double angle identity
          const doubledArg = ASTNode.implicitMul([ASTNode.number('2'), arg]);
          results.push(ASTNode.func('sin', [doubledArg], null, true));
        }
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 12: Function + additive — tanx+pi/6 → tan(x+pi/6)
  // When a function with an implicit arg is the left operand of + or -,
  // the user may have meant the whole additive expression as the argument.
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'func-additive',
    match(node) {
      if (node.type !== 'binary') return false;
      if (node.op !== '+' && node.op !== '-') return false;
      // Left side must contain a function with implicit arg
      return containsImplicitFunc(node.left);
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [];

      // Interpretation A: original — func(arg) + rest
      results.push(node);

      // Interpretation B: absorb right side into function arg — func(arg + rest)
      const rewritten = absorbAdditiveIntoFunc(node.left, node.op, node.right);
      if (rewritten) {
        results.push(rewritten);
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 13: Trig modifier scope — sin²x vs sin(x²)
  // sin²x (modifier on function) parsed as ^2 ambiguity
  // Interpretations: sin²(x), sin(x²), sin(2x), sin(x)²
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'trig-modifier-scope',
    match(node) {
      if (node.type !== 'function') return false;
      const trigFuncs = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'cosec', 'sinh', 'cosh', 'tanh'];
      if (!trigFuncs.includes(node.name)) return false;
      if (node.args.length !== 1) return false;
      if (!node.modifier) return false;
      // Modifier should be numeric (2, 3, etc.) to be meaningful
      if (node.modifier.type !== 'number') return false;
      return /^[2-9]$/.test(node.modifier.value);
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [];
      const arg = node.args[0];
      const mod = node.modifier.value; // e.g., '2'

      // Interpretation A: Original — sin²(x) modifier applies to function output
      results.push(node);

      // Interpretation B: Modifier on argument — sin(x²) modifier applies to input
      if (arg.type === 'variable' || arg.type === 'number' || arg.type === 'constant') {
        const modifiedArg = ASTNode.power(arg, ASTNode.number(mod));
        results.push(ASTNode.func(node.name, [modifiedArg], null, true));
      }

      // Interpretation C: Modifier means coefficient — sin(2x) when modifier=2
      if (mod === '2') {
        const coeffArg = ASTNode.implicitMul([ASTNode.number('2'), arg]);
        results.push(ASTNode.func(node.name, [coeffArg], null, true));
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 14: Coefficient + power + function — 2sin²(x)
  // Parses as implicit_mul(2, sin(with modifier 2), x) or similar
  // Interpretations: 2sin²(x), 2sin(x²), (2sin(x))², 2·sin(x)·x
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'coefficient-power-function',
    match(node) {
      if (node.type !== 'implicit_multiply' || node.factors.length < 2) return false;
      // First factor should be a small number
      const first = node.factors[0];
      if (first.type !== 'number' || !/^[2-9]$/.test(first.value)) return false;
      // Must contain a trig function with a modifier
      const trigFuncs = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'cosec', 'sinh', 'cosh', 'tanh'];
      return node.factors.some(f => 
        f.type === 'function' && 
        trigFuncs.includes(f.name) && 
        f.modifier !== null && 
        f.args.length > 0
      );
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [];
      const coeff = node.factors[0]; // the number like 2, 3, etc.

      // Find the function with modifier
      const funcIdx = node.factors.findIndex(f =>
        f.type === 'function' && f.modifier !== null
      );
      
      if (funcIdx === -1) return deduplicateASTs([node]);

      const func = node.factors[funcIdx];
      const arg = func.args[0];
      const mod = func.modifier;

      // Interpretation A: Original — 2sin²(x)
      results.push(node);

      // Interpretation B: Modifier applies to input — 2sin(x²)
      if (arg.type === 'variable' || arg.type === 'number' || arg.type === 'constant') {
        const modifiedArg = ASTNode.power(arg, mod);
        const newFunc = ASTNode.func(func.name, [modifiedArg], null, true);
        const before = node.factors.slice(0, funcIdx);
        const after = node.factors.slice(funcIdx + 1);
        const allParts = [...before, newFunc, ...after];
        if (allParts.length === 1) {
          results.push(allParts[0]);
        } else {
          results.push(ASTNode.implicitMul(allParts));
        }
      }

      // Interpretation C: Whole expression squared — (2sin(x))²
      const funcNoMod = ASTNode.func(func.name, [arg], null, true);
      const before = node.factors.slice(0, funcIdx);
      const after = node.factors.slice(funcIdx + 1);
      const baseExpr = [...before, funcNoMod, ...after];
      const expr = baseExpr.length === 1 ? baseExpr[0] : ASTNode.implicitMul(baseExpr);
      results.push(ASTNode.power(expr, mod));

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 15: Trig identity composition — sin²+cos²→1; sin/cos→tan
  // Detects patterns that match common trig identities
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'trig-identity-composition',
    match(node) {
      if (node.type !== 'binary') return false;
      if (node.op === '+') {
        // sin²(x) + cos²(x) → identity suggestion
        const { astToLatex } = getParser();
        if (node.left.type === 'power' && node.right.type === 'power') {
          const leftBase = node.left.base;
          const rightBase = node.right.base;
          if (leftBase.type === 'function' && rightBase.type === 'function') {
            const leftName = leftBase.name;
            const rightName = rightBase.name;
            if ((leftName === 'sin' && rightName === 'cos') || 
                (leftName === 'cos' && rightName === 'sin')) {
              // Check if both are squared and have same arg
              if (node.left.exponent.type === 'number' && /^2$/.test(node.left.exponent.value) &&
                  node.right.exponent.type === 'number' && /^2$/.test(node.right.exponent.value)) {
                const leftArg = astToLatex(leftBase.args[0]);
                const rightArg = astToLatex(rightBase.args[0]);
                if (leftArg === rightArg) return true;
              }
            }
          }
        }
      } else if (node.op === '/') {
        // sin(x) / cos(x) → tan identity
        const { astToLatex } = getParser();
        if (node.left.type === 'function' && node.right.type === 'function') {
          if (node.left.name === 'sin' && node.right.name === 'cos') {
            const leftArg = astToLatex(node.left.args[0]);
            const rightArg = astToLatex(node.right.args[0]);
            if (leftArg === rightArg) return true;
          }
        }
      }
      return false;
    },
    expand(node) {
      const { ASTNode, astToLatex } = getParser();
      const results = [];

      // Original interpretation
      results.push(node);

      if (node.op === '+') {
        // sin²(x) + cos²(x) → 1
        const leftBase = node.left.base;
        const rightBase = node.right.base;
        if (leftBase.type === 'function' && rightBase.type === 'function') {
          if ((leftBase.name === 'sin' && rightBase.name === 'cos') || 
              (leftBase.name === 'cos' && rightBase.name === 'sin')) {
            const rightArg = rightBase.args[0];
            // sin(x) + cos(x) → 1 when both squared
            if (node.left.exponent && node.right.exponent &&
                node.left.exponent.type === 'number' && /^2$/.test(node.left.exponent.value) &&
                node.right.exponent.type === 'number' && /^2$/.test(node.right.exponent.value)) {
              results.push(ASTNode.number('1'));
            }
          }
        }
      } else if (node.op === '/') {
        // sin(x) / cos(x) → tan(x)
        if (node.left.name === 'sin' && node.right.name === 'cos') {
          const arg = node.left.args[0];
          results.push(ASTNode.func('tan', [arg], null, true));
        }
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 16: Nested trig function with division — sin(x/2) vs sin(x)/2
  // When trig function's arg is a division that might be ambiguous
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'nested-trig-fraction',
    match(node) {
      if (node.type !== 'function') return false;
      const trigFuncs = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'cosec', 'sinh', 'cosh', 'tanh'];
      if (!trigFuncs.includes(node.name)) return false;
      if (node.args.length !== 1) return false;
      const arg = node.args[0];
      // Argument should be a division (binary with /)
      if (arg.type !== 'binary' || arg.op !== '/') return false;
      return true;
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [];
      const arg = node.args[0]; // the fraction

      // Interpretation A: Original — sin(x/2)
      results.push(node);

      // Interpretation B: Function output divided — sin(x) / 2
      const simpleFunc = ASTNode.func(node.name, [arg.left], null, true);
      results.push(ASTNode.binary('/', simpleFunc, arg.right));

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 17: Trig with shifted argument — tan(x+π/6) parsing ambiguity
  // When a trig function has an implicit arg that's an additive expression
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'trig-shifted-argument',
    match(node) {
      if (node.type !== 'function') return false;
      const trigFuncs = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'cosec', 'sinh', 'cosh', 'tanh'];
      if (!trigFuncs.includes(node.name)) return false;
      if (node.args.length === 0) return false;
      // Check if arg contains an additive sub-expression that might be ambiguous
      const arg = node.args[0];
      if (arg.type === 'binary' && (arg.op === '+' || arg.op === '-')) {
        return true; // Could be parsed as func(arg1) + arg2 or func(arg1+arg2)
      }
      return false;
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [];
      const arg = node.args[0];

      // Interpretation A: Original — tan(x+π/6) full arg is in function
      results.push(node);

      if (arg.type === 'binary' && (arg.op === '+' || arg.op === '-')) {
        // Interpretation B: Only left side is argument — tan(x) + π/6
        const baseFunc = ASTNode.func(node.name, [arg.left], null, true);
        results.push(ASTNode.binary(arg.op, baseFunc, arg.right));
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 18: Missing multiplication operator — cos(x)2x
  // When a function call is immediately followed by other implicit factors
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'missing-multiplication-operator',
    match(node) {
      if (node.type !== 'implicit_multiply' || node.factors.length < 2) return false;
      // Find a function with explicit parens followed by number/variable
      let hasFunc = false;
      for (let i = 0; i < node.factors.length - 1; i++) {
        const f = node.factors[i];
        const next = node.factors[i + 1];
        if (f.type === 'function' && f.hasExplicitParens &&
            (next.type === 'number' || next.type === 'variable' || next.type === 'constant')) {
          hasFunc = true;
          break;
        }
      }
      return hasFunc;
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [];

      // Interpretation A: Original — cos(x)·2·x (implicit multiply)
      results.push(node);

      // Interpretation B: First function absorbs following factors
      for (let i = 0; i < node.factors.length - 1; i++) {
        const f = node.factors[i];
        const next = node.factors[i + 1];
        if (f.type === 'function' && f.hasExplicitParens &&
            (next.type === 'number' || next.type === 'variable' || next.type === 'constant')) {
          // Try absorbing next into function arg
          const before = node.factors.slice(0, i);
          const first = f.args[0];
          const absorbed = ASTNode.implicitMul([first, next]);
          const newFunc = ASTNode.func(f.name, [absorbed], f.modifier, true);
          const after = node.factors.slice(i + 2);
          const allParts = [...before, newFunc, ...after];
          if (allParts.length === 1) {
            results.push(allParts[0]);
          } else {
            results.push(ASTNode.implicitMul(allParts));
          }
          break; // Only offer first ambiguous function
        }
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 18b: Compact trig + trailing number — sinx2 ↔ sin(x^2)
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'compact-trig-trailing-power',
    match(node) {
      if (node.type !== 'implicit_multiply' || node.factors.length !== 2) return false;
      const [first, second] = node.factors;
      return first.type === 'function' && first.args.length === 1 && second.type === 'number' && /^[0-9]+$/.test(second.value);
    },
    expand(node) {
      const { ASTNode } = getParser();
      const [fn, trailing] = node.factors;
      const results = [node];
      const baseArg = fn.args[0];
      const poweredArg = ASTNode.power(baseArg, trailing);
      results.push(ASTNode.func(fn.name, [poweredArg], fn.modifier, true));
      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 19: Letter 'o' after number → degree symbol
  // "30o" parses as implicit_mul(30, o)
  // Alternative: 30° (degree notation)
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'o-to-degree',
    match(node) {
      if (node.type !== 'implicit_multiply' || node.factors.length < 2) return false;
      // First factor should be a number, second factor should be the variable 'o'
      const first = node.factors[0];
      const second = node.factors[1];
      return first.type === 'number' && second.type === 'variable' && second.name === 'o';
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [];

      // Interpretation A: Original — 30 * o (implicit multiply)
      results.push(node);

      // Interpretation B: 'o' is degree symbol — 30°
      const numberValue = node.factors[0];
      const degreeAST = ASTNode.degree(numberValue);
      
      // If there are more factors after 'o' (e.g., "30oC"), keep them
      if (node.factors.length > 2) {
        const afterO = node.factors.slice(2);
        results.push(ASTNode.implicitMul([degreeAST, ...afterO]));
      } else {
        results.push(degreeAST);
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 20: Decimal number → fraction equivalents
  // 0.5 → 1/2, 0.25 → 1/4, 0.333 → 1/3, 0.75 → 3/4, etc.
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'decimal-to-fraction',
    match(node) {
      if (node.type !== 'number') return false;
      // Check if the number contains a decimal point
      return String(node.value).includes('.');
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [];

      // Keep the original decimal form
      results.push(node);

      // Convert decimal to fraction
      const decimalStr = String(node.value);
      const decimalParts = decimalStr.split('.');
      
      if (decimalParts.length === 2) {
        const integerPart = parseInt(decimalParts[0]) || 0;
        const decimalPart = decimalParts[1];
        const decimalLength = decimalPart.length;

        // Convert to fraction: 0.5 → 5/10 → 1/2
        let numerator = parseInt(decimalStr.replace('.', '')) || 0;
        let denominator = Math.pow(10, decimalLength);

        // Simplify fraction using GCD
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        const divisor = gcd(Math.abs(numerator), denominator);
        numerator = numerator / divisor;
        denominator = denominator / divisor;

        // Create fraction AST (numerator / denominator)
        if (numerator !== 0) {
          const fracAST = ASTNode.frac(ASTNode.number(String(numerator)), ASTNode.number(String(denominator)));
          results.push(fracAST);
        }

        // Also suggest common approximate fractions for repeating decimals
        const commonMap = {
          '3': { num: 1, den: 3 },     // 0.333... → 1/3
          '6': { num: 2, den: 3 },     // 0.666... → 2/3
          '1': { num: 1, den: 9 },     // 0.111... → 1/9
          '9': { num: 1, den: 11 },    // 0.0909... → 1/11
          '142857': { num: 1, den: 7 }, // 0.142857... → 1/7
        };

        for (const [pattern, frac] of Object.entries(commonMap)) {
          if (decimalPart.startsWith(pattern) && numerator === 0) {
            const approxFrac = ASTNode.frac(ASTNode.number(String(frac.num)), ASTNode.number(String(frac.den)));
            results.push(approxFrac);
          }
        }
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 21: Unary minus with power — -x^2
  // "-x^2" parses as -(x^2) but may mean (-x)^2
  // Alternatives: -(x^2), (-x)^2
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'unary-minus-power',
    match(node) {
      if (node.type !== 'unary') return false;
      if (node.op !== '-') return false;
      if (!node.operand) return false;
      return node.operand.type === 'power';
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [];

      // Interpretation A: original — -(x^n)
      results.push(node);

      // Interpretation B: (-x)^n
      const powerNode = node.operand;
      const negBase = ASTNode.unary('-', powerNode.base);
      const groupedNegBase = ASTNode.group(negBase);
      results.push(ASTNode.power(groupedNegBase, powerNode.exponent));

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 22: nCr pattern — implicit_mul containing variable "C" between operands
  // "5C3" parses as implicit_mul(5, C, 3).
  // Alternatives: ⁵C₃ (combination), \binom{5}{3}
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'nCr-pattern',
    match(node) {
      if (node.type !== 'implicit_multiply') return false;
      const factors = node.factors;
      if (factors.length < 3) return false;
      for (let i = 1; i < factors.length - 1; i++) {
        if (factors[i].type === 'variable' &&
            (factors[i].name === 'C' || factors[i].name === 'c')) {
          const prev = factors[i - 1];
          const next = factors[i + 1];
          if ((prev.type === 'number' || prev.type === 'variable') &&
              (next.type === 'number' || next.type === 'variable')) {
            return true;
          }
        }
      }
      return false;
    },
    expand(node) {
      const { ASTNode } = getParser();
      const factors = node.factors;
      const results = [];

      // Original: n * C * r
      results.push(node);

      for (let i = 1; i < factors.length - 1; i++) {
        if (factors[i].type === 'variable' &&
            (factors[i].name === 'C' || factors[i].name === 'c')) {
          const n = factors[i - 1];
          const r = factors[i + 1];
          if ((n.type === 'number' || n.type === 'variable') &&
              (r.type === 'number' || r.type === 'variable')) {
            const before = factors.slice(0, i - 1);
            const after = factors.slice(i + 2);

            // Interpretation: binomial coefficient \binom{n}{r}
            const binomNode = ASTNode.func('binom', [n, r], null, true);
            const allParts = [...before, binomNode, ...after];
            results.push(allParts.length === 1 ? allParts[0] : ASTNode.implicitMul(allParts));

            // Interpretation: ^nC_r notation
            const ncrNode = ASTNode.func('nCr', [n, r], null, true);
            const allParts2 = [...before, ncrNode, ...after];
            results.push(allParts2.length === 1 ? allParts2[0] : ASTNode.implicitMul(allParts2));
            break;
          }
        }
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 23: nPr pattern — implicit_mul containing variable "P" between operands
  // "5P3" parses as implicit_mul(5, P, 3).
  // Alternatives: ⁵P₃ (permutation)
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'nPr-pattern',
    match(node) {
      if (node.type !== 'implicit_multiply') return false;
      const factors = node.factors;
      if (factors.length < 3) return false;
      for (let i = 1; i < factors.length - 1; i++) {
        if (factors[i].type === 'variable' &&
            (factors[i].name === 'P' || factors[i].name === 'p')) {
          const prev = factors[i - 1];
          const next = factors[i + 1];
          if ((prev.type === 'number' || prev.type === 'variable') &&
              (next.type === 'number' || next.type === 'variable')) {
            return true;
          }
        }
      }
      return false;
    },
    expand(node) {
      const { ASTNode } = getParser();
      const factors = node.factors;
      const results = [];

      results.push(node);

      for (let i = 1; i < factors.length - 1; i++) {
        if (factors[i].type === 'variable' &&
            (factors[i].name === 'P' || factors[i].name === 'p')) {
          const n = factors[i - 1];
          const r = factors[i + 1];
          if ((n.type === 'number' || n.type === 'variable') &&
              (r.type === 'number' || r.type === 'variable')) {
            const before = factors.slice(0, i - 1);
            const after = factors.slice(i + 2);

            // Interpretation: ^nP_r notation
            const nprNode = ASTNode.func('nPr', [n, r], null, true);
            const allParts = [...before, nprNode, ...after];
            results.push(allParts.length === 1 ? allParts[0] : ASTNode.implicitMul(allParts));
            break;
          }
        }
      }

      return deduplicateASTs(results);
    }
  });

  // --------------------------------------------------------------------------
  // Rule 24: Plus-minus ambiguity — x ± y
  // When ± appears, offer both x + y and x - y as alternatives
  // --------------------------------------------------------------------------
  ambiguityRules.push({
    name: 'plus-minus-split',
    match(node) {
      if (node.type !== 'implicit_multiply') return false;
      return node.factors.some(f =>
        f.type === 'constant' && (f.name === 'pm' || f.name === 'mp')
      );
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [node]; // original with ±

      const factors = node.factors;
      for (let i = 0; i < factors.length; i++) {
        if (factors[i].type === 'constant' && (factors[i].name === 'pm' || factors[i].name === 'mp')) {
          const before = factors.slice(0, i);
          const after = factors.slice(i + 1);

          // Build left side and right side
          const leftPart = before.length === 0 ? null :
                           before.length === 1 ? before[0] : ASTNode.implicitMul(before);
          const rightPart = after.length === 0 ? null :
                            after.length === 1 ? after[0] : ASTNode.implicitMul(after);

          if (leftPart && rightPart) {
            results.push(ASTNode.binary('+', leftPart, rightPart));
            results.push(ASTNode.binary('-', leftPart, rightPart));
          }
          break;
        }
      }

      return deduplicateASTs(results);
    }
  });

  // ==========================================================================
  // COMPLETION RULES — suggest common expansions when no structural ambiguity
  // ==========================================================================
  // These fire when the input is unambiguous (single interpretation) to offer
  // likely completions. Pattern-based, so they scale for any input.

  const completionRules = [];

  // --------------------------------------------------------------------------
  // Completion 1: Variable → common powers & sqrt
  // x → x², x³, √x
  // --------------------------------------------------------------------------
  completionRules.push({
    name: 'variable-completions',
    match(node) {
      return node.type === 'variable';
    },
    expand(node) {
      const { ASTNode } = getParser();
      return [
        ASTNode.power(node, ASTNode.number('2')),         // x²
        ASTNode.power(node, ASTNode.number('3')),         // x³
        ASTNode.sqrt(node),                                // √x
      ];
    }
  });

  // --------------------------------------------------------------------------
  // Completion 2: Number → common operations
  // 2 → 2², 2³, √2, 2!
  // --------------------------------------------------------------------------
  completionRules.push({
    name: 'number-completions',
    match(node) {
      return node.type === 'number' && parseInt(node.value) >= 2;
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [
        ASTNode.power(node, ASTNode.number('2')),         // n²
        ASTNode.power(node, ASTNode.number('3')),         // n³
        ASTNode.sqrt(node),                                // √n
      ];
      if (parseInt(node.value) <= 20) {
        results.push(ASTNode.factorial(node));             // n!
      }
      return results;
    }
  });

  // --------------------------------------------------------------------------
  // Completion 3: Simple 2-term product → powers
  // 2x → (2x)², (2x)³  (only for short algebraic products, not complex exprs)
  // --------------------------------------------------------------------------
  completionRules.push({
    name: 'expression-completions',
    match(node) {
      // Match simple implicit multiply of numbers/variables (2–4 factors)
      // e.g. 2x, xy, 10x2 — NOT sinxcosx, triangleABC, or very long expressions
      if (node.type === 'implicit_multiply') {
        if (node.factors.length < 2 || node.factors.length > 4) return false;
        return node.factors.every(f =>
          f.type === 'number' || f.type === 'variable'
        );
      }
      return false;
    },
    expand(node) {
      const { ASTNode } = getParser();
      const grouped = ASTNode.group(node);
      return [
        ASTNode.power(grouped, ASTNode.number('2')),      // (expr)²
        ASTNode.power(grouped, ASTNode.number('3')),      // (expr)³
        ASTNode.sqrt(node),                                // √(expr)
      ];
    }
  });

  // --------------------------------------------------------------------------
  // Completion 4: x^2 → related powers
  // x² → x³, √x, x^{-1}
  // --------------------------------------------------------------------------
  completionRules.push({
    name: 'power-completions',
    match(node) {
      return node.type === 'power'
        && node.exponent.type === 'number'
        && /^[2-9]$/.test(node.exponent.value);
    },
    expand(node) {
      const { ASTNode } = getParser();
      const exp = parseInt(node.exponent.value);
      const results = [];
      if (exp === 2) {
        results.push(ASTNode.power(node.base, ASTNode.number('3')));
        results.push(ASTNode.sqrt(node.base));
        results.push(ASTNode.power(node.base, ASTNode.unary('-', ASTNode.number('1'))));
      } else if (exp === 3) {
        results.push(ASTNode.power(node.base, ASTNode.number('2')));
        results.push(ASTNode.sqrt(node.base, ASTNode.number(String(exp))));
      }
      return results;
    }
  });

  // --------------------------------------------------------------------------
  // Completion 4b: Inverse trig functions → powered form
  // arcsin(x) → sin⁻¹(x), arccos(x) → cos⁻¹(x), arctan(x) → tan⁻¹(x)
  // --------------------------------------------------------------------------
  completionRules.push({
    name: 'inverse-trig-completions',
    match(node) {
      if (node.type !== 'function') return false;
      const invTrigFuncs = ['arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan'];
      return invTrigFuncs.includes(node.name) && node.args.length > 0;
    },
    expand(node) {
      const { ASTNode } = getParser();
      // Convert arcsin(x) → sin^-1(x), arccos(x) → cos^-1(x), arctan(x) → tan^-1(x)
      const baseName = node.name.replace(/^a(rc)?/, ''); // arcsin→sin, asin→sin, etc.
      const poweredForm = ASTNode.func(
        baseName,
        node.args,
        ASTNode.unary('-', ASTNode.number('1')),
        true
      );
      return [poweredForm];
    }
  });

  // --------------------------------------------------------------------------
  // Completion 5: Lone function name → function with common arguments
  // sin → sin(x), sin(θ), sin(30°)
  // log → log(x), log₁₀(x), ln(x)
  // --------------------------------------------------------------------------
  completionRules.push({
    name: 'lone-function-completions',
    match(node) {
      return node.type === 'function' && node.args.length === 0 && !node.modifier;
    },
    expand(node) {
      const { ASTNode } = getParser();
      const name = node.name;
      const xVar = ASTNode.variable('x');
      const results = [];

      const trigFuncs = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'cosec'];
      const hypFuncs = ['sinh', 'cosh', 'tanh'];
      const invTrigFuncs = ['arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan'];

      if (trigFuncs.includes(name)) {
        results.push(ASTNode.func(name, [xVar], null, true));                         // sin(x)
        results.push(ASTNode.func(name, [ASTNode.constant('theta', '\\theta')], null, true)); // sin(θ)
        results.push(ASTNode.func(name, [ASTNode.degree(ASTNode.number('30'))], null, true));  // sin(30°)
      } else if (invTrigFuncs.includes(name)) {
        const baseName = name.replace(/^a(rc)?/, '');
        results.push(ASTNode.func(baseName, [xVar], ASTNode.unary('-', ASTNode.number('1')), true)); // sin⁻¹(x)
      } else if (hypFuncs.includes(name)) {
        results.push(ASTNode.func(name, [xVar], null, true));
      } else if (name === 'log') {
        results.push(ASTNode.func('log', [xVar], null, true));                        // log(x)
        results.push(ASTNode.subscript(ASTNode.func('log', [xVar], null, true), ASTNode.number('10'))); // log₁₀(x)
        results.push(ASTNode.func('ln', [xVar], null, true));                         // ln(x)
      } else if (name === 'ln') {
        results.push(ASTNode.func('ln', [xVar], null, true));
        results.push(ASTNode.func('ln', [ASTNode.constant('e', 'e')], null, true));   // actually 'e' is not a constant in our system, use variable
      } else if (name === 'sqrt') {
        results.push(ASTNode.sqrt(xVar));
      } else {
        results.push(ASTNode.func(name, [xVar], null, true));
      }

      return results;
    }
  });

  // --------------------------------------------------------------------------
  // Completion 6: Trig function with argument → powers & inverse
  // sin(x) → sin²(x), sin⁻¹(x)
  // cos(x) → cos²(x), cos⁻¹(x)
  // --------------------------------------------------------------------------
  completionRules.push({
    name: 'trig-function-completions',
    match(node) {
      if (node.type !== 'function') return false;
      if (node.args.length === 0 || node.modifier) return false;
      const trigFuncs = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'cosec'];
      return trigFuncs.includes(node.name);
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [];
      const arg = node.args[0];

      // sin²(x)
      results.push(ASTNode.func(node.name, [arg], ASTNode.number('2'), true));

      // sin⁻¹(x) — inverse trig
      results.push(ASTNode.func(node.name, [arg], ASTNode.unary('-', ASTNode.number('1')), true));

      // sin³(x) — cubic (less common but useful)
      results.push(ASTNode.func(node.name, [arg], ASTNode.number('3'), true));

      return results;
    }
  });

  // --------------------------------------------------------------------------
  // Completion 7: Set notation — suggest related set operations
  // A ∪ B → A ∩ B, A ⊂ B, A \ B
  // --------------------------------------------------------------------------
  completionRules.push({
    name: 'set-operation-completions',
    match(node) {
      if (node.type !== 'implicit_multiply') return false;
      // Check if any factor is a set operation symbol
      const setOps = ['\\cup', '\\cap', '\\subset', '\\supset', '\\subseteq',
                       '\\supseteq', '\\in', '\\setminus'];
      return node.factors.some(f =>
        f.type === 'constant' && setOps.includes(f.latex)
      );
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [];
      const factors = node.factors;

      // Find the set op and the operands around it
      for (let i = 0; i < factors.length; i++) {
        if (factors[i].type !== 'constant') continue;
        const opLatex = factors[i].latex;
        if (opLatex === '\\cup' || opLatex === '\\cap') {
          const before = factors.slice(0, i);
          const after = factors.slice(i + 1);
          // Offer the complementary operation
          const altOp = opLatex === '\\cup' ? 'cap' : 'cup';
          const altLatex = opLatex === '\\cup' ? '\\cap' : '\\cup';
          const altConst = ASTNode.constant(altOp, altLatex);
          results.push(ASTNode.implicitMul([...before, altConst, ...after]));
        }
      }

      return results;
    }
  });

  // --------------------------------------------------------------------------
  // Completion 8: Vector notation — variable → vec, bar, hat
  // a → \vec{a}, \hat{a}, \bar{a}
  // --------------------------------------------------------------------------
  completionRules.push({
    name: 'vector-completions',
    match(node) {
      return node.type === 'variable' && /^[a-zA-Z]$/.test(node.name);
    },
    expand(node) {
      const { ASTNode } = getParser();
      return [
        ASTNode.func('vec', [node], null, true),        // \vec{a}
        ASTNode.func('hat', [node], null, true),        // \hat{a}
        ASTNode.func('bar', [node], null, true),        // \bar{a}
      ];
    }
  });

  // --------------------------------------------------------------------------
  // Completion 9: Derivative notation
  // f → f'(x), f''(x)
  // --------------------------------------------------------------------------
  completionRules.push({
    name: 'derivative-completions',
    match(node) {
      // Match single-letter variables commonly used for functions: f, g, h, y
      return node.type === 'variable' && /^[fghy]$/.test(node.name);
    },
    expand(node) {
      const { ASTNode } = getParser();
      const xVar = ASTNode.variable('x');
      const results = [];

      // f(x)
      results.push(ASTNode.func(node.name, [xVar], null, true));

      // f'(x) — first derivative (represented as variable "f'" implicitly multiplied with (x))
      const fPrime = ASTNode.variable(node.name + "'");
      results.push(ASTNode.implicitMul([fPrime, ASTNode.group(xVar)]));

      return results;
    }
  });

  // --------------------------------------------------------------------------
  // Completion 10: Quadratic formula components
  // ax^2+bx+c → suggest discriminant b²-4ac
  // --------------------------------------------------------------------------
  completionRules.push({
    name: 'quadratic-completions',
    match(node) {
      // Match pattern: something + something + something (3-term sum)
      if (node.type !== 'binary' || node.op !== '+') return false;
      if (node.left.type !== 'binary' || node.left.op !== '+') return false;
      // Check if first term contains x²
      const firstTerm = node.left.left;
      return firstTerm.type === 'power' ||
             (firstTerm.type === 'implicit_multiply' &&
              firstTerm.factors.some(f => f.type === 'power'));
    },
    expand(node) {
      const { ASTNode } = getParser();
      const results = [];

      // Suggest discriminant: b² - 4ac
      const b = ASTNode.variable('b');
      const a = ASTNode.variable('a');
      const c = ASTNode.variable('c');
      const disc = ASTNode.binary('-',
        ASTNode.power(b, ASTNode.number('2')),
        ASTNode.implicitMul([ASTNode.number('4'), a, c])
      );
      results.push(disc);

      return results;
    }
  });

  // ==========================================================================
  // MAIN: GENERATE SUGGESTIONS FROM INPUT
  // ==========================================================================

  /**
   * Parse input and generate all alternative LaTeX interpretations.
   * @param {string} input — raw math text from student
   * @param {number} maxSuggestions — max suggestions to return (default 5)
   * @returns {string[]} — array of LaTeX strings (deduplicated)
   */
  function generateSuggestions(input, maxSuggestions) {
    maxSuggestions = maxSuggestions || 5;
    const parser = getParser();
    if (!parser.parseMath) {
      console.warn('[ambiguity-resolver] grammar-parser not loaded');
      return [];
    }

    const { ast, error } = parser.parseMath(input);
    if (error || !ast) return [];

    // Step 1: Render the default parse
    const defaultLatex = parser.astToLatex(ast);

    // Step 2: Collect all alternative ASTs by applying ambiguity rules
    const alternatives = [ast];
    collectAlternatives(ast, alternatives);

    // Step 2b: Apply completion rules on the root parse as well.
    // This keeps intent completions (e.g., arccos -> cos^{-1}) available
    // even when other ambiguity rules also generate alternatives.
    for (const rule of completionRules) {
      if (rule.match(ast)) {
        const completions = rule.expand(ast);
        for (const c of completions) {
          if (c && c !== ast) alternatives.push(c);
        }
        break; // keep completion signal focused
      }
    }

    // Step 3: Render all alternatives to LaTeX and deduplicate
    const seen = new Set();
    const suggestions = [];

    for (const altAST of alternatives) {
      const latex = parser.astToLatex(altAST);
      const normalized = normalizeLatexForComparison(latex);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      suggestions.push(latex);
    }

    // Ensure default parse is first
    const defaultNorm = normalizeLatexForComparison(defaultLatex);
    const orderedSuggestions = suggestions.filter(
      s => normalizeLatexForComparison(s) !== defaultNorm
    );
    orderedSuggestions.unshift(defaultLatex);

    return orderedSuggestions.slice(0, maxSuggestions);
  }

  /**
   * Recursively apply ambiguity rules to the AST and all sub-nodes.
   * Adds alternative full-tree ASTs to the `alternatives` array.
   */
  function collectAlternatives(ast, alternatives) {
    // Apply rules at the current node
    for (const rule of ambiguityRules) {
      if (rule.match(ast)) {
        const expanded = rule.expand(ast);
        for (const alt of expanded) {
          if (alt !== ast) {
            alternatives.push(alt);
            // Recursively check alternatives for further ambiguities (1 level deep)
            for (const subRule of ambiguityRules) {
              if (subRule.match(alt)) {
                const subExpanded = subRule.expand(alt);
                for (const subAlt of subExpanded) {
                  if (subAlt !== alt) alternatives.push(subAlt);
                }
              }
            }
          }
        }
      }
    }

    // Recurse into child nodes to find ambiguities deeper in the tree
    const children = getChildNodes(ast);
    for (const { key, child } of children) {
      for (const rule of ambiguityRules) {
        if (rule.match(child)) {
          const expanded = rule.expand(child);
          for (const alt of expanded) {
            if (alt !== child) {
              // Create a copy of the parent AST with this child replaced
              const newAST = replaceChild(ast, key, alt);
              alternatives.push(newAST);
            }
          }
        }
      }
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /** Get direct child nodes with their key paths */
  function getChildNodes(node) {
    if (!node || typeof node !== 'object') return [];
    const children = [];

    switch (node.type) {
      case 'binary':
        children.push({ key: 'left', child: node.left });
        children.push({ key: 'right', child: node.right });
        break;
      case 'unary':
        children.push({ key: 'operand', child: node.operand });
        break;
      case 'function':
        node.args.forEach((arg, i) => {
          children.push({ key: `args.${i}`, child: arg });
        });
        break;
      case 'power':
        children.push({ key: 'base', child: node.base });
        children.push({ key: 'exponent', child: node.exponent });
        break;
      case 'degree':
      case 'factorial':
        children.push({ key: 'expr', child: node.expr });
        break;
      case 'abs':
        children.push({ key: 'expr', child: node.expr });
        break;
      case 'frac':
        children.push({ key: 'numerator', child: node.numerator });
        children.push({ key: 'denominator', child: node.denominator });
        break;
      case 'sqrt':
        children.push({ key: 'radicand', child: node.radicand });
        if (node.index) children.push({ key: 'index', child: node.index });
        break;
      case 'subscript':
        children.push({ key: 'base', child: node.base });
        children.push({ key: 'sub', child: node.sub });
        break;
      case 'group':
        children.push({ key: 'expr', child: node.expr });
        break;
      case 'implicit_multiply':
        node.factors.forEach((f, i) => {
          children.push({ key: `factors.${i}`, child: f });
        });
        break;
    }

    return children;
  }

  /** Create a shallow copy of the AST with one child replaced */
  function replaceChild(node, key, newChild) {
    const copy = { ...node };

    if (key.startsWith('args.')) {
      const idx = parseInt(key.split('.')[1], 10);
      copy.args = [...node.args];
      copy.args[idx] = newChild;
    } else if (key.startsWith('factors.')) {
      const idx = parseInt(key.split('.')[1], 10);
      copy.factors = [...node.factors];
      copy.factors[idx] = newChild;
    } else {
      copy[key] = newChild;
    }

    return copy;
  }

  /** Check if a node or its descendants contain an implicit function call */
  function containsImplicitFunc(node) {
    if (!node) return false;
    if (node.type === 'function' && !node.hasExplicitParens) return true;
    if (node.type === 'implicit_multiply') {
      return node.factors.some(containsImplicitFunc);
    }
    return false;
  }

  /** Rewrite frac(func(arg), denom) → func(frac(arg, denom)) */
  function absorbDenomIntoFunc(numerator, denominator) {
    const { ASTNode } = getParser();
    if (!ASTNode) return null;

    if (numerator.type === 'function' && !numerator.hasExplicitParens && numerator.args.length > 0) {
      const arg = numerator.args[0];
      const newArg = ASTNode.binary('/', arg, denominator);
      return ASTNode.func(numerator.name, [newArg], numerator.modifier, true);
    }

    if (numerator.type === 'implicit_multiply') {
      // Find the function in the factors
      const funcIdx = numerator.factors.findIndex(f => f.type === 'function' && !f.hasExplicitParens);
      if (funcIdx === -1) return null;

      const func = numerator.factors[funcIdx];
      if (func.args.length === 0) return null;

      // Collect everything after the function as part of the argument
      const afterFunc = numerator.factors.slice(funcIdx + 1);
      const beforeFunc = numerator.factors.slice(0, funcIdx);

      let fullArg;
      if (afterFunc.length > 0) {
        fullArg = ASTNode.implicitMul([func.args[0], ...afterFunc]);
      } else {
        fullArg = func.args[0];
      }

      const newArg = ASTNode.binary('/', fullArg, denominator);
      const newFunc = ASTNode.func(func.name, [newArg], func.modifier, true);

      if (beforeFunc.length === 0) return newFunc;
      return ASTNode.implicitMul([...beforeFunc, newFunc]);
    }

    return null;
  }

  /** Rewrite func(arg) +/- rest → func(arg +/- rest) */
  function absorbAdditiveIntoFunc(left, op, right) {
    const { ASTNode } = getParser();
    if (!ASTNode) return null;

    // Direct function: tan(x) + rest → tan(x + rest)
    if (left.type === 'function' && !left.hasExplicitParens && left.args.length > 0) {
      const arg = left.args[0];
      const newArg = ASTNode.binary(op, arg, right);
      return ASTNode.func(left.name, [newArg], left.modifier, true);
    }

    // Implicit multiply with function: 2sin(x) + rest → 2sin(x + rest)
    if (left.type === 'implicit_multiply') {
      const funcIdx = left.factors.findIndex(f => f.type === 'function' && !f.hasExplicitParens);
      if (funcIdx === -1) return null;

      const func = left.factors[funcIdx];
      if (func.args.length === 0) return null;

      // Only absorb if the function is the last factor (e.g., 2sin(x) + pi)
      // If there are factors after the function, the additive applies to the whole product
      const afterFunc = left.factors.slice(funcIdx + 1);
      const beforeFunc = left.factors.slice(0, funcIdx);

      let fullArg;
      if (afterFunc.length > 0) {
        fullArg = ASTNode.implicitMul([func.args[0], ...afterFunc]);
      } else {
        fullArg = func.args[0];
      }

      const newArg = ASTNode.binary(op, fullArg, right);
      const newFunc = ASTNode.func(func.name, [newArg], func.modifier, true);

      if (beforeFunc.length === 0) return newFunc;
      return ASTNode.implicitMul([...beforeFunc, newFunc]);
    }

    return null;
  }

  /** Check if a number could be an angle in degrees (10-360) */
  function isCommonAngle(value) {
    const num = parseInt(String(value), 10);
    return !isNaN(num) && num >= 10 && num <= 360;
  }

  /** Normalize LaTeX for deduplication comparison */
  function normalizeLatexForComparison(latex) {
    return String(latex || '')
      .replace(/\s+/g, '')
      .replace(/\\cdot/g, '*')
      .replace(/\\left/g, '')
      .replace(/\\right/g, '');
  }

  /** Deduplicate ASTs by comparing their LaTeX output */
  function deduplicateASTs(asts) {
    const parser = getParser();
    if (!parser.astToLatex) return asts;

    const seen = new Set();
    const unique = [];
    for (const ast of asts) {
      const latex = normalizeLatexForComparison(parser.astToLatex(ast));
      if (!seen.has(latex)) {
        seen.add(latex);
        unique.push(ast);
      }
    }
    return unique;
  }

  // ==========================================================================
  // EXPORTS
  // ==========================================================================
  const exports = {
    generateSuggestions,
    ambiguityRules,
    collectAlternatives,
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.ambiguityResolver = exports;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
})();
