// App State
let messages = [];
let loading = false;
let smartRanges = [];
let prevInputValue = '';
let suggestionContext = { start: 0, end: 0 };
// let currentUserID = null;
let inputMethod = 'typing';
let usedSuggestion = false;
let suppressSuggestionForValue = '';

// Configuration
const API_BASE_URL = 'http://localhost:5000'; // Update with your backend URL

function goHome(){
  window.location.href = `${API_BASE_URL}/`;
}

function goLogin() {
  window.location.href = `${API_BASE_URL}/login`;
}

function goLogout() {
  window.location.href = `${API_BASE_URL}/login`;
}

function goDashboard() {
  window.location.href = `${API_BASE_URL}/dashboard`;
}

function goChat() {
  window.location.href = `${API_BASE_URL}/`;
}
function goImage() {
  window.location.href = `${API_BASE_URL}/image`;
}

function lockChat() {
  const questionInput = document.getElementById('questionInput');
  const sendBtn = document.getElementById('submitBtn');

  if (!questionInput || !sendBtn) return;

  questionInput.disabled = true;
  sendBtn.disabled = true;

  questionInput.setAttribute(
    'placeholder',
    '\\text{Please log in to get started}'
  );
}

function unlockChat() {
  const questionInput = document.getElementById('questionInput');
  const sendBtn = document.getElementById('submitBtn');

  if (!questionInput || !sendBtn) return;

  questionInput.disabled = false;
  sendBtn.disabled = false;
  questionInput.setAttribute(
    'placeholder',
    '\\text{Ask your math question... (e.g. 1/2, sin x, x^2)}'
  );
}

