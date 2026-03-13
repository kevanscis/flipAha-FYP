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
let lastShownSuggestions = [];   // track suggestions shown for ML feedback
let lastSuggestionQuery = '';    // track the raw input that triggered suggestions

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
  const cameraBtn = document.getElementById('cameraBtn');

  if (!questionInput || !sendBtn) return;

  sendBtn.disabled = true;

  // Lock camera button when not logged in
  if (cameraBtn) {
    cameraBtn.disabled = true;
    cameraBtn.classList.add('btn-locked');
    cameraBtn.title = 'Please log in to use the equation scanner';
  }

  questionInput.contentEditable = 'false';
  questionInput.classList.add('locked');
  questionInput.dataset.placeholder = 'Please log in to get started';
}

function unlockChat() {
  const questionInput = document.getElementById('questionInput');
  const sendBtn = document.getElementById('submitBtn');
  const cameraBtn = document.getElementById('cameraBtn');

  if (!questionInput || !sendBtn) return;

  sendBtn.disabled = false;

  // Unlock camera button when logged in
  if (cameraBtn) {
    cameraBtn.disabled = false;
    cameraBtn.classList.remove('btn-locked');
    cameraBtn.title = 'Scan equation from image';
  }

  questionInput.contentEditable = 'true';
  questionInput.classList.remove('locked');
  questionInput.dataset.placeholder = 'Ask your math question... (e.g. 1/2, sin x, x^2)';
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
      const histEl = document.getElementById('imageHistoryButton');

      if (logoutEl) logoutEl.style.display = 'none';
      if (dashEl) dashEl.style.display = 'none';
      if (authEl) authEl.style.display = 'block';
      if (histEl) histEl.style.display = 'none';

      // Clear any session_id so guests can't access user images
      localStorage.removeItem('flipaha_session_id');

      lockChat();
    } else {
      // Logged in: hide auth buttons, show logout and enable chat
      const authEl = document.getElementById('authButtons');
      const logoutEl = document.getElementById('logoutButton');
      const dashEl = document.getElementById('dashboardButton');
      const histEl = document.getElementById('imageHistoryButton');

      if (authEl) authEl.style.display = 'none';
      if (logoutEl) logoutEl.style.display = 'block';
      if (histEl) histEl.style.display = 'block';
      unlockChat();

      // Tie session_id to the logged-in user so image history is per-user
      const userSessionId = 'user_' + data.user_id;
      localStorage.setItem('flipaha_session_id', userSessionId);

      // Show dashboard only for admin
      if (data.role === 'admin') {
        if (dashEl) dashEl.style.display = 'block';
      } else {
        if (dashEl) dashEl.style.display = 'none';
      }

      console.log("Logged in as user ID:", data.user_id);
    }
  } catch (error) {
    // If auth check fails (network/server), keep chat locked for safety and show login
    console.warn('Auth check failed, leaving chat locked until login:', error);
    try { document.getElementById('authButtons').style.display = 'block'; } catch {}
    lockChat();
  }
}

window.addEventListener('load', checkAuthStatus);
// [DISABLED] window.addEventListener('load', loadSuggestionFeedbackScores);

