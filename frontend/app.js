// App State
let messages = [];
let loading = false;
let smartRanges = [];
let prevInputValue = '';
let suggestionContext = { start: 0, end: 0 };
// let currentUserID = null;
let inputMethod = 'typing';
let usedSuggestion = false;

// Configuration
const API_BASE_URL = 'http://localhost:5000'; // Update with your backend URL

function goLogin() {
  window.location.href = `${API_BASE_URL}/login`;
}

function goDashboard() {
  window.location.href = `${API_BASE_URL}/dashboard`;
}

function lockChat() {
  const questionInput = document.getElementById('questionInput');
  const sendBtn = document.getElementById('submitBtn');

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
  questionInput.disabled = false;
  sendBtn.disabled = false;
  questionInput.setAttribute(
    'placeholder',
    '\\text{Ask your math question... (e.g. 1/2, sin x, x^2)}'
  );
}

async function checkAuthStatus() {
  const res = await fetch(`${API_BASE_URL}/api/me`, {
    credentials: 'include'
  });
  const data = await res.json();
  console.log('API /api/me response:', data);

  if (!data.logged_in) {
    document.getElementById('logoutButton').style.display = 'none';
    document.getElementById('dashboardButton').style.display = 'none';
    // lockChat()
    unlockChat(); // Added this for development without login, but show login button
  } else {
    document.getElementById('authButtons').style.display = 'none';
    document.getElementById('logoutButton').style.display = 'block';
    unlockChat();

    // Show dashboard only for admin
    if (data.role === 'admin') {
      document.getElementById('dashboardButton').style.display = 'block';
    } else {
      document.getElementById('dashboardButton').style.display = 'none';
    }

    console.log("Logged in as user ID:", data.user_id);
    // currentUserID = data.user_id;
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
  let text = latex;

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

function normalizeToLatex(input) {
  let s = input;

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
    const raw = String(message?.text ?? '');
    const mathText = raw.trim().replace(/^\$+/, '').replace(/\$+$/, '');
    const normalized = normalizeToLatex(mathText);
    
    try {
      katex.render(normalized, bubbleDiv, {
        throwOnError: false,
        displayMode: false
      });
    } catch (e) {
      bubbleDiv.textContent = raw;
    }
  } else if (message.role === 'loading') {
    bubbleDiv.textContent = message.text;
  } else {
    bubbleDiv.textContent = message.text;
    
    // Add copy button for assistant responses
    if (message.role === 'assistant' && message.text) {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'edit-latex-btn';
      copyBtn.textContent = '📋 Copy to Input';
      copyBtn.onclick = () => {
        if (questionInput && mathFieldReady) {
          questionInput.setValue(message.text);
          questionInput.focus();
        }
      };
      bubbleDiv.appendChild(copyBtn);
    }
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

  const question = questionInput.getValue('latex-expanded').trim();
  
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
        // use_suggestion: usedSuggestion ? 1 : 0,
        // accept_suggestion: 0
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
    
    // Check for unbalanced parentheses (incomplete expression like "sin(pi/6")
    const openParens = (query.match(/\(/g) || []).length;
    const closeParens = (query.match(/\)/g) || []).length;
    const hasUnbalancedParens = openParens !== closeParens;
    
    const compactTrigExpression = /^(?:\\)?(sin|cos|tan|sec|csc|cot|cosec)(?!\s*\().+/i.test(query);
    const hasTopLevelPlusMinus = (() => {
      let depth = 0;
      for (let i = 0; i < query.length; i++) {
        const char = query[i];
        if (char === '(') depth++;
        else if (char === ')') depth--;
        else if (depth === 0 && (char === '+' || char === '-')) {
          const beforeOp = query.substring(Math.max(0, i - 3), i).toLowerCase();
          const isInverseTrig = /(sin|cos|tan)$/.test(beforeOp) && char === '-' && query[i + 1] === '1';
          if (!isInverseTrig) return true;
        }
      }
      return false;
    })();

    if (!hasUnbalancedParens && (!compactTrigExpression || hasTopLevelPlusMinus)) {
      // Extract the last term after top-level operators (+, -)
      // Walk backwards to find the last operator outside parentheses
      let parenDepth = 0;
      let lastOperatorIndex = -1;
      
      for (let i = query.length - 1; i >= 0; i--) {
        const char = query[i];
        if (char === ')') parenDepth++;
        else if (char === '(') parenDepth--;
        else if (parenDepth === 0 && (char === '+' || char === '-')) {
          // Found top-level operator, but check it's not part of inverse trig (sin-1)
          const beforeOp = query.substring(Math.max(0, i - 3), i).toLowerCase();
          const isInverseTrig = /(sin|cos|tan)$/.test(beforeOp) && query[i] === '-' && query[i + 1] === '1';
          if (!isInverseTrig) {
            lastOperatorIndex = i;
            break;
          }
        }
      }
      
      if (lastOperatorIndex !== -1) {
        queryTerm = query.substring(lastOperatorIndex + 1).trim();
        termStartOffset = lastOperatorIndex + 1;
        queryTermText = latexToSmartText(queryTerm);
      }
    }
    
    // Match rules directly with LaTeX input (use extracted term, not full query)
    let suggestions = getLatexSuggestions(queryTerm).filter(s => {
      if (s === queryTerm) return false;
      if (searchValue.includes(s)) return false;
      return true;
    });

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
  
  suggestions.forEach(latex => {
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

function selectSuggestion(latex) {

  if (!questionInput || !mathFieldReady) return;
  
  inputMethod = 'suggestion';
  usedSuggestion = true;

  console.log(inputMethod, usedSuggestion);
  // Set the LaTeX value in MathLive

  const { replaceStart, replaceEnd } = computeSuggestionReplacementRange(latex);
  const deleteCount = Math.max(0, (replaceEnd || 0) - (replaceStart || 0));

  try {
    questionInput.defaultMode = 'text';
    questionInput.mode = 'text';
  } catch {
    // Ignore if mode APIs are not supported
  }

  try {
    if (typeof questionInput.executeCommand === 'function' && deleteCount > 0) {
      for (let i = 0; i < deleteCount; i += 1) {
        questionInput.executeCommand('deleteBackward');
      }
    }

    if (typeof questionInput.insert === 'function') {
      questionInput.insert(latex);
    } else {
      const currentValue = getInputTextValue();
      const prefix = currentValue.slice(0, replaceStart || 0);
      const suffix = currentValue.slice(replaceEnd || 0);
      questionInput.setValue(`${prefix}${latex}${suffix}`);
    }
  } catch {
    const currentValue = getInputTextValue();
    const prefix = currentValue.slice(0, replaceStart || 0);
    const suffix = currentValue.slice(replaceEnd || 0);
    questionInput.setValue(`${prefix}${latex}${suffix}`);
  }

  try {
    questionInput.defaultMode = 'text';
    questionInput.mode = 'text';
  } catch {
    // Ignore if mode APIs are not supported
  }

  hideSuggestions();

  // Reset suggestion-tracking state after programmatic insertion.
  // Some MathLive builds don't emit consistent input events for insert(),
  // which can leave suggestion extraction stale until another full edit cycle.
  prevInputValue = getInputTextValue();
  smartRanges = [];
  usedSuggestion = false;

  requestAnimationFrame(() => {
    questionInput.focus();
    handleInputChange();
  });
}

function computeSuggestionReplacementRange(latex) {
  const start = suggestionContext.start || 0;
  const end = suggestionContext.end || 0;
  const queryText = suggestionContext.queryTermText || suggestionContext.queryText || '';
  const suggestionText = latexToSmartText(latex || '');

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

// Initialize
console.log('FlipAha! app initialized');