async function checkAuthStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/me`, {
      credentials: 'include'
    });
    const data = await res.json();
    console.log('API /api/me response:', data);

    if (!data.logged_in) {
      // User is not logged in: show login button, hide logout/dashboard and lock chat
      const logoutEl = document.getElementById('logoutButton');
      const dashEl = document.getElementById('dashboardButton');
      const authEl = document.getElementById('authButtons');

      if (logoutEl) logoutEl.style.display = 'none';
      if (dashEl) dashEl.style.display = 'none';
      if (authEl) authEl.style.display = 'block';

      lockChat();
    } else {
      // Logged in: hide auth buttons, show logout and enable chat
      const authEl = document.getElementById('authButtons');
      const logoutEl = document.getElementById('logoutButton');
      const dashEl = document.getElementById('dashboardButton');

      if (authEl) authEl.style.display = 'none';
      if (logoutEl) logoutEl.style.display = 'block';
      unlockChat();

      // Show dashboard only for admin
      if (data.role === 'admin') {
        if (dashEl) dashEl.style.display = 'block';
      } else {
        if (dashEl) dashEl.style.display = 'none';
      }

      console.log("Logged in as user ID:", data.user_id);
      // currentUserID = data.user_id;
    }
  } catch (error) {
    // If auth check fails (network/server), keep chat locked for safety and show login
    console.warn('Auth check failed, leaving chat locked until login:', error);
    try { document.getElementById('authButtons').style.display = 'block'; } catch {}
    lockChat();
  }
}

window.addEventListener('load', checkAuthStatus);

async function goLogout() {
  await fetch(`${API_BASE_URL}/logout`, {
    method: 'POST',
    credentials: 'include'
  });

  window.location.reload();
}

//////////////////////////////////////////////////////////////////////////////////////////////
// USE CASE 1
//////////////////////////////////////////////////////////////////////////////////////////////

// DOM Elements
const messagesContainer = document.getElementById('messagesContainer');
const welcomeMessage = document.getElementById('welcomeMessage');
const questionForm = document.getElementById('questionForm');
const suggestionList = document.getElementById('suggestionList');
const submitBtn = document.getElementById('submitBtn');
const responseMessage = document.getElementById('responseMessage');

// feedback elements will be queried when needed (in case DOM wasn't ready at script execution)
// helpers to retrieve them lazily
function getFeedbackContainer() { return document.getElementById('suggestionFeedbackUI'); }
function getFeedbackUpBtn() { return document.getElementById('suggestionUpBtn'); }
function getFeedbackDownBtn() { return document.getElementById('suggestionDownBtn'); }


// MathLive element
let questionInput = null;
let mathFieldReady = false;

// Character Maps
const SUPERSCRIPT_MAP = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ', 'i': 'ⁱ'
};

const GREEK_MAP = {
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
  '\\Delta': 'Δ', '\\theta': 'θ', '\\lambda': 'λ', '\\mu': 'μ',
  '\\omega': 'ω', '\\Omega': 'Ω', '\\pi': 'π', '\\subseteq': '⊆',
  '\\supseteq': '⊇'
};

// Utility Functions
function toSuperscriptText(text) {
  return text.split('').map(ch => SUPERSCRIPT_MAP[ch] || ch).join('');
}

function applySuperscriptForInsert(text) {
  return text.replace(/\^\{([^}]+)\}|\^([A-Za-z0-9+\-=()])/g, (match, braced, simple) => {
    const content = braced || simple || '';
    return toSuperscriptText(content);
  });
}

function latexToSmartText(latex) {
  let text = normalizeMathLiveArtifacts(latex);

  text = text.replace(/\\left\|/g, '|').replace(/\\right\|/g, '|');
  text = text.replace(/\\text\{([^}]*)\}/g, '$1');

  // Handle fractions
  const replaceFrac = () => {
    const next = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2');
    const changed = next !== text;
    text = next;
    return changed;
  };
  while (replaceFrac()) {}

  // Roots
  text = text.replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, (match, idx, radicand) => {
    if (idx === '3') return `∛${radicand}`;
    if (idx === '4') return `∜${radicand}`;
    return `√[${idx}]${radicand}`;
  });
  text = text.replace(/\\sqrt\{([^}]+)\}/g, '√$1');

  // Logarithms
  text = text.replace(/\\log_\{([^}]+)\}\(([^)]+)\)/g, 'log_$1($2)');
  text = text.replace(/\\log_\{([^}]+)\}/g, 'log_$1');
  text = text.replace(/\\ln\(([^)]+)\)/g, 'ln($1)');

  // Trig functions
  text = text.replace(/\\sin/g, 'sin');
  text = text.replace(/\\cos/g, 'cos');
  text = text.replace(/\\tan/g, 'tan');
  text = text.replace(/\\sec/g, 'sec');
  text = text.replace(/\\csc/g, 'csc');
  text = text.replace(/\\cot/g, 'cot');

  // Vectors
  text = text.replace(/\\overrightarrow\{([^}]+)\}/g, '$1⃗');

  // Operators
  text = text.replace(/\\times/g, '×');
  text = text.replace(/\\leq/g, '≤');
  text = text.replace(/\\geq/g, '≥');
  text = text.replace(/\\neq/g, '≠');
  text = text.replace(/\\pm/g, '±');
  text = text.replace(/\\infty/g, '∞');
  text = text.replace(/\\cup/g, '∪');
  text = text.replace(/\\cap/g, '∩');
  text = text.replace(/\\approx/g, '≈');

  // Integrals and Sums
  text = text.replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, '∫_$1^$2');
  text = text.replace(/\\int_\{\}\^\{\}/g, '∫');
  text = text.replace(/\\int/g, '∫');
  text = text.replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, '∑_$1^$2');
  text = text.replace(/\\sum/g, '∑');

  // Greek letters
  for (const [latexCmd, symbol] of Object.entries(GREEK_MAP)) {
    text = text.split(latexCmd).join(symbol);
  }

  text = text.replace(/\\,/g, ' ');
  text = text.replace(/\{([^}]*)\}/g, '$1');

  text = applySuperscriptForInsert(text);

  return text;
}

function cleanInsertedText(s) {
  return String(s)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLatexForOverlay(latex) {
  return latex
    .replace(/\\sin/g, '\\mathrm{sin}')
    .replace(/\\cos/g, '\\mathrm{cos}')
    .replace(/\\tan/g, '\\mathrm{tan}')
    .replace(/\\log/g, '\\mathrm{log}')
    .replace(/\\ln/g, '\\mathrm{ln}');
}

function normalizeMathLiveArtifacts(value) {
  return String(value ?? '')
    .replace(/\\textasciicircum/g, '^')
    .replace(/\\textasteriskcentered/g, '*')
    .replace(/\\ast\b/g, '*')
    .replace(/\\cdot(?!s)/g, '*')
    .replace(/\\times/g, '*')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '');
}

function normalizeToLatex(input) {
  let s = normalizeMathLiveArtifacts(input);

  // Logs
  s = s.replace(/\blog\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/g, '\\log_{$1}($2)');
  s = s.replace(/\blog_([A-Za-z0-9]+)\s*\(\s*([^)]+)\s*\)/g, '\\log_{$1}($2)');
  s = s.replace(/\blog([A-Za-z0-9]+)\s*\(\s*([^)]+)\s*\)/g, '\\log_{$1}($2)');
  s = s.replace(/\blog_([A-Za-z0-9]+)\b/g, '\\log_{$1}');
  s = s.replace(/\blog([A-Za-z0-9]+)\b/g, '\\log_{$1}');
  s = s.replace(/\blog\b/g, '\\log');

  // Fractions
  s = s.replace(
    /(^|[^A-Za-z0-9/])(\([^)]+\)|[A-Za-z0-9]+)\s*\/\s*(\([^)]+\)|[A-Za-z0-9]+)(?=$|[^A-Za-z0-9/])/g,
    '$1\\frac{$2}{$3}'
  );

  return s;
}

function normalizeSuggestionLatex(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('\\')) return raw;

  if (typeof window.mathToLatex === 'function') {
    try {
      const normalized = String(window.mathToLatex(raw) ?? '').trim();
      if (normalized) return normalized;
    } catch {
      // Fall back to local normalizer
    }
  }

  return normalizeToLatex(raw);
}

function renderMixedTextMath(rawText, bubbleDiv) {
  const raw = normalizeMathLiveArtifacts(rawText);
  const trimmed = raw.trim();
  if (!trimmed) {
    bubbleDiv.textContent = raw;
    return;
  }

  const cleaned = trimmed
    .replace(/\\\$/g, ' ')
    .replace(/\$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalized = normalizeToLatex(preservePlainTextSegments(cleaned));

  try {
    katex.render(normalized, bubbleDiv, {
      throwOnError: false,
      displayMode: false
    });

    if (bubbleDiv.querySelector('.katex-error')) {
      bubbleDiv.textContent = cleaned || raw;
    }
  } catch {
    bubbleDiv.textContent = cleaned || raw;
  }
}

function getInputTextValue() {
  if (!questionInput) return '';

  // Avoid calling unsupported formats on MathLive (some builds throw
  // "Unexpected format \"text\"" inside their internals). Instead
  // rely on LaTeX output which is stable across versions and convert
  // it to a readable/plain form for our suggestion pipeline.
  try {
    const latexValue = questionInput.getValue();
    return latexToSmartText(latexValue || '');
  } catch (e) {
    // If MathLive changed API or the field isn't ready, return empty.
    return '';
  }
}

// Message Rendering
function createMessageElement(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${message.role}`;

  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'message-bubble';

  if (message.role === 'user') {
    renderMixedTextMath(message?.text, bubbleDiv);
  } else if (message.role === 'loading') {
    bubbleDiv.textContent = message.text;
  } else {
    bubbleDiv.textContent = message.text;
  }

  messageDiv.appendChild(bubbleDiv);
  return messageDiv;
}