async function goLogout() {
  // Clear user-specific session so image history is not accessible after logout
  localStorage.removeItem('flipaha_session_id');

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


// Input elements
let questionInput = null;   // the contenteditable div
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

  // Degree: ^{\circ} → ° (must be before brace stripping)
  text = text.replace(/\^\{\\circ\}/g, '°');
  text = text.replace(/\^\\circ/g, '°');
  text = text.replace(/\\circ/g, '°');

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

/**
 * Convert LaTeX to clean, readable plain text for the input field.
 * e.g. "x^{3}" → "x^3", "\\frac{1}{2}" → "1/2", "\\sin(x)" → "sin(x)"
 */
function latexToReadableText(latex) {
  let text = String(latex || '');
  // Remove \left and \right
  text = text.replace(/\\left/g, '').replace(/\\right/g, '');
  // Fractions: \frac{a}{b} → a/b
  const replaceFrac = () => {
    const next = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2');
    const changed = next !== text;
    text = next;
    return changed;
  };
  while (replaceFrac()) {}
  // Roots: \sqrt{x} → sqrt(x), \sqrt[n]{x} → sqrt[n](x)
  text = text.replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, 'sqrt[$1]($2)');
  text = text.replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)');
  // Remove backslash from known functions
  text = text.replace(/\\(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|log|ln)\b/g, '$1');
  // Greek: \pi → pi, \theta → theta, etc.
  text = text.replace(/\\(pi|theta|alpha|beta|gamma|delta|lambda|mu|omega|sigma|infty)\b/g, '$1');
  // Operators
  text = text.replace(/\\times/g, '*').replace(/\\cdot/g, '*');
  text = text.replace(/\\pm/g, '+-');
  text = text.replace(/\\leq/g, '<=').replace(/\\geq/g, '>=');
  text = text.replace(/\\neq/g, '!=').replace(/\\approx/g, '~=');
  // Exponents: ^{3} → ^3
  text = text.replace(/\^\{([^}]+)\}/g, '^$1');
  // Subscripts: _{3} → _3
  text = text.replace(/_\{([^}]+)\}/g, '_$1');
  // Strip remaining braces
  text = text.replace(/[{}]/g, '');
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
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

  const normalizeInverseAlias = (value, aliasPattern, canonicalFunc) => {
    const regex = new RegExp(
      `(^|[^A-Za-z\\\\])(?:\\\\)?(?:${aliasPattern})(?:\\s*(?:\\^\\s*\\{?\\s*-?1\\s*\\}?|[−-]\\s*1|⁻¹))?\\s*(\\([^)]*\\)|[A-Za-z0-9_\\\\α-ωΑ-Ωπθ]+)?`,
      'gi'
    );

    return value.replace(regex, (match, prefix, rawArg) => {
      const arg = String(rawArg || '').trim();
      if (!arg) return `${prefix}${canonicalFunc}^{-1}`;
      if (arg.startsWith('(')) return `${prefix}${canonicalFunc}^{-1}${arg}`;
      return `${prefix}${canonicalFunc}^{-1}(${arg})`;
    });
  };

  s = normalizeInverseAlias(s, 'arcsin|asin', '\\sin');
  s = normalizeInverseAlias(s, 'arccos|acos', '\\cos');
  s = normalizeInverseAlias(s, 'arctan|atan', '\\tan');

  // Common constants
  s = s
    .replace(/π/g, '\\pi')
    .replace(/(^|[^A-Za-z\\])pi(?=[^A-Za-z]|$)/gi, '$1\\pi');

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
  // Already looks like LaTeX — return as-is
  if (raw.startsWith('\\') || /[_^{}\\]/.test(raw)) return raw;

  if (typeof globalThis.grammarParser?.mathToLatexGrammar === 'function') {
    try {
      const normalized = String(globalThis.grammarParser.mathToLatexGrammar(raw) ?? '').trim();
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
  let text = '';
  questionInput.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Strip zero-width spaces used for cursor positioning
      text += (node.textContent || '').replace(/\u200B/g, '');
    } else if (node.classList && node.classList.contains('math-chip')) {
      text += node.dataset.text || '';
    }
  });
  return text;
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

// Initialize contenteditable math input
function initializeMathField() {
  questionInput = document.getElementById('questionInput');
  
  if (!questionInput) {
    console.error('Math input field not found');
    return;
  }

  // Listen for input changes
  questionInput.addEventListener('input', function() {
    // Clean up: if contenteditable gets <br> or <div>, normalize
    cleanContentEditable();
    handleInputChange();
  });

  // Submit on Enter, prevent newlines
  questionInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('questionForm').dispatchEvent(
        new Event('submit', { cancelable: true })
      );
    }
  });

  // Paste as plain text only
  questionInput.addEventListener('paste', function(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });

  // Click on a math chip to open inline editor
  questionInput.addEventListener('click', function(e) {
    const chip = e.target.closest('.math-chip');
    if (!chip || !questionInput.contains(chip)) return;
    openChipEditor(chip);
  });

  mathFieldReady = true;
  console.log('Math input field initialized');
}

// Remove stray <br>/<div> that contenteditable can insert
function cleanContentEditable() {
  if (!questionInput) return;
  const brs = questionInput.querySelectorAll('br');
  brs.forEach(br => br.remove());
  // Unwrap any <div> wrappers (some browsers wrap lines in divs)
  const divs = questionInput.querySelectorAll('div');
  divs.forEach(div => {
    while (div.firstChild) div.parentNode.insertBefore(div.firstChild, div);
    div.remove();
  });
}

