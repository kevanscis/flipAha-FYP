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
      if (node.factors.length !== 2) return false;
      const [a, b] = node.factors;
      return a.type === 'variable' && b.type === 'number' && /^[0-9]$/.test(b.value);
    },
    expand(node) {
      const { ASTNode } = getParser();
      const [varNode, numNode] = node.factors;
      const results = [];

      // Interpretation A: x² (power)
      results.push(ASTNode.power(varNode, numNode));

      // Interpretation B: x₁ (subscript)
      results.push(ASTNode.subscript(varNode, numNode));

      // Interpretation C: x * 1 (implicit multiply) — original
      results.push(node);

      return results;
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
      // Only match simple 2-factor implicit multiply of numbers/variables
      // e.g. 2x, xy — NOT sinxcosx, triangleABC, or long expressions
      if (node.type === 'implicit_multiply') {
        if (node.factors.length !== 2) return false;
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

    // Step 2b: If no ambiguity was found, apply completion rules
    if (alternatives.length <= 1) {
      for (const rule of completionRules) {
        if (rule.match(ast)) {
          const completions = rule.expand(ast);
          for (const c of completions) {
            if (c && c !== ast) alternatives.push(c);
          }
          break; // Only apply the first matching completion rule
        }
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