function addMessage(message) {
  messages.push(message);
  
  if (welcomeMessage && welcomeMessage.parentNode) {
    welcomeMessage.style.display = 'none';
  }

  const messageElement = createMessageElement(message);
  messagesContainer.appendChild(messageElement);
  scrollToBottom();
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showResponseStatus(type, message) {
  responseMessage.className = `response-message ${type}`;
  responseMessage.textContent = message;
  responseMessage.style.display = 'block';

  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      responseMessage.style.display = 'none';
    }, 3000);
  }
}

// Initialize MathLive when DOM is ready
function initializeMathField() {
  questionInput = document.getElementById('questionInput');
  
  if (!questionInput) {
    console.error('MathField not found');
    return;
  }
  
  mathFieldReady = true;

  // Keep input disabled until authentication is confirmed.
  
  // Configure MathLive - smart mode is set via HTML attribute
  questionInput.mathVirtualKeyboardPolicy = 'manual';

  // In smart mode, MathLive can treat a plain 'x' as a multiplication shortcut.
  // Keep 'x' as a variable when the user types it.
  try {
    const existingShortcuts = questionInput.inlineShortcuts || {};
    questionInput.inlineShortcuts = {
      ...existingShortcuts,
      x: 'x',
      X: 'X'
    };
  } catch {
    // Ignore if inlineShortcuts is not supported in this MathLive build
  }
  
  // Handle input changes for suggestions
  questionInput.addEventListener('input', () => {
    handleInputChange();
  });
  
  console.log('MathLive field initialized with smart mode');
}

// Wait for page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeMathField);
} else {
  initializeMathField();
}

