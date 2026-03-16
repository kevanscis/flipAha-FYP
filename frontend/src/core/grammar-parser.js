// ============================================================================
// grammar-parser.js — PEG-style recursive-descent math parser
//
// Replaces regex-based pattern matching with a structured grammar that
// tokenizes → parses → builds an AST → renders to LaTeX.
//
// Batch 1: Core infrastructure (tokenizer, parser, AST, LaTeX renderer)
// ============================================================================

(function () {
  'use strict';

  // ==========================================================================
  // TOKEN TYPES
  // ==========================================================================
  const TokenType = Object.freeze({
    NUMBER:     'NUMBER',
    IDENTIFIER: 'IDENTIFIER',   // variable like x, y, n
    FUNCTION:   'FUNCTION',     // sin, cos, log, sqrt, ...
    CONSTANT:   'CONSTANT',     // pi, e, theta, infinity, ...
    OPERATOR:   'OPERATOR',     // +, -, *, /, =
    POWER:      'POWER',        // ^
    LPAREN:     'LPAREN',       // (
    RPAREN:     'RPAREN',       // )
    LBRACE:     'LBRACE',       // {
    RBRACE:     'RBRACE',       // }
    COMMA:      'COMMA',        // ,
    DEGREE:     'DEGREE',       // °
    FACTORIAL:  'FACTORIAL',    // !
    PIPE:       'PIPE',         // | (for absolute value)
    EOF:        'EOF',
  });

  // ==========================================================================
  // KNOWN FUNCTIONS & CONSTANTS
  // ==========================================================================

  // Sorted by length descending so greedy matching prefers longer tokens
  const KNOWN_FUNCTIONS = [
    'arcsinh', 'arccosh', 'arctanh',
    'arcsin', 'arccos', 'arctan',
    'cosec', 'cosech',
    'sinh', 'cosh', 'tanh',
    'asin', 'acos', 'atan',
    'sqrt', 'cbrt',
    'sin', 'cos', 'tan', 'sec', 'csc', 'cot',
    'log', 'ln', 'lg', 'exp', 'abs',
    'lim', 'sum', 'prod', 'int',
    'floor', 'ceil', 'round',
    'det', 'mod',
    // Decorator functions (vectors, statistics, etc.)
    'vec', 'bar', 'overline', 'hat', 'dot', 'ddot', 'tilde', 'underline',
    // Combinatorics
    'binom', 'nCr', 'nPr',
  ].sort((a, b) => b.length - a.length);

  const KNOWN_CONSTANTS = {
    'infinity': '\\infty',
    'inf':      '\\infty',
    'pi':       '\\pi',
    'theta':    '\\theta',
    'alpha':    '\\alpha',
    'beta':     '\\beta',
    'gamma':    '\\gamma',
    'delta':    '\\delta',
    'epsilon':  '\\epsilon',
    'lambda':   '\\lambda',
    'sigma':    '\\sigma',
    'omega':    '\\omega',
    'mu':       '\\mu',
    'phi':      '\\phi',
    'psi':      '\\psi',
    'rho':      '\\rho',
    'tau':      '\\tau',
    'eta':      '\\eta',
    // Geometry & trig symbols
    'triangle': '\\triangle',
    'angle':    '\\angle',
    'perp':     '\\perp',
    'parallel': '\\parallel',
    'cong':     '\\cong',
    'sim':      '\\sim',
    'therefore':'\\therefore',
    'summation':'\\sum',
    'sigma_sum':'\\sum',
    'leq':'\\leq',
    'geq':'\\geq',
    'neq':'\\neq',
    // Set theory
    'emptyset':     '\\emptyset',
    'varnothing':   '\\varnothing',
    'cup':          '\\cup',
    'cap':          '\\cap',
    'subset':       '\\subset',
    'supset':       '\\supset',
    'subseteq':     '\\subseteq',
    'supseteq':     '\\supseteq',
    'setminus':     '\\setminus',
    'forall':       '\\forall',
    'exists':       '\\exists',
    'notin':        '\\notin',
    'ni':           '\\ni',
    'in':           '\\in',
    'lbrace':       '\\{',
    'rbrace':       '\\}',
    // Logic & arrows
    'implies':      '\\implies',
    'iff':          '\\iff',
    'rightarrow':   '\\rightarrow',
    'leftarrow':    '\\leftarrow',
    'mapsto':       '\\mapsto',
    // Calculus
    'partial':      '\\partial',
    // Additional symbols
    'pm':           '\\pm',
    'mp':           '\\mp',
    'approx':       '\\approx',
    'propto':       '\\propto',
    'cdots':        '\\cdots',
    'ldots':        '\\ldots',
    'dots':         '\\dots',
  };

  // LaTeX-prefixed function names we should also recognize
  const LATEX_FUNCTIONS = [
    '\\arcsin', '\\arccos', '\\arctan',
    '\\sinh', '\\cosh', '\\tanh',
    '\\sin', '\\cos', '\\tan', '\\sec', '\\csc', '\\cot',
    '\\cosec',
    '\\log', '\\ln', '\\lg', '\\exp',
    '\\sqrt', '\\cbrt',
    '\\lim', '\\sum', '\\prod', '\\int',
    '\\det', '\\mod', '\\abs',
    // Decorator functions
    '\\vec', '\\bar', '\\overline', '\\hat', '\\dot', '\\ddot',
    '\\tilde', '\\underline',
    // Combinatorics
    '\\binom',
  ].sort((a, b) => b.length - a.length);

  const LATEX_CONSTANTS = {
    '\\pi':       '\\pi',
    '\\theta':    '\\theta',
    '\\alpha':    '\\alpha',
    '\\beta':     '\\beta',
    '\\gamma':    '\\gamma',
    '\\delta':    '\\delta',
    '\\epsilon':  '\\epsilon',
    '\\lambda':   '\\lambda',
    '\\sigma':    '\\sigma',
    '\\omega':    '\\omega',
    '\\mu':       '\\mu',
    '\\phi':      '\\phi',
    '\\psi':      '\\psi',
    '\\rho':      '\\rho',
    '\\tau':      '\\tau',
    '\\eta':      '\\eta',
    '\\infty':    '\\infty',
    // Geometry & trig symbols
    '\\triangle': '\\triangle',
    '\\angle':    '\\angle',
    '\\perp':     '\\perp',
    '\\parallel': '\\parallel',
    '\\cong':     '\\cong',
    '\\sim':      '\\sim',
    '\\therefore':'\\therefore',
    // Set theory
    '\\emptyset':  '\\emptyset',
    '\\varnothing':'\\varnothing',
    '\\cup':       '\\cup',
    '\\cap':       '\\cap',
    '\\subset':    '\\subset',
    '\\supset':    '\\supset',
    '\\subseteq':  '\\subseteq',
    '\\supseteq':  '\\supseteq',
    '\\setminus':  '\\setminus',
    '\\in':        '\\in',
    '\\notin':     '\\notin',
    '\\ni':        '\\ni',
    '\\forall':    '\\forall',
    '\\exists':    '\\exists',
    // Logic & arrows
    '\\implies':   '\\implies',
    '\\iff':       '\\iff',
    '\\rightarrow':'\\rightarrow',
    '\\leftarrow': '\\leftarrow',
    '\\mapsto':    '\\mapsto',
    // Calculus
    '\\partial':   '\\partial',
    // Additional symbols
    '\\pm':        '\\pm',
    '\\mp':        '\\mp',
    '\\approx':    '\\approx',
    '\\propto':    '\\propto',
    '\\cdots':     '\\cdots',
    '\\ldots':     '\\ldots',
  };

  // ==========================================================================
  // TOKENIZER
  // ==========================================================================

  /**
   * Tokenize a raw math input string into an array of tokens.
   * Each token: { type, value, pos }
   */
  function tokenize(input) {
    const src = String(input || '')
      .trim()
      .replace(/½/g, '(1/2)')
      .replace(/¼/g, '(1/4)')
      .replace(/¾/g, '(3/4)');
    const tokens = [];
    let i = 0;

    while (i < src.length) {
      // Skip whitespace
      if (/\s/.test(src[i])) { i++; continue; }

      // --- Unicode normalization ---
      if (src[i] === '−' || src[i] === '–') {
        tokens.push({ type: TokenType.OPERATOR, value: '-', pos: i });
        i++; continue;
      }
      if (src[i] === '×' || src[i] === '·' || src[i] === '⋅') {
        tokens.push({ type: TokenType.OPERATOR, value: '*', pos: i });
        i++; continue;
      }
      if (src[i] === '÷') {
        tokens.push({ type: TokenType.OPERATOR, value: '/', pos: i });
        i++; continue;
      }

      // Unicode geometry symbols
      if (src[i] === '△' || src[i] === '▲' || src[i] === '▵') {
        tokens.push({ type: TokenType.CONSTANT, value: 'triangle', pos: i });
        i++; continue;
      }
      if (src[i] === '∠' || src[i] === '∡') {
        tokens.push({ type: TokenType.CONSTANT, value: 'angle', pos: i });
        i++; continue;
      }
      if (src[i] === '⊥') {
        tokens.push({ type: TokenType.CONSTANT, value: 'perp', pos: i });
        i++; continue;
      }
      if (src[i] === '∥') {
        tokens.push({ type: TokenType.CONSTANT, value: 'parallel', pos: i });
        i++; continue;
      }
      if (src[i] === '≅') {
        tokens.push({ type: TokenType.CONSTANT, value: 'cong', pos: i });
        i++; continue;
      }
      if (src[i] === '∼' || src[i] === '~') {
        tokens.push({ type: TokenType.CONSTANT, value: 'sim', pos: i });
        i++; continue;
      }
      if (src[i] === '∴') {
        tokens.push({ type: TokenType.CONSTANT, value: 'therefore', pos: i });
        i++; continue;
      }
      if (src[i] === '≤') {
        tokens.push({ type: TokenType.OPERATOR, value: '<=', pos: i });
        i++; continue;
      }
      if (src[i] === '≥') {
        tokens.push({ type: TokenType.OPERATOR, value: '>=', pos: i });
        i++; continue;
      }
      if (src[i] === '≠') {
        tokens.push({ type: TokenType.OPERATOR, value: '!=', pos: i });
        i++; continue;
      }
      if (src[i] === '∑') {
        tokens.push({ type: TokenType.CONSTANT, value: 'summation', pos: i });
        i++; continue;
      }

      // Set theory Unicode symbols
      if (src[i] === '∅') {
        tokens.push({ type: TokenType.CONSTANT, value: 'emptyset', pos: i });
        i++; continue;
      }
      if (src[i] === '∪') {
        tokens.push({ type: TokenType.CONSTANT, value: 'cup', pos: i });
        i++; continue;
      }
      if (src[i] === '∩') {
        tokens.push({ type: TokenType.CONSTANT, value: 'cap', pos: i });
        i++; continue;
      }
      if (src[i] === '∈') {
        tokens.push({ type: TokenType.CONSTANT, value: 'in', pos: i });
        i++; continue;
      }
      if (src[i] === '∉') {
        tokens.push({ type: TokenType.CONSTANT, value: 'notin', pos: i });
        i++; continue;
      }
      if (src[i] === '⊂') {
        tokens.push({ type: TokenType.CONSTANT, value: 'subset', pos: i });
        i++; continue;
      }
      if (src[i] === '⊆') {
        tokens.push({ type: TokenType.CONSTANT, value: 'subseteq', pos: i });
        i++; continue;
      }
      if (src[i] === '⊃') {
        tokens.push({ type: TokenType.CONSTANT, value: 'supset', pos: i });
        i++; continue;
      }
      if (src[i] === '⊇') {
        tokens.push({ type: TokenType.CONSTANT, value: 'supseteq', pos: i });
        i++; continue;
      }
      if (src[i] === '\\' && src[i+1] === '{') {
        // \{ → set brace
        tokens.push({ type: TokenType.CONSTANT, value: 'lbrace', pos: i });
        i += 2; continue;
      }
      if (src[i] === '\\' && src[i+1] === '}') {
        // \} → set brace
        tokens.push({ type: TokenType.CONSTANT, value: 'rbrace', pos: i });
        i += 2; continue;
      }

      // Calculus Unicode symbols
      if (src[i] === '∂') {
        tokens.push({ type: TokenType.CONSTANT, value: 'partial', pos: i });
        i++; continue;
      }
      if (src[i] === '∫') {
        tokens.push({ type: TokenType.FUNCTION, value: 'int', pos: i });
        i++; continue;
      }

      // Logic & arrow Unicode symbols
      if (src[i] === '⇒') {
        tokens.push({ type: TokenType.CONSTANT, value: 'implies', pos: i });
        i++; continue;
      }
      if (src[i] === '⇔') {
        tokens.push({ type: TokenType.CONSTANT, value: 'iff', pos: i });
        i++; continue;
      }
      if (src[i] === '→') {
        tokens.push({ type: TokenType.CONSTANT, value: 'rightarrow', pos: i });
        i++; continue;
      }
      if (src[i] === '←') {
        tokens.push({ type: TokenType.CONSTANT, value: 'leftarrow', pos: i });
        i++; continue;
      }
      if (src[i] === '↔') {
        tokens.push({ type: TokenType.CONSTANT, value: 'iff', pos: i });
        i++; continue;
      }

      // Additional math Unicode symbols
      if (src[i] === '±') {
        tokens.push({ type: TokenType.CONSTANT, value: 'pm', pos: i });
        i++; continue;
      }
      if (src[i] === '∓') {
        tokens.push({ type: TokenType.CONSTANT, value: 'mp', pos: i });
        i++; continue;
      }
      if (src[i] === '≈') {
        tokens.push({ type: TokenType.CONSTANT, value: 'approx', pos: i });
        i++; continue;
      }
      if (src[i] === '∝') {
        tokens.push({ type: TokenType.CONSTANT, value: 'propto', pos: i });
        i++; continue;
      }
      if (src[i] === '∀') {
        tokens.push({ type: TokenType.CONSTANT, value: 'forall', pos: i });
        i++; continue;
      }
      if (src[i] === '∃') {
        tokens.push({ type: TokenType.CONSTANT, value: 'exists', pos: i });
        i++; continue;
      }
      // Prime symbol (for derivatives: f′(x))
      if (src[i] === '′' || src[i] === '\'') {
        tokens.push({ type: TokenType.OPERATOR, value: "'", pos: i });
        i++; continue;
      }

      // Unicode superscripts → ^n
      const superMap = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-','⁺':'+','ⁿ':'n','ⁱ':'i' };
      if (superMap[src[i]]) {
        tokens.push({ type: TokenType.POWER, value: '^', pos: i });
        let sup = '';
        while (i < src.length && superMap[src[i]]) {
          sup += superMap[src[i]];
          i++;
        }
        // Push the exponent as a number or identifier
        if (/^[+\-]?\d+$/.test(sup)) {
          tokens.push({ type: TokenType.NUMBER, value: sup, pos: i });
        } else {
          tokens.push({ type: TokenType.IDENTIFIER, value: sup, pos: i });
        }
        continue;
      }

      // Degree symbol
      if (src[i] === '°') {
        tokens.push({ type: TokenType.DEGREE, value: '°', pos: i });
        i++; continue;
      }

      // --- LaTeX commands (backslash-prefixed) ---
      if (src[i] === '\\') {
        // Check LaTeX functions first (longer matches first)
        let matched = false;
        for (const fn of LATEX_FUNCTIONS) {
          if (src.startsWith(fn, i)) {
            // Make sure it's a complete token (next char is not a letter)
            const afterFn = i + fn.length;
            if (afterFn >= src.length || !/[a-zA-Z]/.test(src[afterFn])) {
              const plainName = fn.slice(1); // remove backslash
              tokens.push({ type: TokenType.FUNCTION, value: plainName, pos: i });
              i = afterFn;
              matched = true;
              break;
            }
          }
        }
        if (matched) continue;

        // Check LaTeX constants
        for (const [latexConst, latex] of Object.entries(LATEX_CONSTANTS)) {
          if (src.startsWith(latexConst, i)) {
            const afterConst = i + latexConst.length;
            if (afterConst >= src.length || !/[a-zA-Z]/.test(src[afterConst])) {
              // Find the plain name for this constant
              const plainName = Object.keys(KNOWN_CONSTANTS).find(
                k => KNOWN_CONSTANTS[k] === latex
              ) || latexConst.slice(1);
              tokens.push({ type: TokenType.CONSTANT, value: plainName, pos: i });
              i = afterConst;
              matched = true;
              break;
            }
          }
        }
        if (matched) continue;

        // Unknown backslash command — skip the backslash and treat the word as identifier
        i++; // skip '\'
        let word = '';
        while (i < src.length && /[a-zA-Z]/.test(src[i])) {
          word += src[i]; i++;
        }
        if (word) {
          tokens.push({ type: TokenType.IDENTIFIER, value: word, pos: i - word.length });
        }
        continue;
      }

      // --- Numbers ---
      if (/[0-9]/.test(src[i]) || (src[i] === '.' && i + 1 < src.length && /[0-9]/.test(src[i + 1]))) {
        let num = '';
        while (i < src.length && /[0-9]/.test(src[i])) { num += src[i]; i++; }
        if (i < src.length && src[i] === '.' && i + 1 < src.length && /[0-9]/.test(src[i + 1])) {
          num += src[i]; i++;
          while (i < src.length && /[0-9]/.test(src[i])) { num += src[i]; i++; }
        }
        tokens.push({ type: TokenType.NUMBER, value: num, pos: i - num.length });
        continue;
      }

      // --- Alpha sequences: function names, constants, or variables ---
      if (/[a-zA-Z_]/.test(src[i])) {
        let word = '';
        const wordStart = i;
        while (i < src.length && /[a-zA-Z_]/.test(src[i])) {
          word += src[i]; i++;
        }
        const lower = word.toLowerCase();

        // Alias words that should not be split by greedy function matching.
        if (lower === 'root') {
          tokens.push({ type: TokenType.FUNCTION, value: 'sqrt', pos: wordStart });
          continue;
        }
        if (lower === 'absolute') {
          tokens.push({ type: TokenType.FUNCTION, value: 'abs', pos: wordStart });
          continue;
        }
        if (lower === 'summation') {
          tokens.push({ type: TokenType.CONSTANT, value: 'summation', pos: wordStart });
          continue;
        }
        // Fix: "infinity" contains "int" prefix — prioritize constant match
        if (lower === 'infinity') {
          tokens.push({ type: TokenType.CONSTANT, value: 'infinity', pos: wordStart });
          continue;
        }
        // Set theory keyword aliases (contain function-name prefixes like "int")
        if (lower === 'intersection' || lower === 'intersect') {
          tokens.push({ type: TokenType.CONSTANT, value: 'cap', pos: wordStart });
          continue;
        }
        if (lower === 'union') {
          tokens.push({ type: TokenType.CONSTANT, value: 'cup', pos: wordStart });
          continue;
        }
        if (lower === 'element') {
          tokens.push({ type: TokenType.CONSTANT, value: 'in', pos: wordStart });
          continue;
        }
        if (lower === 'complement') {
          tokens.push({ type: TokenType.CONSTANT, value: 'setminus', pos: wordStart });
          continue;
        }
        // Calculus keyword aliases
        if (lower === 'integral') {
          tokens.push({ type: TokenType.FUNCTION, value: 'int', pos: wordStart });
          continue;
        }
        if (lower === 'derivative') {
          tokens.push({ type: TokenType.IDENTIFIER, value: 'd', pos: wordStart });
          continue;
        }
        // Vector/statistics keyword aliases
        if (lower === 'vector') {
          tokens.push({ type: TokenType.FUNCTION, value: 'vec', pos: wordStart });
          continue;
        }
        if (lower === 'mean' || lower === 'average') {
          tokens.push({ type: TokenType.FUNCTION, value: 'bar', pos: wordStart });
          continue;
        }
        // Misc keyword aliases
        if (lower === 'plusminus') {
          tokens.push({ type: TokenType.CONSTANT, value: 'pm', pos: wordStart });
          continue;
        }
        if (lower === 'proportional') {
          tokens.push({ type: TokenType.CONSTANT, value: 'propto', pos: wordStart });
          continue;
        }

        // Check for known functions (greedy: prefer longer matches)
        let fnMatch = null;
        for (const fn of KNOWN_FUNCTIONS) {
          if (lower.startsWith(fn)) {
            // Ensure the function name is maximal (don't match "sin" in "sinh")
            const remaining = lower.slice(fn.length);
            const longerFn = KNOWN_FUNCTIONS.find(f => f.length > fn.length && lower.startsWith(f));
            if (!longerFn) {
              fnMatch = fn;
              break;
            }
          }
        }

        if (fnMatch && fnMatch.length === word.length) {
          // Exact function name match
          tokens.push({ type: TokenType.FUNCTION, value: fnMatch, pos: wordStart });
          continue;
        }

        if (fnMatch && fnMatch.length < word.length) {
          // Partial match: e.g. "sinx" → FUNCTION "sin" + IDENTIFIER "x"
          // Or "sin30" → FUNCTION "sin" + left over "30"
          tokens.push({ type: TokenType.FUNCTION, value: fnMatch, pos: wordStart });
          // Put back the remaining characters
          i = wordStart + fnMatch.length;
          continue;
        }

        // Check for known constants
        if (KNOWN_CONSTANTS[lower] && lower.length === word.length) {
          tokens.push({ type: TokenType.CONSTANT, value: lower, pos: wordStart });
          continue;
        }

        // Check if word starts with a constant name
        let constMatch = null;
        for (const cname of Object.keys(KNOWN_CONSTANTS).sort((a, b) => b.length - a.length)) {
          if (lower.startsWith(cname) && cname.length < word.length) {
            constMatch = cname;
            break;
          }
        }
        if (constMatch) {
          tokens.push({ type: TokenType.CONSTANT, value: constMatch, pos: wordStart });
          i = wordStart + constMatch.length;
          continue;
        }

        // Degree word aliases
        if (lower === 'degree' || lower === 'degrees' || lower === 'deg') {
          tokens.push({ type: TokenType.DEGREE, value: '°', pos: wordStart });
          continue;
        }

        // Single-letter variable — if word is multi-char and not recognized,
        // emit first char as variable, then re-check remainder for functions/constants.
        // e.g. "xcosx" → IDENTIFIER "x", then tokenizer re-enters and matches "cos" + "x"
        if (word.length === 1) {
          tokens.push({ type: TokenType.IDENTIFIER, value: word, pos: wordStart });
        } else {
          // Emit first character as IDENTIFIER and rewind to check the rest
          tokens.push({ type: TokenType.IDENTIFIER, value: word[0], pos: wordStart });
          i = wordStart + 1; // re-enter main loop to re-check for functions/constants
        }
        continue;
      }

      // --- Simple single-character tokens ---
      if (src[i] === '<' && i + 1 < src.length && src[i + 1] === '=') {
        tokens.push({ type: TokenType.OPERATOR, value: '<=', pos: i });
        i += 2;
        continue;
      }
      if (src[i] === '>' && i + 1 < src.length && src[i + 1] === '=') {
        tokens.push({ type: TokenType.OPERATOR, value: '>=', pos: i });
        i += 2;
        continue;
      }
      if (src[i] === '!' && i + 1 < src.length && src[i + 1] === '=') {
        tokens.push({ type: TokenType.OPERATOR, value: '!=', pos: i });
        i += 2;
        continue;
      }
      switch (src[i]) {
        case '+': case '-': case '*': case '/': case '=': case '<': case '>':
          tokens.push({ type: TokenType.OPERATOR, value: src[i], pos: i }); break;
        case '^':
          tokens.push({ type: TokenType.POWER, value: '^', pos: i }); break;
        case '(':
          tokens.push({ type: TokenType.LPAREN, value: '(', pos: i }); break;
        case ')':
          tokens.push({ type: TokenType.RPAREN, value: ')', pos: i }); break;
        case '{':
          tokens.push({ type: TokenType.LBRACE, value: '{', pos: i }); break;
        case '}':
          tokens.push({ type: TokenType.RBRACE, value: '}', pos: i }); break;
        case ',':
          tokens.push({ type: TokenType.COMMA, value: ',', pos: i }); break;
        case '!':
          tokens.push({ type: TokenType.FACTORIAL, value: '!', pos: i }); break;
        case '|':
          tokens.push({ type: TokenType.PIPE, value: '|', pos: i }); break;
        default:
          // Unknown character — skip
          console.warn(`[grammar-parser] Skipping unknown character '${src[i]}' at position ${i}`);
          break;
      }
      i++;
    }

    tokens.push({ type: TokenType.EOF, value: '', pos: i });
    return tokens;
  }

  // ==========================================================================
  // AST NODE CONSTRUCTORS
  // ==========================================================================

  const ASTNode = {
    number(value)         { return { type: 'number', value: String(value) }; },
    variable(name)        { return { type: 'variable', name }; },
    constant(name, latex) { return { type: 'constant', name, latex }; },
    binary(op, left, right) { return { type: 'binary', op, left, right }; },
    unary(op, operand)    { return { type: 'unary', op, operand }; },
    func(name, args, modifier, hasExplicitParens) {
      return { type: 'function', name, args: args || [], modifier: modifier || null, hasExplicitParens: !!hasExplicitParens };
    },
    power(base, exponent) { return { type: 'power', base, exponent }; },
    degree(expr)          { return { type: 'degree', expr }; },
    factorial(expr)       { return { type: 'factorial', expr }; },
    abs(expr)             { return { type: 'abs', expr }; },
    frac(num, den)        { return { type: 'frac', numerator: num, denominator: den }; },
    sqrt(radicand, index) { return { type: 'sqrt', radicand, index: index || null }; },
    subscript(base, sub)  { return { type: 'subscript', base, sub }; },
    group(expr)           { return { type: 'group', expr }; },
    implicitMul(factors)  { return { type: 'implicit_multiply', factors }; },
  };

  // ==========================================================================
  // RECURSIVE DESCENT PARSER
  // ==========================================================================

  /**
   * Parse a token array into an AST.
   * Grammar (precedence low → high):
   *
   *   Expression   ← Additive
   *   Additive     ← Multiplicative (('+' | '-') Multiplicative)*
   *   Multiplicative ← ImplicitMul (('*' | '/' | '÷') ImplicitMul)*
   *   ImplicitMul  ← Unary+                    // 2x, sinx, xy
   *   Unary        ← ('-' | '+')* Power
   *   Power        ← Postfix ('^' ('{' Expr '}' | Unary))?
   *   Postfix      ← Primary ('°' | '!')*
   *   Primary      ← Number | FunctionCall | Constant | Variable | '(' Expr ')' | '|' Expr '|'
   *   FunctionCall ← FUNCTION ('(' ExprList ')' | '{' Expr '}' | Primary)
   */
  function parse(tokens) {
    let pos = 0;

    function peek()    { return tokens[pos] || { type: TokenType.EOF, value: '' }; }
    function current() { return tokens[pos] || { type: TokenType.EOF, value: '' }; }
    function advance() { return tokens[pos++] || { type: TokenType.EOF, value: '' }; }
    function expect(type) {
      const tok = current();
      if (tok.type !== type) {
        throw new ParseError(`Expected ${type} but got ${tok.type} ('${tok.value}') at position ${tok.pos}`);
      }
      return advance();
    }

    function isAtEnd() { return current().type === TokenType.EOF; }

    // --- Expression (top level): handles = for equations ---
    function parseExpression() {
      let left = parseAdditive();
      while (!isAtEnd() && current().type === TokenType.OPERATOR && ['=', '<=', '>=', '!=', '<', '>'].includes(current().value)) {
        const op = advance().value;
        const right = parseAdditive();
        left = ASTNode.binary(op, left, right);
      }
      return left;
    }

    // --- Additive: a + b - c ---
    function parseAdditive() {
      let left = parseMultiplicative();
      while (!isAtEnd() && current().type === TokenType.OPERATOR && (current().value === '+' || current().value === '-')) {
        const op = advance().value;
        const right = parseMultiplicative();
        left = ASTNode.binary(op, left, right);
      }
      return left;
    }

    // --- Multiplicative: a * b / c ---
    function parseMultiplicative() {
      let left = parseImplicitMul();
      while (!isAtEnd() && current().type === TokenType.OPERATOR && (current().value === '*' || current().value === '/')) {
        const op = advance().value;
        const right = parseImplicitMul();
        left = ASTNode.binary(op, left, right);
      }
      return left;
    }

    // --- Implicit multiplication: 2x, xy, 3sin(x) ---
    // Adjacent atoms without an operator between them
    function parseImplicitMul() {
      const factors = [parseUnary()];

      while (!isAtEnd()) {
        const tok = current();
        // Can this token start a new factor for implicit multiplication?
        // Note: PIPE is excluded — it's only valid at Primary level to start |expr|
        const canStartFactor =
          tok.type === TokenType.NUMBER ||
          tok.type === TokenType.IDENTIFIER ||
          tok.type === TokenType.FUNCTION ||
          tok.type === TokenType.CONSTANT ||
          tok.type === TokenType.LPAREN;

        if (!canStartFactor) break;

        // Avoid treating '+'/'-' after a term as implicit multiply
        // (they should be additive operators handled at higher level)
        factors.push(parseUnary());
      }

      if (factors.length === 1) return factors[0];
      return ASTNode.implicitMul(factors);
    }

    // --- Unary: -x, +x, --x ---
    function parseUnary() {
      if (!isAtEnd() && current().type === TokenType.OPERATOR && (current().value === '-' || current().value === '+')) {
        const op = advance().value;
        const operand = parseUnary();
        if (op === '+') return operand; // unary + is a no-op
        return ASTNode.unary('-', operand);
      }
      return parsePower();
    }

    // --- Power: x^2, x^{n+1}, sin^2(x) ---
    function parsePower() {
      let base = parsePostfix();

      if (!isAtEnd() && current().type === TokenType.POWER) {
        advance(); // consume '^'

        let exponent;
        if (!isAtEnd() && current().type === TokenType.LBRACE) {
          // Brace-delimited exponent: x^{n+1}
          advance(); // consume '{'
          exponent = parseExpression();
          if (current().type === TokenType.RBRACE) advance(); // consume '}'
        } else if (!isAtEnd() && current().type === TokenType.LPAREN) {
          // Parenthesized exponent: x^(n+1)
          advance(); // consume '('
          exponent = parseExpression();
          if (current().type === TokenType.RPAREN) advance(); // consume ')'
        } else {
          // Single token exponent: x^2, x^n
          exponent = parseUnary();
        }

        base = ASTNode.power(base, exponent);
      }

      return base;
    }

    // --- Postfix: x°, n!, f' (prime/derivative notation) ---
    function parsePostfix() {
      let expr = parsePrimary();

      while (!isAtEnd()) {
        if (current().type === TokenType.DEGREE) {
          advance();
          expr = ASTNode.degree(expr);
        } else if (current().type === TokenType.FACTORIAL) {
          advance();
          expr = ASTNode.factorial(expr);
        } else if (current().type === TokenType.OPERATOR && current().value === "'") {
          // Prime notation: f' → f', f'' → f'', etc.
          let primeCount = 0;
          while (!isAtEnd() && current().type === TokenType.OPERATOR && current().value === "'") {
            advance();
            primeCount++;
          }
          const primeStr = "'".repeat(primeCount);
          // If the expression is a variable like f, g, y — make it f', f'', etc.
          if (expr.type === 'variable') {
            expr = ASTNode.variable(expr.name + primeStr);
          } else {
            // For other expressions, wrap as a power-like notation
            expr = ASTNode.variable(String(expr.name || expr.value || '') + primeStr);
          }
        } else {
          break;
        }
      }

      return expr;
    }

    // --- Primary: atoms ---
    function parsePrimary() {
      const tok = current();

      // Number
      if (tok.type === TokenType.NUMBER) {
        advance();
        return ASTNode.number(tok.value);
      }

      // Function call
      if (tok.type === TokenType.FUNCTION) {
        return parseFunctionCall();
      }

      // Constant (pi, theta, etc.)
      if (tok.type === TokenType.CONSTANT) {
        advance();
        const latex = KNOWN_CONSTANTS[tok.value] || `\\${tok.value}`;
        return ASTNode.constant(tok.value, latex);
      }

      // Variable (single letter)
      if (tok.type === TokenType.IDENTIFIER) {
        advance();
        return ASTNode.variable(tok.value);
      }

      // Standalone relation operators can appear as direct symbol queries.
      if (tok.type === TokenType.OPERATOR && ['<=', '>=', '!='].includes(tok.value)) {
        advance();
        const symbolMap = {
          '<=': ['leq', '\\leq'],
          '>=': ['geq', '\\geq'],
          '!=': ['neq', '\\neq'],
        };
        const [name, latex] = symbolMap[tok.value] || ['rel', tok.value];
        return ASTNode.constant(name, latex);
      }

      // Parenthesized expression
      if (tok.type === TokenType.LPAREN) {
        advance(); // consume '('
        const expr = parseExpression();
        if (current().type === TokenType.RPAREN) advance(); // consume ')'
        return ASTNode.group(expr);
      }

      // Brace-delimited expression  {expr}
      if (tok.type === TokenType.LBRACE) {
        advance(); // consume '{'
        const expr = parseExpression();
        if (current().type === TokenType.RBRACE) advance(); // consume '}'
        return expr; // braces are just grouping
      }

      // Absolute value: |expr|
      if (tok.type === TokenType.PIPE) {
        advance(); // consume first |
        const expr = parseExpression();
        if (current().type === TokenType.PIPE) advance(); // consume closing |
        return ASTNode.abs(expr);
      }

      // Unexpected token — create an error node but try to continue
      advance();
      return ASTNode.variable(tok.value || '?');
    }

    // --- Function call: sin(x), sin x, sin 30, log_2(8), sqrt[3]{x} ---
    function parseFunctionCall() {
      const funcTok = advance(); // consume function name
      const funcName = funcTok.value;

      // Special case: sqrt with optional index
      if (funcName === 'sqrt' || funcName === 'cbrt') {
        return parseSqrt(funcName);
      }

      // Check for subscript: log_2, log_{10}
      let subscript = null;
      if (funcName === 'log' || funcName === 'lg') {
        if (!isAtEnd() && current().type === TokenType.IDENTIFIER && current().value === '_') {
          advance(); // consume '_'
          if (current().type === TokenType.LBRACE) {
            advance();
            subscript = parseExpression();
            if (current().type === TokenType.RBRACE) advance();
          } else {
            subscript = parsePrimary();
          }
        }
        // Also: log10, log2 — number immediately after 'log' when no parens follow
        if (!subscript && !isAtEnd() && current().type === TokenType.NUMBER) {
          const nextTok = tokens[pos + 1];
          // log2(x), log2x, log2 34 -> base 2 with following argument
          if (nextTok && (nextTok.type === TokenType.LPAREN || nextTok.type === TokenType.IDENTIFIER || nextTok.type === TokenType.CONSTANT || nextTok.type === TokenType.FUNCTION || nextTok.type === TokenType.NUMBER)) {
            subscript = ASTNode.number(advance().value);
          }
        }
      }

      // Check for function modifier: sin^2, sin^{-1}
      let modifier = null;
      if (!isAtEnd() && current().type === TokenType.POWER) {
        advance(); // consume '^'
        if (current().type === TokenType.LBRACE) {
          advance();
          modifier = parseExpression();
          if (current().type === TokenType.RBRACE) advance();
        } else {
          modifier = parseUnary();
        }
      } else if (!isAtEnd() && current().type === TokenType.OPERATOR && current().value === '-') {
        // Support inverse-trig shorthand without caret: sin-1(x), cos-1x
        const nextTok = tokens[pos + 1];
        if (nextTok && nextTok.type === TokenType.NUMBER && nextTok.value === '1') {
          advance(); // '-'
          advance(); // '1'
          modifier = ASTNode.unary('-', ASTNode.number('1'));
        }
      }

      // Parse argument(s)
      let args = [];
      let hasExplicitParens = false;
      if (!isAtEnd() && current().type === TokenType.LPAREN) {
        // Explicit parentheses: sin(x), log(2, 8)
        hasExplicitParens = true;
        advance(); // consume '('
        if (current().type !== TokenType.RPAREN) {
          args.push(parseExpression());
          while (current().type === TokenType.COMMA) {
            advance(); // consume ','
            args.push(parseExpression());
          }
        }
        if (current().type === TokenType.RPAREN) advance();
      } else if (!isAtEnd() && current().type === TokenType.LBRACE) {
        // Brace argument: \sin{x}
        advance();
        args.push(parseExpression());
        if (current().type === TokenType.RBRACE) advance();
      } else if (!isAtEnd()) {
        // Implicit argument (no parens): sinx, sin30, sin pi
        const tok = current();
        if (tok.type === TokenType.NUMBER || tok.type === TokenType.IDENTIFIER ||
            tok.type === TokenType.CONSTANT || tok.type === TokenType.FUNCTION) {
          // Parse the next "unit" as the argument
          args.push(parsePostfix()); // just one postfix-level atom
        }
      }

      const node = ASTNode.func(funcName, args, modifier, hasExplicitParens);
      if (subscript) {
        return ASTNode.subscript(node, subscript);
      }
      return node;
    }

    // --- sqrt / cbrt parsing ---
    function parseSqrt(funcName) {
      let index = funcName === 'cbrt' ? ASTNode.number('3') : null;

      // sqrt[3]{x} or sqrt[n]{x}
      if (!isAtEnd() && current().value === '[') {
        // We don't have a dedicated LBRACKET token, handle via value
        // Actually brackets might come as identifiers — let's check for LBRACE pattern
      }

      // sqrt{x} or sqrt(x) or sqrtx
      let radicand;
      if (!isAtEnd() && current().type === TokenType.LBRACE) {
        advance();
        radicand = parseExpression();
        if (current().type === TokenType.RBRACE) advance();
      } else if (!isAtEnd() && current().type === TokenType.LPAREN) {
        advance();
        radicand = parseExpression();
        if (current().type === TokenType.RPAREN) advance();
      } else if (!isAtEnd()) {
        radicand = parsePrimary();
      } else {
        radicand = ASTNode.variable('x');
      }

      return ASTNode.sqrt(radicand, index);
    }

    // --- Entry point ---
    const ast = parseExpression();
    return ast;
  }

  // ==========================================================================
  // PARSE ERROR
  // ==========================================================================
  class ParseError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ParseError';
    }
  }

  // ==========================================================================
  // AST → LaTeX RENDERER
  // ==========================================================================

  /**
   * Convert an AST node to a LaTeX string.
   */
  function astToLatex(node) {
    if (!node) return '';

    switch (node.type) {
      case 'number':
        return node.value;

      case 'variable':
        return node.name;

      case 'constant':
        return node.latex || `\\${node.name}`;

      case 'binary': {
        const left = astToLatex(node.left);
        const right = astToLatex(node.right);

        if (node.op === '/') {
          return `\\frac{${left}}{${right}}`;
        }
        if (node.op === '*') {
          // Use \cdot for explicit multiplication
          return `${wrapIfNeeded(node.left, left)} \\cdot ${wrapIfNeeded(node.right, right)}`;
        }
        if (node.op === '<=' || node.op === '>=' || node.op === '!=' || node.op === '<' || node.op === '>') {
          const relationMap = {
            '<=': '\\leq',
            '>=': '\\geq',
            '!=': '\\neq',
            '<': '<',
            '>': '>',
          };
          return `${left} ${relationMap[node.op] || node.op} ${right}`;
        }
        // + and -
        const rightStr = node.op === '-' ? wrapIfNeeded(node.right, right) : right;
        return `${left} ${node.op} ${rightStr}`;
      }

      case 'unary':
        return `-${wrapIfNeeded(node.operand, astToLatex(node.operand))}`;

      case 'function': {
        const name = node.name;
        const args = node.args.map(astToLatex);
        const argStr = args.length > 0 ? args.join(', ') : '';

        if (name === 'abs' && args.length > 0) {
          return `\\left|${argStr}\\right|`;
        }

        // Decorator functions: \vec{x}, \bar{x}, \hat{i}, \overline{AB}, etc.
        const decoratorFuncs = {
          'vec': '\\vec', 'bar': '\\bar', 'overline': '\\overline',
          'hat': '\\hat', 'dot': '\\dot', 'ddot': '\\ddot',
          'tilde': '\\tilde', 'underline': '\\underline',
        };
        if (decoratorFuncs[name] && args.length > 0) {
          return `${decoratorFuncs[name]}{${argStr}}`;
        }

        // Binomial coefficient: binom(n, r) → \binom{n}{r}
        if (name === 'binom' && args.length >= 2) {
          return `\\binom{${args[0]}}{${args[1]}}`;
        }

        // nCr / nPr: render as ^nC_r or ^nP_r style
        if ((name === 'nCr' || name === 'nPr') && args.length >= 2) {
          const letter = name === 'nCr' ? 'C' : 'P';
          return `^{${args[0]}}${letter}_{${args[1]}}`;
        }

        // Functions that use LaTeX command style
        const latexFuncNames = ['sin','cos','tan','sec','csc','cot','cosec',
                                'arcsin','arccos','arctan','sinh','cosh','tanh',
                                'log','ln','lg','exp','lim','det','mod',
                                'int','sum','prod'];
        const isLatexFunc = latexFuncNames.includes(name);

        let result = isLatexFunc ? `\\${name}` : name;

        // Modifier (e.g., sin^2, sin^{-1})
        if (node.modifier) {
          const modLatex = astToLatex(node.modifier);
          result += `^{${modLatex}}`;
        }

        if (args.length > 0) {
          // Always wrap function arguments in parentheses for clarity
          result += `(${argStr})`;
        }

        return result;
      }

      case 'power': {
        const base = astToLatex(node.base);
        const exp = astToLatex(node.exponent);
        // Unwrap group nodes to check their inner expression
        const effectiveBase = node.base.type === 'group' ? node.base.expr : node.base;
        if (needsBraces(effectiveBase)) {
          // Functions use LaTeX braces {sin(x)}^{2}, others use parens (2x)^{3}
          if (effectiveBase.type === 'function') {
            return `{${base}}^{${exp}}`;
          }
          return `(${base})^{${exp}}`;
        }
        return `${base}^{${exp}}`;
      }

      case 'degree': {
        const inner = astToLatex(node.expr);
        return `${inner}^{\\circ}`;
      }

      case 'factorial': {
        const inner = astToLatex(node.expr);
        return needsBraces(node.expr) ? `(${inner})!` : `${inner}!`;
      }

      case 'abs': {
        const inner = astToLatex(node.expr);
        return `\\left|${inner}\\right|`;
      }

      case 'frac':
        return `\\frac{${astToLatex(node.numerator)}}{${astToLatex(node.denominator)}}`;

      case 'sqrt': {
        const radicand = astToLatex(node.radicand);
        if (node.index) {
          return `\\sqrt[${astToLatex(node.index)}]{${radicand}}`;
        }
        return `\\sqrt{${radicand}}`;
      }

      case 'subscript': {
        const base = astToLatex(node.base);
        const sub = astToLatex(node.sub);
        return `${base}_{${sub}}`;
      }

      case 'group':
        return astToLatex(node.expr);

      case 'implicit_multiply': {
        // Relation/geometry symbols that need spaces on both sides
        const relationSymbols = new Set([
          '\\perp', '\\parallel', '\\cong', '\\sim', '\\therefore',
          // Set theory operators
          '\\cup', '\\cap', '\\subset', '\\supset', '\\subseteq', '\\supseteq',
          '\\in', '\\notin', '\\ni', '\\setminus',
          // Logic & arrows
          '\\implies', '\\iff', '\\rightarrow', '\\leftarrow', '\\mapsto',
          '\\forall', '\\exists',
          // Additional relation symbols
          '\\pm', '\\mp', '\\approx', '\\propto',
        ]);
        const parts = node.factors.map((f, idx) => {
          const latex = astToLatex(f);
          // Wrap binary operations in parens for clarity
          if (f.type === 'binary' && (f.op === '+' || f.op === '-')) {
            return { text: `(${latex})`, isRelation: false, node: f };
          }
          // Preserve explicit parentheses on group nodes (user typed parens)
          if (f.type === 'group') {
            return { text: `(${latex})`, isRelation: false, node: f };
          }
          const isRel = f.type === 'constant' && relationSymbols.has(latex);
          return { text: latex, isRelation: isRel, node: f };
        });
        // Join with appropriate spacing
        let result = parts[0].text;
        for (let i = 1; i < parts.length; i++) {
          const prev = parts[i - 1];
          const curr = parts[i];
          // Relations get spaces on both sides: A \perp B
          if (prev.isRelation || curr.isRelation) {
            result += ' ' + curr.text;
          // LaTeX command followed by letter: \triangle A
          } else if (/\\[a-zA-Z]+$/.test(prev.text) && /^[a-zA-Z]/.test(curr.text)) {
            result += ' ' + curr.text;
          } else {
            result += curr.text;
          }
        }
        return result;
      }

      default:
        return String(node.value || node.name || '');
    }
  }

  // Helper: does this node need braces when used as a base for ^?
  function needsBraces(node) {
    if (!node) return false;
    return node.type === 'binary' || node.type === 'unary' ||
           node.type === 'implicit_multiply' || node.type === 'function';
  }

  // Helper: does a function argument need parentheses?
  function needsFunctionParens(argNode) {
    if (!argNode) return false;
    return argNode.type === 'binary' || argNode.type === 'unary' ||
           argNode.type === 'implicit_multiply';
  }

  // Helper: wrap if the node is complex (for display clarity in +/- and *)
  function wrapIfNeeded(node, latex) {
    if (node && (node.type === 'binary' && (node.op === '+' || node.op === '-'))) {
      return `(${latex})`;
    }
    return latex;
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Parse a raw math string into an AST.
   * Returns { ast, tokens } or { error } on failure.
   */
  function parseMath(input) {
    try {
      const tokens = tokenize(input);
      const ast = parse(tokens);
      return { ast, tokens, error: null };
    } catch (e) {
      return { ast: null, tokens: null, error: e.message };
    }
  }

  /**
   * Parse and render to LaTeX in one step.
   * Returns a LaTeX string, or the raw input on failure.
   */
  function mathToLatexGrammar(input) {
    const result = parseMath(input);
    if (result.error || !result.ast) return String(input);
    return astToLatex(result.ast);
  }

  // ==========================================================================
  // EXPORTS
  // ==========================================================================
  const exports = {
    TokenType,
    tokenize,
    parse,
    parseMath,
    astToLatex,
    mathToLatexGrammar,
    ASTNode,
    ParseError,
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.grammarParser = exports;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
})();