/**
 * Open an inline edit field on a math chip so the user can modify
 * the expression in-place (e.g. change the exponent from 3 to 2).
 * On Enter or blur, the edited text is re-rendered as a new chip.
 */
function openChipEditor(chip) {
  const readableText = chip.dataset.text || latexToReadableText(chip.dataset.latex || '');

  // Create a small inline input replacing the chip
  const editor = document.createElement('input');
  editor.type = 'text';
  editor.className = 'chip-editor';
  editor.value = readableText;
  // Size it to fit the text
  editor.style.width = Math.max(readableText.length * 0.7, 2) + 'em';

  // Replace chip with editor
  chip.parentNode.replaceChild(editor, chip);
  editor.focus();
  editor.select();

  const commitEdit = () => {
    // Prevent double-commit
    if (editor._committed) return;
    editor._committed = true;

    const newText = editor.value.trim();
    if (!newText) {
      // If emptied, just remove the editor
      editor.remove();
      questionInput.normalize();
      prevInputValue = getInputTextValue();
      handleInputChange();
      return;
    }

    // Convert edited text to LaTeX and create a new chip
    let newLatex;
    try {
      newLatex = smartTextToLatex(newText);
    } catch {
      newLatex = newText;
    }

    const newChip = document.createElement('span');
    newChip.className = 'math-chip';
    newChip.contentEditable = 'false';
    newChip.dataset.latex = newLatex;
    newChip.dataset.text = newText;
    try {
      katex.render(newLatex, newChip, { throwOnError: false, displayMode: false });
    } catch {
      newChip.textContent = newText;
    }

    editor.parentNode.replaceChild(newChip, editor);

    // Ensure cursor can be placed after the chip
    if (!newChip.nextSibling || newChip.nextSibling.nodeType !== Node.TEXT_NODE) {
      const spacer = document.createTextNode('\u200B');
      if (newChip.nextSibling) {
        questionInput.insertBefore(spacer, newChip.nextSibling);
      } else {
        questionInput.appendChild(spacer);
      }
    }

    // Place cursor after chip
    try {
      const target = newChip.nextSibling;
      const range = document.createRange();
      const sel = window.getSelection();
      const off = (target.textContent || '').startsWith('\u200B') ? 1 : 0;
      range.setStart(target, off);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch { /* fallback */ }

    prevInputValue = getInputTextValue();
    suppressSuggestionForValue = '';
    handleInputChange();
  };

  // Commit on Enter
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      commitEdit();
    }
    if (e.key === 'Escape') {
      // Cancel — restore original chip
      editor._committed = true;
      editor.parentNode.replaceChild(chip, editor);
      questionInput.focus();
    }
  });

  // Commit on blur (click away)
  editor.addEventListener('blur', () => {
    // Small delay so Enter handler fires first
    setTimeout(commitEdit, 50);
  });
}

// Get the current LaTeX representation of the input
function getInputLatex() {
  if (!questionInput) return '';
  let latex = '';
  questionInput.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || '').replace(/\u200B/g, '').trim();
      if (t) {
        try { latex += smartTextToLatex(t); } catch { latex += t; }
      }
    } else if (node.classList && node.classList.contains('math-chip')) {
      latex += node.dataset.latex || '';
    }
  });
  return latex.trim();
}