// Form Submission
async function handleSubmitQuestion(e) {
  e.preventDefault();

  if (!questionInput || !mathFieldReady) {
    console.error('MathField not ready');
    return;
  }

  const rawQuestion = questionInput.getValue('latex-expanded').trim();
  const question = normalizeMathLiveArtifacts(rawQuestion).trim();
  
  if (!question) {
    showResponseStatus('error', 'Please enter a math question');
    return;
  }
  
  // Add user message
  addMessage({ text: question, role: 'user' });
  
  // Clear input
  questionInput.setValue('');
  smartRanges = [];
  prevInputValue = '';

  // Set loading state
  loading = true;
  submitBtn.disabled = true;
  questionInput.disabled = true;
  showResponseStatus('loading', 'Processing your question...');

  // Add loading message
  const loadingMsgIndex = messages.length;
  addMessage({ text: 'Thinking...', role: 'loading' });

  try {
    const response = await fetch(`${API_BASE_URL}/api/questions`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        question: question,
        input_method: inputMethod,
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Remove loading message
    messages.splice(loadingMsgIndex, 1);
    messagesContainer.removeChild(messagesContainer.lastChild);

    if (data.success) {
      addMessage({ text: data.answer, role: 'assistant' });
      showResponseStatus('success', '✅ Response received!');
    } else {
      throw new Error(data.error || 'Failed to get response');
    }
  } catch (error) {
    console.error('Error:', error);
    
    // Remove loading message
    if (messages[loadingMsgIndex] && messages[loadingMsgIndex].role === 'loading') {
      messages.splice(loadingMsgIndex, 1);
      messagesContainer.removeChild(messagesContainer.lastChild);
    }
    
    addMessage({ text: 'Sorry, I encountered an error. Please try again.', role: 'assistant' });
    showResponseStatus('error', 'Error: ' + error.message);
  } finally {
    loading = false;
    submitBtn.disabled = false;
    questionInput.disabled = false;
    questionInput.focus();
    inputMethod = 'typing';
    usedSuggestion = false;
  }
}

// Input Change Handler
function getTextChange(prevValue, nextValue) {
  if (prevValue === nextValue) return null;

  let start = 0;
  const prevLen = prevValue.length;
  const nextLen = nextValue.length;

  while (start < prevLen && start < nextLen && prevValue[start] === nextValue[start]) {
    start += 1;
  }

  let prevEnd = prevLen - 1;
  let nextEnd = nextLen - 1;
  while (prevEnd >= start && nextEnd >= start && prevValue[prevEnd] === nextValue[nextEnd]) {
    prevEnd -= 1;
    nextEnd -= 1;
  }

  const removedCount = Math.max(0, prevEnd - start + 1);
  const addedCount = Math.max(0, nextEnd - start + 1);

  return { start, removedCount, addedCount };
}

function updateSmartRanges(prevValue, nextValue) {
  const change = getTextChange(prevValue, nextValue);
  if (!change) return smartRanges;

  const { start, removedCount, addedCount } = change;
  const delta = addedCount - removedCount;

  return smartRanges
    .map((range) => {
      if (range.end <= start) return range;
      if (range.start >= start + removedCount) {
        return {
          ...range,
          start: range.start + delta,
          end: range.end + delta
        };
      }
      return null;
    })
    .filter(Boolean);
}

function handleInputChange() {
  if (!questionInput || !mathFieldReady) return;

  if (!usedSuggestion){
    inputMethod = 'typing';
  }
  
  // Get LaTeX representation - our rules now match LaTeX format
  const latexValue = questionInput.getValue();
  const textValue = getInputTextValue();
  const searchValue = textValue;
  const normalizedSearchValue = String(searchValue || '').replace(/\s+/g, '');

  if (suppressSuggestionForValue && normalizedSearchValue === suppressSuggestionForValue) {
    hideSuggestions();
    return;
  }
  if (suppressSuggestionForValue && normalizedSearchValue !== suppressSuggestionForValue) {
    suppressSuggestionForValue = '';
  }
  
  console.log('LaTeX value:', latexValue); // Debug
  console.log('Search value:', searchValue); // Debug
  
  const caret = searchValue.length;

  smartRanges = updateSmartRanges(prevInputValue, searchValue);
  prevInputValue = searchValue;

  renderOverlay();

  // Extract the current word/phrase for suggestions
  // Match more characters including backslash for LaTeX commands
  const mathSymbolRegex = /[A-Za-z0-9_\\^/+\-*(),{}<>=!|√∛∜×·⋅≤≥≠±∞∪∩≈∫∑⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ⃗αβγδΔθλμωΩπ'"]/;
  const isChar = (ch) => mathSymbolRegex.test(ch);

  // Get current word/phrase
  let start = caret;
  let end = caret;
  while (start > 0 && isChar(searchValue[start - 1])) start -= 1;
  while (end < searchValue.length && isChar(searchValue[end])) end += 1;
  
  let query = searchValue.slice(start, end).trim();
  const queryText = latexToSmartText(query);
  
  // Clean query from placeholders and empty groups to ensure better matching
  // This allows "log\placeholder" to match the "log" rule
  // Also remove trailing subscripts/superscripts that might be artifacts of smart mode
  query = query.replace(/\\placeholder(\{[^}]*\})?/g, '')
               .replace(/\{\}/g, '')
               .replace(/[_^]$/, ''); // Remove dangling subscript/superscript indicators

  // MathLive builds structured constructs with placeholders (e.g. "\\sum_{...}^{...}").
  // For suggestions, we usually want to match the base command.
  if (query.startsWith('\\sum')) query = '\\sum';
  if (query.startsWith('\\int')) query = '\\int';
               
  // If query became empty or just backslash, check if we had content before
  if (query === '\\' || query === '') {
     // If we stripped everything, maybe just use the original without placeholder to be safe, 
     // or let it be empty (which will hide suggestions)
  }

  console.log('Query for suggestions:', query); // Debug

  if (query.length > 0) {
    // Extract the actual term used for suggestions (after operators)
    // Split on operators ONLY if they're at the top level (not inside parentheses)
    let queryTerm = query;
    let termStartOffset = 0;
    let queryTermText = latexToSmartText(queryTerm);

    const findLastTopLevelOperatorIndex = (expr) => {
      let depth = 0;
      let lastOperatorIndex = -1;
      for (let i = 0; i < expr.length; i++) {
        const char = expr[i];
        if (char === '(') {
          depth += 1;
          continue;
        }
        if (char === ')') {
          depth = Math.max(0, depth - 1);
          continue;
        }
        if (depth === 0) {
          if (char === '+' || char === '-') {
            const beforeOp = expr.substring(Math.max(0, i - 3), i).toLowerCase();
            const isInverseTrig = /(sin|cos|tan)$/.test(beforeOp) && char === '-' && expr[i + 1] === '1';
            if (!isInverseTrig) {
              lastOperatorIndex = i;
            }
            continue;
          }

          if (char === '*' || char === '/' || char === ',' || char === '=' || /\s/.test(char)) {
            if (char === '/') {
              const beforeSlash = expr.slice(0, i);
              const looksLikeTrigPiFraction = /(?:\\)?(sin|cos|tan|sec|csc|cot|cosec)\s*\d*(?:\\pi|π|pi)$/i.test(beforeSlash);
              if (looksLikeTrigPiFraction) {
                continue;
              }
            }
            lastOperatorIndex = i;
            continue;
          }

          const prevChar = i > 0 ? expr[i - 1] : '';
          const startsAlphaToken = /[A-Za-z\\]/.test(char);
          if (startsAlphaToken && prevChar === ')') {
            lastOperatorIndex = i - 1;
          }
        }
      }
      return lastOperatorIndex;
    };

    const findLastTopLevelTrigStart = (expr) => {
      const trigNames = ['cosec', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot'];
      let depth = 0;
      let lastTrigStart = -1;

      for (let i = 0; i < expr.length; i++) {
        const char = expr[i];
        if (char === '(') {
          depth += 1;
          continue;
        }
        if (char === ')') {
          depth = Math.max(0, depth - 1);
          continue;
        }
        if (depth !== 0) continue;

        const before = i > 0 ? expr[i - 1] : '';
        const atBoundary = i === 0 || /[\s+\-*/=,(]/.test(before) || before === ')';
        if (!atBoundary) continue;

        const remaining = expr.slice(i).toLowerCase();
        for (const name of trigNames) {
          if (remaining.startsWith(`\\${name}`) || remaining.startsWith(name)) {
            lastTrigStart = i;
            break;
          }
        }
      }

      return lastTrigStart;
    };
    
    const compactTrigExpression = /^(?:\\)?(sin|cos|tan|sec|csc|cot|cosec)(?!\s*\().+/i.test(query);
    const lastTopLevelOperatorIndex = findLastTopLevelOperatorIndex(query);
    const hasTopLevelPlusMinus = lastTopLevelOperatorIndex !== -1;

    if (!compactTrigExpression || hasTopLevelPlusMinus) {
      if (lastTopLevelOperatorIndex !== -1) {
        queryTerm = query.substring(lastTopLevelOperatorIndex + 1).trim();
        termStartOffset = lastTopLevelOperatorIndex + 1;
        queryTermText = latexToSmartText(queryTerm);
      }
    }

    const trailingTrigStart = findLastTopLevelTrigStart(query);
    if (trailingTrigStart !== -1) {
      const trailingTrigTerm = query.substring(trailingTrigStart).trim();
      const isCompactTrigAmbiguity = /^(?:\\)?(sin|cos|tan|sec|csc|cot|cosec)\s*\d*[a-zα-ω\\()]+\s*[+\-].+/i.test(trailingTrigTerm);
      const shouldPreferTrailingTrig = trailingTrigStart > termStartOffset || isCompactTrigAmbiguity;

      if (shouldPreferTrailingTrig) {
        queryTerm = trailingTrigTerm;
        termStartOffset = trailingTrigStart;
        queryTermText = latexToSmartText(queryTerm);
      }
    }
    
    // Match rules directly with LaTeX input (use extracted term, not full query)
    let suggestions = getLatexSuggestions(queryTerm).filter(s => {
      if (s === queryTerm) return false;
      if (searchValue.includes(s)) return false;
      return true;
    });

    const trigNames = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'cosec'];
    const alphaTail = (queryTermText || queryTerm || '').match(/[A-Za-z]+$/);
    const trigPrefix = alphaTail ? alphaTail[0].toLowerCase() : '';
    const typingTrigPrefix = trigPrefix && trigNames.some(name => name.startsWith(trigPrefix));

    if (typingTrigPrefix) {
      suggestions = suggestions.filter(s => /(?:^|\\)(sin|cos|tan|sec|csc|cot|cosec)\b/i.test(String(s)));
    }

    if (suggestions.length === 0 && typeof window.getLayer2Suggestions === 'function') {
      const layer2Input = queryText || textValue || query;
      const layer2Candidates = window.getLayer2Suggestions(layer2Input, {
        curriculum: 'o-level',
        maxSuggestions: 5
      });

      const layer2Latex = layer2Candidates
        .map(candidate => {
          const value = candidate.text || candidate.display || '';
          return window.mathToLatex ? window.mathToLatex(value) : value;
        })
        .filter(s => s && s !== query && !searchValue.includes(s));

      suggestions = [...new Set(layer2Latex)].slice(0, 5);
    }
    
    console.log('Suggestions found:', suggestions); // Debug

    if (suggestions.length > 0) {
      const rawStart = start + termStartOffset;
      const rawEnd = rawStart + queryTerm.length;
      const replaceableCharRegex = /[A-Za-z0-9_\\√∛∜α-ωΑ-Ωπθδλμσωβγ]/;
      let replaceStart = rawStart;
      let replaceEnd = rawEnd;

      while (replaceStart < replaceEnd && !replaceableCharRegex.test(searchValue[replaceStart] || '')) {
        replaceStart += 1;
      }
      while (replaceEnd > replaceStart && !replaceableCharRegex.test(searchValue[replaceEnd - 1] || '')) {
        replaceEnd -= 1;
      }

      if (replaceStart >= replaceEnd) {
        replaceStart = rawStart;
        replaceEnd = rawEnd;
      }

      // Update context to point to just the extracted term, not the full query
      suggestionContext = { 
        start: replaceStart,
        end: replaceEnd,
        query, 
        queryText,
        queryTerm,
        queryTermText
      };
      showSuggestions(suggestions);
    } else {
      hideSuggestions();
    }
  } else {
    hideSuggestions();
  }
}

function renderOverlay() {
  // MathLive handles its own rendering
}

function showSuggestions(suggestions) {
  suggestionList.innerHTML = '';

  const seen = new Set();
  const normalizedSuggestions = suggestions
    .map(normalizeSuggestionLatex)
    .filter((s) => {
      if (!s || seen.has(s)) return false;
      seen.add(s);
      return true;
    });
  
  normalizedSuggestions.forEach(latex => {
    const li = document.createElement('li');
    li.className = 'suggestion-item';
    
    try {
      katex.render(latex, li, {
        throwOnError: false,
        displayMode: false
      });
    } catch (e) {
      li.textContent = latex;
    }

    li.onclick = () => selectSuggestion(latex);
    suggestionList.appendChild(li);
  });

  suggestionList.style.display = 'block';
}

function hideSuggestions() {
  suggestionList.style.display = 'none';
}

function preservePlainTextSegments(value) {
  const source = String(value || '');
  if (!source) return source;

  const knownMathWords = new Set([
    'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'cosec',
    'asin', 'acos', 'atan', 'arcsin', 'arccos', 'arctan',
    'log', 'ln', 'sqrt', 'root', 'pi', 'theta',
    'alpha', 'beta', 'gamma', 'delta', 'lambda', 'mu', 'sigma', 'omega',
    'x', 'y', 'z'
  ]);

  let i = 0;
  let output = '';

  while (i < source.length) {
    const char = source[i];
    if (!/[A-Za-z]/.test(char)) {
      output += char;
      i += 1;
      continue;
    }

    const prevChar = i > 0 ? source[i - 1] : '';
    let j = i;
    while (j < source.length && /[A-Za-z]/.test(source[j])) j += 1;
    const token = source.slice(i, j);
    const lower = token.toLowerCase();

    let k = j;
    while (k < source.length && /\s/.test(source[k])) k += 1;
    const trailingWhitespace = source.slice(j, k);

    const isLatexCommandToken = prevChar === '\\';
    const shouldPreserveAsText = token.length > 2 && !knownMathWords.has(lower) && !isLatexCommandToken;
    if (shouldPreserveAsText) {
      output += `\\text{${token}${trailingWhitespace}}`;
    } else {
      output += token + trailingWhitespace;
    }

    i = k;
  }

  return output;
}

function selectSuggestion(latex) {

  if (!questionInput || !mathFieldReady) return;
  const suggestionLatex = normalizeSuggestionLatex(latex);
  
  inputMethod = 'suggestion';
  usedSuggestion = true;

  console.log(inputMethod, usedSuggestion);
  // Set the LaTeX value in MathLive

  const currentValue = getInputTextValue();
  const { replaceStart, replaceEnd } = computeSuggestionReplacementRange(suggestionLatex, currentValue);

  try {
    questionInput.defaultMode = 'text';
    questionInput.mode = 'text';
  } catch {
    // Ignore if mode APIs are not supported
  }

  const prefix = currentValue.slice(0, replaceStart || 0);
  let suffix = currentValue.slice(replaceEnd || 0);

  if (suggestionLatex.endsWith(')') && suffix.startsWith(')')) {
    const countParenBalance = (text) => {
      let balance = 0;
      for (const ch of String(text || '')) {
        if (ch === '(') balance += 1;
        if (ch === ')') balance -= 1;
      }
      return balance;
    };

    const balanceAfterInsert = countParenBalance(`${prefix}${suggestionLatex}`);
    if (balanceAfterInsert <= 0) {
      suffix = suffix.slice(1);
    }
  }

  const safePrefix = preservePlainTextSegments(prefix);
  const safeSuffix = preservePlainTextSegments(suffix);
  questionInput.setValue(`${safePrefix}${suggestionLatex}${safeSuffix}`);

  try {
    questionInput.defaultMode = 'text';
    questionInput.mode = 'text';
  } catch {
    // Ignore if mode APIs are not supported
  }

  hideSuggestions();
  
  // Show feedback UI so user can thumbs-up or thumbs-down the suggestion
  showSuggestionFeedbackUI(latex);

  // Reset suggestion-tracking state after programmatic insertion.
  // Some MathLive builds don't emit consistent input events for insert(),
  // which can leave suggestion extraction stale until another full edit cycle.
  prevInputValue = getInputTextValue();
  suppressSuggestionForValue = String(prevInputValue || '').replace(/\s+/g, '');
  smartRanges = [];

  requestAnimationFrame(() => {
    questionInput.focus();
    handleInputChange();
  });
}

function showSuggestionFeedbackUI(latex) {
  const container = getFeedbackContainer();
  const upBtn = getFeedbackUpBtn();
  const downBtn = getFeedbackDownBtn();
  console.log('showSuggestionFeedbackUI called – container:', container, 'upBtn:', upBtn, 'downBtn:', downBtn);
  if (!container || !upBtn || !downBtn) return;

  // reset buttons
  upBtn.disabled = downBtn.disabled = false;

  upBtn.onclick = async () => {
    removeSuggestionFeedbackUI();
    await sendSuggestionFeedback(latex, 1);
    showResponseStatus('success', 'Thanks for your feedback!');
  };

  downBtn.onclick = async () => {
    removeSuggestionFeedbackUI();
    await sendSuggestionFeedback(latex, 0);
    showResponseStatus('success', 'Thanks for your feedback!');
  };

  container.style.display = 'block';
}


function removeSuggestionFeedbackUI() {
  const container = getFeedbackContainer();
  if (container) {
    container.style.display = 'none';
  }
}

async function sendSuggestionFeedback(latex, rating) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/suggestion-feedback`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestion_text: latex, rating })
    });

    const data = await res.json();
    if (!data.success) {
      console.warn('Feedback not recorded:', data);
      showResponseStatus('error', 'Could not record feedback');
    }
  } catch (e) {
    console.error('Error sending suggestion feedback', e);
    showResponseStatus('error', 'Could not record feedback');
  } finally {
    // UI already hidden on click; no additional removal needed
  }
}

function computeSuggestionReplacementRange(latex, currentValue = '') {
  const start = suggestionContext.start || 0;
  const end = suggestionContext.end || 0;
  const queryText = suggestionContext.queryTermText || suggestionContext.queryText || '';
  const suggestionText = latexToSmartText(latex || '');

  const isTrigSuggestion = /^(sin|cos|tan|sec|csc|cot)\b/i.test(suggestionText);

  if (isTrigSuggestion && currentValue) {
    const trigNames = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'cosec'];
    const caret = currentValue.length;
    let tokenStart = caret;
    while (tokenStart > 0 && /[A-Za-z\\]/.test(currentValue[tokenStart - 1])) {
      tokenStart -= 1;
    }
    const rawToken = currentValue.slice(tokenStart, caret);
    const token = rawToken.replace(/^\\/, '').toLowerCase();
    if (token && trigNames.some(name => name.startsWith(token))) {
      return { replaceStart: tokenStart, replaceEnd: caret };
    }
  }

  // Preserve multiplicative prefixes like "3x" in "3xcos" by replacing only the trailing trig token.
  const trigSuffixMatch = queryText.match(/^(.*?)(sin|cos|tan|sec|csc|cot|cosec)$/i);
  if (isTrigSuggestion && trigSuffixMatch && trigSuffixMatch[1]) {
    const prefix = trigSuffixMatch[1];
    return { replaceStart: start + prefix.length, replaceEnd: end };
  }

  // Specific handling for trig functions with coefficients
  const coeffMatch = queryText.match(/^(\d+(?:\.\d+)?)(sin|cos|tan|sec|csc|cot)/i);
  if (coeffMatch && !/^\d/.test(suggestionText)) {
    const offset = coeffMatch[1].length;
    return { replaceStart: start + offset, replaceEnd: end };
  }

  return { replaceStart: start, replaceEnd: end };
}

// Event Listeners
questionForm.addEventListener('submit', handleSubmitQuestion);

// Close suggestions on click outside
document.addEventListener('click', (e) => {
  if (!suggestionList.contains(e.target) && e.target !== questionInput) {
    hideSuggestions();
  }
});

// ==================== Equation Scanner (inline modal) ====================
(function initScanner() {
  // Scanner state
  const scanner = {
    file: null,
    previewUrl: null,
    imageId: null,
    cropper: null,
    converting: false
  };

  // DOM refs (deferred until DOMContentLoaded)
  let modal, closeBtn, dropZone, fileInput, previewSection, previewImg;
  let convertBtn, cropBtn, loadingDiv, errorDiv, successDiv, warningsDiv;
  let resultSection, latexInput, latexPreview, insertBtn, retryBtn;
  let cropModal, cropImage, cropConfirm, cropCancel, cameraBtn;
  let rateUpBtn, rateDownBtn, ratingStatus;
  let originalLatex = ''; // store the raw conversion result for feedback

  function bindElements() {
    modal          = document.getElementById('scannerModal');
    closeBtn       = document.getElementById('scannerClose');
    dropZone       = document.getElementById('scannerDropZone');
    fileInput      = document.getElementById('scannerFileInput');
    previewSection = document.getElementById('scannerPreview');
    previewImg     = document.getElementById('scannerPreviewImage');
    convertBtn     = document.getElementById('scannerConvertBtn');
    cropBtn        = document.getElementById('scannerCropBtn');
    loadingDiv     = document.getElementById('scannerLoading');
    errorDiv       = document.getElementById('scannerError');
    successDiv     = document.getElementById('scannerSuccess');
    warningsDiv    = document.getElementById('scannerWarnings');
    resultSection  = document.getElementById('scannerResult');
    latexInput     = document.getElementById('scannerLatexInput');
    latexPreview   = document.getElementById('scannerLatexPreview');
    insertBtn      = document.getElementById('scannerInsertBtn');
    retryBtn       = document.getElementById('scannerRetryBtn');
    cropModal      = document.getElementById('scannerCropModal');
    cropImage      = document.getElementById('scannerCropImage');
    cropConfirm    = document.getElementById('scannerCropConfirm');
    cropCancel     = document.getElementById('scannerCropCancel');
    cameraBtn      = document.getElementById('cameraBtn');
    rateUpBtn      = document.getElementById('scannerRateUp');
    rateDownBtn    = document.getElementById('scannerRateDown');
    ratingStatus   = document.getElementById('scannerRatingStatus');
  }

  function wireEvents() {
    if (!modal) return;

    // Open / close
    cameraBtn.addEventListener('click', openScanner);
    closeBtn.addEventListener('click', closeScanner);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeScanner(); });

    // Upload
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFile);
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; handleFile(); }
    });

    // Actions
    convertBtn.addEventListener('click', handleConvert);
    cropBtn.addEventListener('click', handleCrop);
    insertBtn.addEventListener('click', handleInsert);
    retryBtn.addEventListener('click', resetScanner);

    // Live LaTeX preview while editing
    latexInput.addEventListener('input', updateScannerPreview);

    // Rating
    rateUpBtn.addEventListener('click', () => handleScanRating(1));
    rateDownBtn.addEventListener('click', () => handleScanRating(0));

    // Crop modal
    cropConfirm.addEventListener('click', applyCrop);
    cropCancel.addEventListener('click', closeCropModal);
    cropModal.addEventListener('click', (e) => { if (e.target === cropModal) closeCropModal(); });
  }

  // ---------- Open / Close ----------
  function openScanner() {
    resetScanner();
    modal.classList.add('active');
  }

  function closeScanner() {
    modal.classList.remove('active');
    closeCropModal();
  }

  function resetScanner() {
    scanner.file = null;
    scanner.imageId = null;
    if (scanner.previewUrl) URL.revokeObjectURL(scanner.previewUrl);
    scanner.previewUrl = null;
    scanner.converting = false;
    originalLatex = '';

    previewSection.style.display = 'none';
    resultSection.style.display = 'none';
    loadingDiv.style.display = 'none';
    hideMsg(errorDiv); hideMsg(successDiv); hideMsg(warningsDiv);
    dropZone.style.display = 'flex';
    fileInput.value = '';

    // Reset rating UI
    rateUpBtn.disabled = false;
    rateDownBtn.disabled = false;
    rateUpBtn.classList.remove('selected');
    rateDownBtn.classList.remove('selected');
    ratingStatus.textContent = '';
  }

  // ---------- File handling ----------
  function handleFile() {
    const file = fileInput.files?.[0];
    if (!file) return;

    const allowed = ['image/png','image/jpeg','image/jpg','image/gif','image/bmp'];
    if (!allowed.includes(file.type)) { showMsg(errorDiv, 'Invalid file type. Please upload an image.'); return; }
    if (file.size > 10 * 1024 * 1024) { showMsg(errorDiv, 'File too large. Max 10 MB.'); return; }

    scanner.file = file;
    scanner.previewUrl = URL.createObjectURL(file);
    scanner.imageId = null;

    previewImg.src = scanner.previewUrl;
    previewSection.style.display = 'block';
    resultSection.style.display = 'none';
    dropZone.style.display = 'none';
    hideMsg(errorDiv); hideMsg(successDiv); hideMsg(warningsDiv);
  }

  // ---------- Upload ----------
  async function uploadImage() {
    if (!scanner.file) return false;

    const sessionId = localStorage.getItem('flipaha_session_id') || ('session_' + Date.now());
    localStorage.setItem('flipaha_session_id', sessionId);

    const fd = new FormData();
    fd.append('file', scanner.file);
    fd.append('session_id', sessionId);

    try {
      const res = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      if (data.session_id) localStorage.setItem('flipaha_session_id', data.session_id);
      scanner.imageId = data.image_id;

      if (data.quality?.warnings?.length) {
        showMsg(warningsDiv, '⚠️ ' + data.quality.warnings.join(', '));
      }
      return true;
    } catch (err) {
      showMsg(errorDiv, err.message);
      return false;
    }
  }

  // ---------- Convert ----------
  async function handleConvert() {
    if (scanner.converting) return;

    const sessionId = localStorage.getItem('flipaha_session_id') || ('session_' + Date.now());
    localStorage.setItem('flipaha_session_id', sessionId);

    if (!scanner.imageId && scanner.file) {
      if (!(await uploadImage())) return;
    }
    if (!scanner.imageId) { showMsg(errorDiv, 'Please select an image first.'); return; }

    scanner.converting = true;
    loadingDiv.style.display = 'block';
    convertBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE_URL}/api/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          image_id: scanner.imageId,
          options: { high_accuracy: false, preprocess: 'auto' }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Conversion failed');

      // Show result editor
      originalLatex = data.latex || '';
      latexInput.value = originalLatex;
      updateScannerPreview();
      previewSection.style.display = 'none';
      resultSection.style.display = 'block';
      showMsg(successDiv, '✅ Equation extracted! Edit below then insert into chat.');

      // Log analytics
      try {
        await fetch(`${API_BASE_URL}/api/log-input-method`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input_method: 'image' })
        });
      } catch (_) { /* ignore */ }

    } catch (err) {
      showMsg(errorDiv, 'Error: ' + err.message);
    } finally {
      scanner.converting = false;
      loadingDiv.style.display = 'none';
      convertBtn.disabled = false;
    }
  }

  // ---------- Insert into chatbox ----------
  function handleInsert() {
    const latex = (latexInput.value || '').trim();
    if (!latex) { showMsg(errorDiv, 'Nothing to insert.'); return; }

    // Insert as rendered math (not raw text) at cursor position
    if (questionInput && mathFieldReady) {
      questionInput.focus();
      questionInput.insert(latex, {
        insertionMode: 'insertAfter',
        selectionMode: 'after',
        mode: 'math'
      });
      // Switch back to text mode so the user can keep typing
      questionInput.mode = 'text';
      inputMethod = 'image';
    }

    closeScanner();
  }

  // ---------- Scan rating feedback (frontend-only for now) ----------
  function handleScanRating(rating) {
    rateUpBtn.disabled = true;
    rateDownBtn.disabled = true;
    if (rating === 1) rateUpBtn.classList.add('selected');
    else rateDownBtn.classList.add('selected');

    // TODO: send to POST /api/scan-feedback when backend is ready
    console.log('Scan feedback:', {
      original_latex: originalLatex,
      edited_latex: (latexInput.value || '').trim(),
      rating: rating
    });

    ratingStatus.textContent = 'Thanks for your feedback!';
  }

  // ---------- LaTeX preview ----------
  function updateScannerPreview() {
    const raw = (latexInput.value || '').trim();
    if (!raw) { latexPreview.innerHTML = '<span style="color:#999">Preview will appear here</span>'; return; }

    try {
      let expr = raw;
      // Strip delimiters
      if (expr.startsWith('$$') && expr.endsWith('$$')) expr = expr.slice(2, -2).trim();
      else if (expr.startsWith('$') && expr.endsWith('$')) expr = expr.slice(1, -1).trim();

      if (window.katex) {
        latexPreview.innerHTML = '';
        katex.render(expr, latexPreview, { throwOnError: false, displayMode: true });
      } else {
        latexPreview.textContent = expr;
      }
    } catch { latexPreview.textContent = raw; }
  }

  // ---------- Crop ----------
  function handleCrop() {
    if (!scanner.previewUrl) return;

    // Lazy-load Cropper.js
    if (!window.Cropper) {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.js';
      s.onload = initCropper;
      document.body.appendChild(s);
    } else {
      initCropper();
    }
  }

  function initCropper() {
    cropImage.src = scanner.previewUrl;
    cropModal.classList.add('active');
    cropImage.onload = () => {
      if (scanner.cropper) scanner.cropper.destroy();
      scanner.cropper = new Cropper(cropImage, {
        aspectRatio: NaN,
        viewMode: 1,
        autoCropArea: 0.8,
        responsive: true,
        guides: true,
        background: false
      });
    };
  }

  function applyCrop() {
    if (!scanner.cropper) return;
    const canvas = scanner.cropper.getCroppedCanvas({ maxWidth: 4096, maxHeight: 4096, imageSmoothingQuality: 'high' });
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (scanner.previewUrl) URL.revokeObjectURL(scanner.previewUrl);
      scanner.previewUrl = URL.createObjectURL(blob);
      scanner.file = new File([blob], scanner.file?.name || 'cropped.png', { type: 'image/png' });
      scanner.imageId = null; // re-upload needed
      previewImg.src = scanner.previewUrl;
      closeCropModal();
      showMsg(successDiv, 'Image cropped!');
    }, 'image/png');
  }

  function closeCropModal() {
    cropModal.classList.remove('active');
    if (scanner.cropper) { scanner.cropper.destroy(); scanner.cropper = null; }
  }

  // ---------- Helpers ----------
  function showMsg(el, text) { if (!el) return; el.textContent = text; el.style.display = 'block'; }
  function hideMsg(el)       { if (!el) return; el.style.display = 'none'; }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bindElements(); wireEvents(); });
  } else {
    bindElements(); wireEvents();
  }
})();

// Initialize
console.log('FlipAha! app initialized')