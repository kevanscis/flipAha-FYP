// core/math-extractor.js

/**
 * Extract all math expressions from natural language input
 * Example: "Help me to solve x^2 etc" → ["x^2"]
 * Example: "Solve 2x + 3y = 5 for x" → ["2x + 3y = 5"]
 * 
 * Returns an array of math expressions found in the text
 */
export function extractMathExpression(input) {
  if (!input || typeof input !== 'string') return [];
  
  const normalized = input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim();
  
  // Extract all math expressions
  const mathExpressions = extractAllMathExpressions(normalized);
  return mathExpressions.length > 0 ? mathExpressions : [];
}

/**
 * Analyze input and return detailed breakdown
 * Returns: { text: string, expressions: [{expr, start, end, type}] }
 */
export function analyzeMathContent(input) {
  if (!input || typeof input !== 'string') {
    return { text: input, expressions: [] };
  }
  
  const expressions = extractAllMathExpressions(input);
  const detailed = [];
  let offset = 0;
  
  for (const expr of expressions) {
    const start = input.indexOf(expr, offset);
    if (start !== -1) {
      const end = start + expr.length;
      detailed.push({
        expr: expr.trim(),
        start,
        end,
        type: identifyMathType(expr)
      });
      offset = end;
    }
  }
  
  return {
    text: input,
    expressions: detailed,
    hasMath: detailed.length > 0
  };
}

/**
 * Extract all math expressions found in text
 * Handles: equations, expressions with operators, functions, variables
 */
function extractAllMathExpressions(text) {
  const expressions = [];
  
  // Pattern 1: Complete equations (with = sign)
  const equationPattern = /[a-zA-Z0-9\(\)\[\]\{\}\+\-\*\/\^\.]+\s*=\s*[a-zA-Z0-9\(\)\[\]\{\}\+\-\*\/\^\.]+/g;
  let match;
  
  // Get equations
  while ((match = equationPattern.exec(text)) !== null) {
    const expr = match[0].trim();
    if (isValidMathExpression(expr) && !expressions.includes(expr)) {
      expressions.push(expr);
    }
  }
  
  // Pattern 2: Math functions like sin(x), log(3x), sqrt(x+y)
  const functionPattern = /\b(sin|cos|tan|sec|csc|cot|log|ln|exp|sqrt|int|sum|lim|sqrt|abs|floor|ceil)\s*\([^)]*\)/gi;
  while ((match = functionPattern.exec(text)) !== null) {
    const expr = match[0].trim();
    if (isValidMathExpression(expr) && !expressions.includes(expr)) {
      expressions.push(expr);
    }
  }
  
  // Pattern 3: Powers and exponents (x^2, 2^n, etc.)
  const powerPattern = /([a-zA-Z0-9\]\)])\s*\^\s*([a-zA-Z0-9\(\[\]]+)/g;
  while ((match = powerPattern.exec(text)) !== null) {
    const expr = match[0].trim();
    if (isValidMathExpression(expr) && !expressions.includes(expr)) {
      expressions.push(expr);
    }
  }
  
  // Pattern 4: Fractions and divisions
  const fractionPattern = /\b([a-zA-Z0-9\)]+)\s*\/\s*([a-zA-Z0-9\(]+)\b/g;
  while ((match = fractionPattern.exec(text)) !== null) {
    const expr = match[0].trim();
    if (isValidMathExpression(expr) && !expressions.includes(expr)) {
      expressions.push(expr);
    }
  }
  
  // Pattern 5: Polynomials and expressions (2x, 3y, x+y, etc.)
  const polynomialPattern = /(?:^|[\s\(\[,])((?:[\d\.]*[a-zA-Z]{1,3}(?:\^[\d])?(?:\s*[\+\-\*/]\s*[\d\.]*[a-zA-Z]?(?:\^[\d])?)*))(?:[\s\)\],]|$)/g;
  while ((match = polynomialPattern.exec(text)) !== null) {
    const expr = match[1].trim();
    if (expr && isValidMathExpression(expr) && !expressions.includes(expr)) {
      expressions.push(expr);
    }
  }
  
  // Pattern 6: Single variables or simple terms with numbers
  const simpleVarPattern = /\b([0-9]*[a-zA-Z]{1,2}(?:\^[0-9]+)?|[0-9]+(?:\.[0-9]+)?)\b/g;
  while ((match = simpleVarPattern.exec(text)) !== null) {
    const expr = match[0].trim();
    // Only include if it looks like math (not a common word)
    if (expr && !isCommonWord(expr) && isValidMathExpression(expr) && !expressions.includes(expr)) {
      expressions.push(expr);
    }
  }
  
  // Sort by length (longer = more specific) and remove duplicates
  return [...new Set(expressions)].sort((a, b) => b.length - a.length);
}