// Get caret offset in logical text coordinates
function getCaretOffset() {
  const sel = window.getSelection();
  if (!sel.rangeCount || !questionInput.contains(sel.anchorNode)) {
    return getInputTextValue().length;
  }
  const range = sel.getRangeAt(0);
  let offset = 0;
  for (const node of questionInput.childNodes) {
    if (node === range.startContainer || node.contains(range.startContainer)) {
      if (node.nodeType === Node.TEXT_NODE) {
        return offset + range.startOffset;
      }
      // Cursor is at the chip boundary
      return offset + (node.dataset ? (node.dataset.text || '').length : 0);
    }
    if (node.nodeType === Node.TEXT_NODE) {
      offset += (node.textContent || '').length;
    } else if (node.classList && node.classList.contains('math-chip')) {
      offset += (node.dataset.text || '').length;
    }
  }
  return offset;
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
    console.error('Math input not ready');
    return;
  }

  const rawText = getInputTextValue().trim();
  const rawQuestion = rawText ? getInputLatex() : '';
  const question = normalizeMathLiveArtifacts(rawQuestion).trim();
  
  if (!question) {
    showResponseStatus('error', 'Please enter a math question');
    return;
  }
  
  // Add user message
  addMessage({ text: question, role: 'user' });
  
  // Clear input
  questionInput.innerHTML = '';
  smartRanges = [];
  prevInputValue = '';

  // Set loading state
  loading = true;
  submitBtn.disabled = true;
  questionInput.contentEditable = 'false';
  questionInput.classList.add('locked');
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
    questionInput.contentEditable = 'true';
    questionInput.classList.remove('locked');
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

  // Reset usedSuggestion once the user starts typing/backspacing again
  if (usedSuggestion) {
    // The first call right after selectSuggestion() sets prevInputValue;
    // once the value actually changes (user typed/backspaced), reset the flag.
    const currentVal = getInputTextValue();
    if (currentVal !== prevInputValue) {
      usedSuggestion = false;
      inputMethod = 'typing';
    }
  } else {
    inputMethod = 'typing';
  }
  
  // Get text value from input
  const textValue = getInputTextValue();
  let latexValue = '';
  try {
    latexValue = textValue ? smartTextToLatex(textValue) : '';
  } catch (e) {
    console.warn('smartTextToLatex error:', e);
    latexValue = textValue;
  }
  const searchValue = textValue;
  const normalizedSearchValue = String(searchValue || '').replace(/\s+/g, '');

  if (suppressSuggestionForValue && normalizedSearchValue === suppressSuggestionForValue) {
    // Still matches the just-inserted suggestion — suppress, but update state
    prevInputValue = searchValue;
    hideSuggestions();
    return;
  }
  // Clear suppression as soon as the value diverges
  suppressSuggestionForValue = '';
  
  console.log('LaTeX value:', latexValue); // Debug
  console.log('Search value:', searchValue); // Debug
  
  // Use actual cursor position from contenteditable
  const caret = getCaretOffset();

  smartRanges = updateSmartRanges(prevInputValue, searchValue);
  prevInputValue = searchValue;

  // Extract the current word/phrase for suggestions
  // Match more characters including backslash for LaTeX commands
  const mathSymbolRegex = /[A-Za-z0-9_\\^/+\-*(),{}<>=!|√∛∜×·⋅≤≥≠±∞∪∩≈∫∑⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ⃗αβγδΔθλμωΩπ°'"]/;
  const isChar = (ch) => mathSymbolRegex.test(ch);

  // Get current word/phrase
  let start = caret;
  let end = caret;
  while (start > 0 && isChar(searchValue[start - 1])) start -= 1;
  while (end < searchValue.length && isChar(searchValue[end])) end += 1;
  
  let query = searchValue.slice(start, end).trim();
  let queryText = '';
  try {
    queryText = latexToSmartText(query);
  } catch (e) {
    console.warn('latexToSmartText error:', e);
    queryText = query;
  }
  
  // Clean query from empty groups
  query = query.replace(/\{\}/g, '')
               .replace(/[_^]$/, '');
               
  // If query became empty, just backslash, or a bare operator, treat as empty
  if (query === '\\' || query === '' || /^[+\-*/=,\s]+$/.test(query)) {
    query = '';
  }

  console.log('Query for suggestions:', query); // Debug

  try {
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
            let prevIndex = i - 1;
            while (prevIndex >= 0 && /\s/.test(expr[prevIndex])) {
              prevIndex -= 1;
            }
            const prevNonSpace = prevIndex >= 0 ? expr[prevIndex] : '';
            const isUnarySign = prevIndex < 0 || /[+\-*/=,(]/.test(prevNonSpace);
            if (isUnarySign) {
              continue;
            }

            const compactPrefix = expr.slice(0, i).replace(/\s+/g, '');
            const inversePrefixPattern = /(?:(?:\\)?(?:sin|cos|tan|sec|csc|cot|cosec)(?:\^\{?)?|(?:\\)?(?:arc|a)(?:sin|cos|tan))$/i;
            const isInverseTrig = char === '-' && expr[i + 1] === '1' && inversePrefixPattern.test(compactPrefix);
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

              const leftFragment = expr.slice(0, i);
              const rightFragment = expr.slice(i + 1);
              const leftTrimmed = leftFragment.trimEnd();
              const rightTrimmed = rightFragment.trimStart();
              const leftChar = leftTrimmed[leftTrimmed.length - 1] || '';
              const rightChar = rightTrimmed[0] || '';
              const slashLooksLikeFraction = /[A-Za-z0-9)\]}'\\πθα-ω]/i.test(leftChar)
                && /[A-Za-z0-9(\[{'\\πθα-ω]/i.test(rightChar);

              if (slashLooksLikeFraction) {
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
        const afterOp = query.substring(lastTopLevelOperatorIndex + 1).trim();
        if (afterOp.length > 0) {
          // There is a term after the operator — use it
          queryTerm = afterOp;
          termStartOffset = lastTopLevelOperatorIndex + 1;
          queryTermText = latexToSmartText(queryTerm);
        } else {
          // Trailing operator (e.g. "10x +") — use the term before the operator
          queryTerm = query.substring(0, lastTopLevelOperatorIndex).trim();
          termStartOffset = 0;
          queryTermText = latexToSmartText(queryTerm);
        }
      }
    }

    const trailingTrigStart = findLastTopLevelTrigStart(query);
    if (trailingTrigStart !== -1) {
      const trailingTrigTerm = query.substring(trailingTrigStart).trim();
      const isCompactTrigAmbiguity = /^(?:\\)?(sin|cos|tan|sec|csc|cot|cosec)\s*\d*[a-zα-ω\\()]+\s*[+\-].+/i.test(trailingTrigTerm);
      const leadingSegment = query.substring(termStartOffset, trailingTrigStart).trim();
      const hasLeadingNumericFactor = /^[-+]?\d+(?:\.\d+)?(?:\s*\/\s*[-+]?\d+(?:\.\d+)?)?$/.test(leadingSegment);
      const shouldPreferTrailingTrig = (trailingTrigStart > termStartOffset && !hasLeadingNumericFactor) || isCompactTrigAmbiguity;

      if (shouldPreferTrailingTrig) {
        queryTerm = trailingTrigTerm;
        termStartOffset = trailingTrigStart;
        queryTermText = latexToSmartText(queryTerm);
      }
    }
    
    // Match rules directly with LaTeX input (use extracted term, not full query)
    // --- Grammar-based suggestions (ambiguity resolver) ---
    let grammarSuggestions = [];
    if (typeof globalThis.ambiguityResolver?.generateSuggestions === 'function') {
      try {
        grammarSuggestions = globalThis.ambiguityResolver.generateSuggestions(queryTerm, 8)
          .filter(s => s && s !== queryTerm && !searchValue.includes(s));
      } catch (e) {
        console.warn('Grammar parser error:', e);
      }
    }

    // Filter out suggestions containing placeholder '?' (incomplete parse artifacts)
    let suggestions = grammarSuggestions.filter(s => !s.includes('?'));

    const normalizeInverseIntentSource = (value) => String(value || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/−/g, '-')
      .replace(/⁻/g, '-')
      .replace(/¹/g, '1')
      .replace(/²/g, '2')
      .replace(/³/g, '3')
      .replace(/\^\{?(-?1)\}?/g, '^-1');

    const inverseIntentSource = normalizeInverseIntentSource(queryTermText || queryTerm || '');
    const inverseIntentMatch = inverseIntentSource.match(/^(?:arc|a)?(sin|cos|tan|sec|csc|cot|cosec)(?:\^-1|-1)(?:\((.*)\)|([a-z0-9_\\πθα-ω.+\-*/^{}]+))?$/i);
    if (inverseIntentMatch) {
      const rawFunc = String(inverseIntentMatch[1] || '').toLowerCase();
      const normalizedFunc = rawFunc === 'cosec' ? 'csc' : rawFunc;
      const rawArg = String(inverseIntentMatch[2] || inverseIntentMatch[3] || '').trim();
      const hasTypedArg = rawArg && rawArg !== '-1' && rawArg !== '−1';

      suggestions = suggestions.filter(item => {
        const text = String(item || '');
        return /\^\{\s*[−-]?1\s*\}|\^[−-]?1|⁻¹/.test(text);
      });

      const fallbackInverse = hasTypedArg
        ? `\\${normalizedFunc}^{-1}(${rawArg})`
        : `\\${normalizedFunc}^{-1}(x)`;

      if (!suggestions.includes(fallbackInverse)) {
        suggestions.unshift(fallbackInverse);
      }
    }

    const compactSquareSource = String(queryTermText || queryTerm || '')
      .replace(/\s+/g, '')
      .replace(/⁻¹/g, '^-1')
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .replace(/ⁿ/g, '^n');
    const directSquareMatch = compactSquareSource.match(/^(.*\))(?:\^?\{?([0-9n]+)\}?)$/i);
    if (directSquareMatch) {
      const directSquareSuggestion = `${directSquareMatch[1]}^{${directSquareMatch[2]}}`;
      if (
        directSquareSuggestion !== queryTerm &&
        !searchValue.includes(directSquareSuggestion) &&
        !suggestions.includes(directSquareSuggestion)
      ) {
        suggestions.unshift(directSquareSuggestion);
      }
    }

    const trigNames = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'cosec'];
    const alphaTail = (queryTermText || queryTerm || '').match(/[A-Za-z]+$/);
    const trigPrefix = alphaTail ? alphaTail[0].toLowerCase() : '';
    const typingTrigPrefix = trigPrefix && trigNames.some(name => name.startsWith(trigPrefix));

    if (typingTrigPrefix) {
      suggestions = suggestions.filter(s => /(?:^|\\)(sin|cos|tan|sec|csc|cot|cosec)\b/i.test(String(s)));
    }

    console.log('Suggestions found:', suggestions); // Debug

    if (suggestions.length > 0) {
      const rawStart = start + termStartOffset;
      const rawEnd = rawStart + queryTerm.length;
      const replaceableCharRegex = /[A-Za-z0-9_\\^{}()√∛∜α-ωΑ-Ωπθδλμσωβγ+\-−⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ°]/;
      let replaceStart = rawStart;
      let replaceEnd = rawEnd;

      const rawToken = searchValue.slice(rawStart, rawEnd);
      const hasUnarySignPrefix = /^\s*[+\-−](?:\s*[+\-−])*/.test(rawToken);

      while (replaceStart < replaceEnd && !replaceableCharRegex.test(searchValue[replaceStart] || '')) {
        replaceStart += 1;
      }
      while (replaceEnd > replaceStart && !replaceableCharRegex.test(searchValue[replaceEnd - 1] || '')) {
        replaceEnd -= 1;
      }

      if (hasUnarySignPrefix) {
        replaceStart = rawStart;
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
      // Re-rank suggestions using XGBoost-style GBDT model
      if (typeof globalThis.suggestionRanker?.rankSuggestions === 'function') {
        try {
          suggestions = globalThis.suggestionRanker.rankSuggestions(queryTerm, suggestions);
        } catch (e) {
          console.warn('Suggestion ranker error:', e);
        }
      }
      lastShownSuggestions = suggestions.slice();
      lastSuggestionQuery = queryTerm;
      showSuggestions(suggestions);
    } else {
      hideSuggestions();
    }
  } else {
    hideSuggestions();
  }
  } catch (e) {
    console.warn('Suggestion processing error:', e);
    hideSuggestions();
  }
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

/**
 * Convert "smart text" (the output of latexToSmartText) back to valid LaTeX.
 * This reverses Unicode superscripts, bare trig names, Greek letters, etc.
 * so KaTeX can render the result correctly.
 */
function smartTextToLatex(text) {
  let s = String(text || '');
  if (!s) return s;

  // 1. Convert Unicode superscript sequences back to ^{...}
  const superMap = {
    '\u2070':'0','\u00b9':'1','\u00b2':'2','\u00b3':'3','\u2074':'4',
    '\u2075':'5','\u2076':'6','\u2077':'7','\u2078':'8','\u2079':'9',
    '\u207a':'+','\u207b':'-','\u207c':'=','\u207d':'(','\u207e':')',
    '\u207f':'n','\u2071':'i'
  };
  s = s.replace(/[\u2070\u00b9\u00b2\u00b3\u2074-\u207e\u207f\u2071]+/g, (match) => {
    const normal = match.split('').map(ch => superMap[ch] || ch).join('');
    return `^{${normal}}`;
  });

  // 2. Convert bare trig/math function names to LaTeX commands
  //    (only when not already preceded by backslash)
  s = s.replace(/(^|[^a-zA-Z\\])(sin|cos|tan|sec|csc|cot|cosec|log|ln)(?=[^a-zA-Z]|$)/gi,
    (match, pre, fn) => `${pre}\\${fn.toLowerCase()}`
  );

  // 3. Convert Unicode Greek letters back to LaTeX
  s = s
    .replace(/\u03b1/g, '\\alpha').replace(/\u03b2/g, '\\beta')
    .replace(/\u03b3/g, '\\gamma').replace(/\u03b4/g, '\\delta')
    .replace(/\u0394/g, '\\Delta').replace(/\u03b8/g, '\\theta')
    .replace(/\u03bb/g, '\\lambda').replace(/\u03bc/g, '\\mu')
    .replace(/\u03c9/g, '\\omega').replace(/\u03a9/g, '\\Omega')
    .replace(/\u03c0/g, '\\pi');

  // 4. Convert degree symbol and operators
  s = s.replace(/\u00b0/g, '^{\\circ}');
  s = s.replace(/\u00d7/g, '\\times');
  s = s.replace(/\u2264/g, '\\leq').replace(/\u2265/g, '\\geq');
  s = s.replace(/\u2260/g, '\\neq').replace(/\u00b1/g, '\\pm');
  s = s.replace(/\u221e/g, '\\infty');
  s = s.replace(/\u222b/g, '\\int').replace(/\u2211/g, '\\sum');

  return s;
}

function selectSuggestion(latex) {

  if (!questionInput || !mathFieldReady) return;
  const suggestionLatex = normalizeSuggestionLatex(latex);
  
  inputMethod = 'suggestion';
  usedSuggestion = true;

  console.log(inputMethod, usedSuggestion);

  const currentValue = getInputTextValue();
  let { replaceStart, replaceEnd } = computeSuggestionReplacementRange(suggestionLatex, currentValue);

  // Handle trailing paren balance
  const suffix = currentValue.slice(replaceEnd || 0);
  const prefix = currentValue.slice(0, replaceStart || 0);
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
      replaceEnd += 1; // consume the extra closing paren
    }
  }

  // Create a rendered math chip
  const chip = document.createElement('span');
  chip.className = 'math-chip';
  chip.contentEditable = 'false';
  chip.dataset.latex = suggestionLatex;
  chip.dataset.text = latexToReadableText(suggestionLatex);
  try {
    katex.render(suggestionLatex, chip, { throwOnError: false, displayMode: false });
  } catch {
    chip.textContent = chip.dataset.text;
  }

  // Preserve existing chips: splice the new chip into the DOM at the right position
  // Walk child nodes mapping logical text offsets → DOM nodes
  insertChipIntoDOM(replaceStart, replaceEnd, chip);

  hideSuggestions();
  
  // Show feedback UI so user can thumbs-up or thumbs-down the suggestion
  showSuggestionFeedbackUI(latex);

  // Reset suggestion-tracking state after programmatic insertion.
  prevInputValue = getInputTextValue();
  suppressSuggestionForValue = String(prevInputValue || '').replace(/\s+/g, '');
  smartRanges = [];

  requestAnimationFrame(() => {
    questionInput.focus();
    handleInputChange();
  });
}

