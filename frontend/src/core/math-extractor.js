// core/math-extractor.js

/**
 * Extract math expression from natural language input
 * Handles: "solvex^2", "2xsin(30)", "x^2log(3x)"
 */
export function extractMathExpression(input) {
  if (!input || typeof input !== 'string') return '';
  
  const normalized = input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Find longest contiguous math sequence
  const mathSequence = findLongestMathSequence(normalized);
  if (mathSequence) {
    return mathSequence;
  }
  
  // Fallback: command pattern
  const cmdMatch = normalized.match(
    /\b(solve|factor|simplify|expand|differentiate|find|calculate|compute|evaluate|show|prove)\s+(.+)/i
  );
  if (cmdMatch) {
    return cmdMatch[2].trim();
  }
  
  return normalized;
}

function findLongestMathSequence(text) {
  let bestSequence = '';
  let currentSequence = '';
  let inMathSequence = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1] || '';
    const isMathChar = isMathCharacter(char, nextChar);
    
    if (isMathChar) {
      currentSequence += char;
      inMathSequence = true;
    } else {
      if (inMathSequence && isValidMathSequence(currentSequence)) {
        if (currentSequence.length > bestSequence.length) {
          bestSequence = currentSequence;
        }
      }
      currentSequence = '';
      inMathSequence = false;
    }
  }
  
  if (inMathSequence && isValidMathSequence(currentSequence)) {
    if (currentSequence.length > bestSequence.length) {
      bestSequence = currentSequence;
    }
  }
  
  return bestSequence;
}

function isMathCharacter(char, nextChar = '') {
  if (/\d/.test(char)) return true;
  if (/[+\-*/^=<>]/.test(char)) return true;
  if (/[()\[\]{}]/.test(char)) return true;
  if (/[xyztuvw]/i.test(char)) return true;
  if (/[θαβπλμωΔΩ]/.test(char)) return true;
  if (/[√∫∑∞×÷≤≥≠]/.test(char)) return true;
  if (char === '.' && /\d/.test(nextChar)) return true;
  if (char === '_') return true;
  if (char === '\\') return true;
  return false;
}

function isValidMathSequence(sequence) {
  if (!sequence || sequence.length === 0) return false;
  
  const hasMath = (
    /[+\-*/^=()<>]/.test(sequence) || 
    /\d/.test(sequence) ||
    /\b(sin|cos|tan|log|ln|exp|sqrt|int|sum|lim|sec|csc|cot)\b/i.test(sequence) ||
    /[xyztuvwθαβπλμω]/i.test(sequence)
  );
  
  if (!hasMath) return false;
  
  const pureNL = /^(what|is|the|value|of|find|solve|for|when|help|please|thanks|show|prove|with|me|it|and|or|but|this|that)$/i;
  if (pureNL.test(sequence.trim())) return false;
  
  if (/^[+\-*/^=<>]+$/.test(sequence)) return false;
  
  return true;
}

export function isValidMathExpression(expr) {
  if (!expr || typeof expr !== 'string') return false;
  
  return (
    expr.length >= 1 &&
    (
      /[+\-*/^=()<>]/.test(expr) || 
      /\d/.test(expr) ||
      /\b(sin|cos|tan|log|ln|exp|sqrt|int|sum|lim|sec|csc|cot)\b/i.test(expr) ||
      /[xyztuvwθαβπλμω]/i.test(expr)
    ) &&
    !/^(hello|hi|help|please|thanks|what|how|why|when|where|who|is|are|am|was|were|the|a|an|show|prove|with|me|it|and|or|but|this|that)$/i.test(expr.trim())
  );
}