/**
 * Check if a character is part of a mathematical expression
 */
function isMathCharacter(char, nextChar = '') {
  if (/\d/.test(char)) return true;
  if (/[+\-*/^=<>×÷]/.test(char)) return true;
  if (/[()\[\]{}]/.test(char)) return true;
  if (/[a-zA-Z]/.test(char)) return true; // variables
  if (/[θαβπλμωΔΩ√∫∑∞≤≥≠]/.test(char)) return true;
  if (char === '.' && /\d/.test(nextChar)) return true;
  if (char === '_') return true;
  if (char === '\\') return true;
  return false;
}

/**
 * Identify the type of math expression
 */
function identifyMathType(expr) {
  if (/\s*=\s*/.test(expr)) return 'equation';
  if (/\^/.test(expr)) return 'exponent';
  if (/\(.*\)/.test(expr) && /sin|cos|tan|log|sqrt|f\(/i.test(expr)) return 'function';
  if (/\//.test(expr)) return 'fraction';
  if (/[a-zA-Z]/.test(expr) && /[+\-*/]/.test(expr)) return 'polynomial';
  if (/\d/.test(expr) && /[a-zA-Z]/.test(expr)) return 'term';
  if (/^[a-zA-Z]$/.test(expr.trim())) return 'variable';
  if (/^\d+(\.\d+)?$/.test(expr.trim())) return 'number';
  return 'expression';
}

/**
 * Check if expression is a common natural language word (filter out false positives)
 */
function isCommonWord(word) {
  const commonWords = [
    'is', 'be', 'to', 'of', 'in', 'a', 'an', 'the', 'and', 'or', 'but', 'not', 'no',
    'if', 'then', 'what', 'how', 'why', 'when', 'where', 'who', 'which', 'that', 'this',
    'as', 'with', 'for', 'by', 'from', 'at', 'on', 'up', 'it', 'me', 'he', 'she', 'we',
    'them', 'their', 'has', 'have', 'do', 'does', 'did', 'will', 'would', 'could', 'can',
    'help', 'show', 'find', 'solve', 'calculate', 'please', 'thanks', 'hi', 'hello'
  ];
  return commonWords.includes(word.toLowerCase());
}

/**
 * Validate if a string is a valid math expression
 */
export function isValidMathExpression(expr) {
  if (!expr || typeof expr !== 'string') return false;
  
  const trimmed = expr.trim();
  if (trimmed.length === 0) return false;
  if (isCommonWord(trimmed)) return false;
  
  // Must contain at least one math element
  const hasMathElement = (
    /[+\-*/^=()<>×÷]/.test(trimmed) || 
    /\d/.test(trimmed) ||
    /\b(sin|cos|tan|sec|csc|cot|log|ln|exp|sqrt|int|sum|lim|abs|floor|ceil)\b/i.test(trimmed) ||
    /[a-zA-Z]/.test(trimmed) // variable
  );
  
  if (!hasMathElement) return false;
  
  // Reject pure operators
  if (/^[+\-*/^=<>×÷]+$/.test(trimmed)) return false;
  
  return true;
}

/**
 * Get the primary/longest math expression from input
 * Useful for single-query scenarios
 */
export function getPrimaryMathExpression(input) {
  const expressions = extractMathExpression(input);
  return expressions.length > 0 ? expressions[0] : null;
}