/**
 * Insert a chip into the contenteditable div at logical text range [start, end),
 * preserving all existing chips and only modifying the affected text node(s).
 */
function insertChipIntoDOM(replaceStart, replaceEnd, chip) {
  const nodes = Array.from(questionInput.childNodes);
  const newChildren = [];
  let pos = 0;
  let chipInserted = false;

  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Get the logical text (without zero-width spaces)
      const raw = node.textContent || '';
      const logical = raw.replace(/\u200B/g, '');
      const nodeStart = pos;
      const nodeEnd = pos + logical.length;

      if (nodeEnd <= replaceStart || nodeStart >= replaceEnd) {
        // Node is fully outside replacement range — keep as-is
        newChildren.push(node);
      } else {
        // This text node overlaps with the replacement range
        const cutStart = Math.max(0, replaceStart - nodeStart);
        const cutEnd = Math.min(logical.length, replaceEnd - nodeStart);

        const beforeText = logical.slice(0, cutStart);
        const afterText = logical.slice(cutEnd);

        if (beforeText) {
          newChildren.push(document.createTextNode(beforeText));
        }
        if (!chipInserted) {
          newChildren.push(chip);
          chipInserted = true;
        }
        if (afterText) {
          newChildren.push(document.createTextNode(afterText));
        }
      }
      pos += logical.length;

    } else if (node.classList && node.classList.contains('math-chip')) {
      const chipText = node.dataset.text || '';
      const nodeStart = pos;
      const nodeEnd = pos + chipText.length;

      if (nodeEnd <= replaceStart || nodeStart >= replaceEnd) {
        // Chip fully outside — keep it
        newChildren.push(node);
      } else {
        // Chip overlaps replacement (unusual, but handle gracefully — replace it)
        if (!chipInserted) {
          newChildren.push(chip);
          chipInserted = true;
        }
      }
      pos += chipText.length;

    } else {
      // Other nodes (shouldn't happen) — keep
      newChildren.push(node);
    }
  }

  // If chip was not inserted (e.g. appending at end), add it
  if (!chipInserted) {
    newChildren.push(chip);
  }

  // Rebuild content preserving chips
  questionInput.innerHTML = '';
  newChildren.forEach(n => questionInput.appendChild(n));

  // Ensure there's a text node after the chip for continued typing
  const nextAfterChip = chip.nextSibling;
  let cursorTarget;
  if (!nextAfterChip || nextAfterChip.nodeType !== Node.TEXT_NODE) {
    cursorTarget = document.createTextNode('\u200B');
    if (nextAfterChip) {
      questionInput.insertBefore(cursorTarget, nextAfterChip);
    } else {
      questionInput.appendChild(cursorTarget);
    }
  } else {
    cursorTarget = nextAfterChip;
  }

  // Place cursor right after the chip
  try {
    const range = document.createRange();
    const sel = window.getSelection();
    const startOffset = (cursorTarget.textContent || '').startsWith('\u200B') ? 1 : 0;
    range.setStart(cursorTarget, startOffset);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch { /* focus fallback */ }
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
      body: JSON.stringify({
        suggestion_text: latex,
        rating,
        raw_input: lastSuggestionQuery,
        all_suggestions: lastShownSuggestions,
      })
    });

    const data = await res.json();
    if (!data.success) {
      console.warn('Feedback not recorded:', data);
      showResponseStatus('error', 'Could not record feedback');
    } else {
      // Feed the interaction to the online GBDT learner so ranking improves
      if (typeof globalThis.suggestionRanker?.addFeedback === 'function') {
        try {
          globalThis.suggestionRanker.addFeedback(
            lastSuggestionQuery, latex, lastShownSuggestions, rating
          );
        } catch (e) {
          console.warn('Online learner error:', e);
        }
      }
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
    const normalizedPrefix = prefix.toLowerCase();
    const isInverseAliasPrefix = /^(a|ar|arc)$/.test(normalizedPrefix);
    if (isInverseAliasPrefix) {
      return { replaceStart: start, replaceEnd: end };
    }
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
  if (!suggestionList.contains(e.target) && !questionInput.contains(e.target)) {
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
    // Prevent opening if camera is locked (user not logged in)
    if (cameraBtn && cameraBtn.disabled) return;
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

    // Upload immediately so quality warnings appear before the user presses Convert
    uploadImage();
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

      // Show quality warnings if the image is blurry, dark, or small
      if (data.quality?.warnings?.length) {
        const hint = data.quality.hint || '';
        const warningText = '⚠️ ' + data.quality.warnings.join('\n⚠️ ')
          + (hint ? '\n\n' + hint : '');
        showMsg(warningsDiv, warningText);
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
      showMsg(successDiv, '✅ Equation extracted! Edit below or insert into chat and edit there.');

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

    // Insert a rendered math chip into the contenteditable input
    if (questionInput && mathFieldReady) {
      const chip = document.createElement('span');
      chip.className = 'math-chip';
      chip.contentEditable = 'false';
      chip.dataset.latex = latex;
      chip.dataset.text = latexToReadableText(latex);
      try {
        katex.render(latex, chip, { throwOnError: false, displayMode: false });
      } catch {
        chip.textContent = chip.dataset.text;
      }
      questionInput.appendChild(chip);
      // Add zero-width space for continued typing
      questionInput.appendChild(document.createTextNode('\u200B'));
      questionInput.focus();
      inputMethod = 'image';
      handleInputChange();
    }

    closeScanner();
  }

  // ---------- Scan rating feedback ----------
  async function handleScanRating(rating) {
    rateUpBtn.disabled = true;
    rateDownBtn.disabled = true;
    if (rating === 1) rateUpBtn.classList.add('selected');
    else rateDownBtn.classList.add('selected');

    ratingStatus.textContent = 'Thanks for your feedback!';

    const sessionId = localStorage.getItem('flipaha_session_id') || '';
    try {
      await fetch(`${API_BASE_URL}/api/scan-feedback`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          image_id: scanner.imageId || '',
          rating: rating,
          original_latex: originalLatex,
          edited_latex: (latexInput.value || '').trim()
        })
      });
    } catch (_) { /* non-critical, ignore */ }
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