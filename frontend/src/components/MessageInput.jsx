import { useEffect, useRef, useState } from 'react'
import './MessageInput.css'
import 'katex/dist/katex.min.css'
import { InlineMath } from 'react-katex'
import { getLatexSuggestions } from '../utils/mathToLatex';

const SUPERSCRIPT_MAP = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  'n': 'ⁿ',
  'i': 'ⁱ'
}

const GREEK_MAP = {
  '\\alpha': 'α',
  '\\beta': 'β',
  '\\gamma': 'γ',
  '\\delta': 'δ',
  '\\Delta': 'Δ',
  '\\theta': 'θ',
  '\\lambda': 'λ',
  '\\mu': 'μ',
  '\\omega': 'ω',
  '\\Omega': 'Ω',
  '\\pi': 'π'
}

const toSuperscriptText = (text) =>
  text
    .split('')
    .map((ch) => SUPERSCRIPT_MAP[ch] || ch)
    .join('')

const applySuperscriptForInsert = (text) =>
  text.replace(/\^\{([^}]+)\}|\^([A-Za-z0-9+\-=()]+)/g, (match, braced, simple) => {
    const content = braced ?? simple ?? ''
    return toSuperscriptText(content)
  })

const latexToSmartText = (latex) => {
  let text = latex

  text = text.replace(/\\left\|/g, '|').replace(/\\right\|/g, '|')
  text = text.replace(/\\text\{([^}]*)\}/g, '$1')

  const replaceFrac = () => {
    const next = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
    const changed = next !== text
    text = next
    return changed
  }
  while (replaceFrac()) {}

  text = text.replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, (match, idx, radicand) => {
    if (idx === '3') return `∛${radicand}`
    if (idx === '4') return `∜${radicand}`
    return `√[${idx}]${radicand}`
  })
  text = text.replace(/\\sqrt\{([^}]+)\}/g, '√$1')

  text = text.replace(/\\log_\{([^}]+)\}\(([^)]+)\)/g, 'log_$1($2)')
  text = text.replace(/\\log_\{([^}]+)\}/g, 'log_$1')
  text = text.replace(/\\ln\(([^)]+)\)/g, 'ln($1)')

  text = text.replace(/\\sin/g, 'sin')
  text = text.replace(/\\cos/g, 'cos')
  text = text.replace(/\\tan/g, 'tan')

  text = text.replace(/\\overrightarrow\{([^}]+)\}/g, '$1⃗')

  text = text.replace(/\\times/g, '×')
  text = text.replace(/\\leq/g, '≤')
  text = text.replace(/\\geq/g, '≥')
  text = text.replace(/\\neq/g, '≠')
  text = text.replace(/\\pm/g, '±')
  text = text.replace(/\\infty/g, '∞')
  text = text.replace(/\\cup/g, '∪')
  text = text.replace(/\\cap/g, '∩')
  text = text.replace(/\\approx/g, '≈')
  
  // Integrals: Handle definite first (with limits), then indefinite or empty limits
  text = text.replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, '∫_$1^$2') // \int_{a}^{b} -> ∫_a^b
  text = text.replace(/\\int_\{\}\^\{\}/g, '∫')                     // \int_{}^{} -> ∫
  text = text.replace(/\\int/g, '∫')                                // \int -> ∫

  // Sums: Handle limits similar to integrals
  text = text.replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, '∑_$1^$2') // \sum_{n=1}^{k} -> ∑_n=1^k
  text = text.replace(/\\sum/g, '∑')

  // ✅ Convert greek commands safely (avoid regex issues like \t becoming TAB)
  for (const [latexCmd, symbol] of Object.entries(GREEK_MAP)) {
    text = text.split(latexCmd).join(symbol)
  }

  text = text.replace(/\\,/g, ' ')
  text = text.replace(/\{([^}]*)\}/g, '$1')

  text = applySuperscriptForInsert(text)

  return text
}

const cleanInsertedText = (s) =>
  String(s)
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width chars
    .replace(/\s+/g, ' ')                 // collapse weird whitespace
    .trim()

const normalizeLatexForOverlay = (latex) =>
  latex
    .replace(/\\sin/g, '\\mathrm{sin}')
    .replace(/\\cos/g, '\\mathrm{cos}')
    .replace(/\\tan/g, '\\mathrm{tan}')
    .replace(/\\log/g, '\\mathrm{log}')
    .replace(/\\ln/g, '\\mathrm{ln}')

const renderSuggestionDisplay = (text) => {
  const parts = []
  // Matches both superscripts (^...) and subscripts (_...)
  const regex = /(\^|_)\{([^}]+)\}|(\^|_)([A-Za-z0-9+\-=()]+)/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    
    // Group 1 or 3 is the type (^ or _)
    // Group 2 or 4 is the content
    const type = match[1] || match[3]
    const content = match[2] || match[4] || ''

    if (type === '^') {
      parts.push(<sup key={`sup-${match.index}`}>{content}</sup>)
    } else {
      parts.push(<sub key={`sub-${match.index}`}>{content}</sub>)
    }
    
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

function MessageInput({ onSubmit, disabled }) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [smartRanges, setSmartRanges] = useState([])
  const inputRef = useRef(null)
  const overlayRef = useRef(null)
  const prevInputRef = useRef('')
  const suggestionContextRef = useRef({ start: 0, end: 0 })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim()) {
      onSubmit(input)
      setInput('')
      setSuggestions([])
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const getTextChange = (prevValue, nextValue) => {
    if (prevValue === nextValue) return null

    let start = 0
    const prevLen = prevValue.length
    const nextLen = nextValue.length

    while (
      start < prevLen &&
      start < nextLen &&
      prevValue[start] === nextValue[start]
    ) {
      start += 1
    }

    let prevEnd = prevLen - 1
    let nextEnd = nextLen - 1
    while (
      prevEnd >= start &&
      nextEnd >= start &&
      prevValue[prevEnd] === nextValue[nextEnd]
    ) {
      prevEnd -= 1
      nextEnd -= 1
    }

    const removedCount = Math.max(0, prevEnd - start + 1)
    const addedCount = Math.max(0, nextEnd - start + 1)

    return { start, removedCount, addedCount }
  }

  const updateSmartRanges = (prevValue, nextValue) => {
    const change = getTextChange(prevValue, nextValue)
    if (!change) return smartRanges

    const { start, removedCount, addedCount } = change
    const delta = addedCount - removedCount

    return smartRanges
      .map((range) => {
        if (range.end <= start) return range
        if (range.start >= start + removedCount) {
          return {
            ...range,
            start: range.start + delta,
            end: range.end + delta
          }
        }
        return null
      })
      .filter(Boolean)
  }

  const handleInputChange = (e) => {
    const value = e.target.value
    const caret = e.target.selectionStart ?? value.length
    const nextRanges = updateSmartRanges(prevInputRef.current, value)
    setSmartRanges(nextRanges)
    setInput(value)
    prevInputRef.current = value

    // Strategy: Try to find a suggestion for the "loose" phrase (including spaces)
    // If that fails, fall back to the "strict" word (classic behavior)
    
    // Include common Unicode math symbols (Greek, exponents, operators like ×, ≤, etc.)
    // ADDED: ' and " to support f'(x) and f"(x)
    const mathSymbolRegex = /[A-Za-z0-9_\\^/+\-*(),{}<>=!|√∛∜×≤≥≠±∞∪∩≈∫∑⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ⃗αβγδΔθλμωΩπ'"]/
    
    const isStrictChar = (ch) => mathSymbolRegex.test(ch)
    const isLooseChar = (ch) => mathSymbolRegex.test(ch) || /\s/.test(ch)

    // 1. Loose phrase (expands across spaces)
    let lStart = caret, lEnd = caret
    while (lStart > 0 && isLooseChar(value[lStart - 1])) lStart -= 1
    while (lEnd < value.length && isLooseChar(value[lEnd])) lEnd += 1
    const looseQuery = value.slice(lStart, lEnd)

    // 2. Strict word (stops at spaces)
    let sStart = caret, sEnd = caret
    while (sStart > 0 && isStrictChar(value[sStart - 1])) sStart -= 1
    while (sEnd < value.length && isStrictChar(value[sEnd])) sEnd += 1
    const strictQuery = value.slice(sStart, sEnd)

    // Check loose first
    const trimmedLoose = looseQuery.trim()
    const looseSuggestions = trimmedLoose 
      ? getLatexSuggestions(trimmedLoose).filter(s => s !== trimmedLoose)
      : []

    if (looseSuggestions.length > 0) {
      suggestionContextRef.current = { start: lStart, end: lEnd }
      setSuggestions(looseSuggestions)
    } else {
      // Fallback to strict
      const trimmedStrict = strictQuery.trim()
      const strictSuggestions = trimmedStrict 
        ? getLatexSuggestions(trimmedStrict).filter(s => s !== trimmedStrict)
        : []
        
      if (strictSuggestions.length > 0) {
        suggestionContextRef.current = { start: sStart, end: sEnd }
        setSuggestions(strictSuggestions)
      } else {
        setSuggestions([])
      }
    }
  }

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.disabled = Boolean(disabled)
    }
  }, [disabled])

  useEffect(() => {
    const textarea = inputRef.current
    const overlay = overlayRef.current
    if (!textarea || !overlay) return

    const syncScroll = () => {
      overlay.scrollTop = textarea.scrollTop
      overlay.scrollLeft = textarea.scrollLeft
    }

    textarea.addEventListener('scroll', syncScroll)
    return () => textarea.removeEventListener('scroll', syncScroll)
  }, [])

  const renderOverlayContent = () => {
    if (!input) {
      return <span className="input-placeholder">Ask your math question... (e.g. sin x, sum n=1 to 5, x^2)</span>
    }

    if (smartRanges.length === 0) {
      return input
    }

    const pieces = []
    let cursor = 0

    smartRanges
      .slice()
      .sort((a, b) => a.start - b.start)
      .forEach((range, index) => {
        if (range.start > cursor) {
          pieces.push(input.slice(cursor, range.start))
        }
        pieces.push(
          <span key={`smart-${index}`} className="smart-token">
            <span className="smart-text">{range.displayText}</span>
            <span className="smart-render">
              <InlineMath math={range.displayLatex} errorColor="#ef4444" />
            </span>
          </span>
        )
        cursor = range.end
      })

    if (cursor < input.length) {
      pieces.push(input.slice(cursor))
    }

    return pieces
  }

  return (
  <form className="question-form" onSubmit={handleSubmit}>
    <div className="input-wrapper">
      <div className='input-dropdown-wrapper'>
        <div className="input-overlay" ref={overlayRef}>
          {renderOverlayContent()}
        </div>
        <textarea
          ref={inputRef}
          className="question-input"
          aria-label="Ask your math question"
          value={input}
          onChange={handleInputChange}
          disabled={disabled}
          rows={3}
        />
        
        {suggestions.length > 0 && (
          <ul className="suggestion-list">
            {suggestions.map((latex, index) => (
              <li
                key={index}
                className="suggestion-item"
                onClick={() => {
                  if (!inputRef.current) return
                  const { start, end } = suggestionContextRef.current
                  const before = input.slice(0, start)
                  const after = input.slice(end)
                  const formatted = cleanInsertedText(latexToSmartText(latex))
                  
                  const nextValue = `${before}${formatted}${after}`
                  const newRange = {
                    start: before.length,
                    end: before.length + formatted.length,
                    latex,
                    displayText: formatted,
                    displayLatex: normalizeLatexForOverlay(latex)
                  }
                  
                  // Calculate length difference to shift subsequent ranges
                  const lengthDiff = formatted.length - (end - start);

                  setSmartRanges((prev) => {
                    // 1. Remove ranges that overlap with the replaced section [start, end]
                    // 2. Shift ranges that come after the replaced section
                    const updated = prev
                      .filter(r => r.end <= start || r.start >= end)
                      .map(r => {
                        if (r.start >= end) {
                          return {
                            ...r,
                            start: r.start + lengthDiff,
                            end: r.end + lengthDiff
                          }
                        }
                        return r
                      })
                    
                    return [...updated, newRange]
                  })

                  setInput(nextValue)
                  setSuggestions([])
                  prevInputRef.current = nextValue
                  requestAnimationFrame(() => {
                    const caretPos = before.length + formatted.length
                    inputRef.current.focus()
                    inputRef.current.setSelectionRange(caretPos, caretPos)
                  })
                }}
              >
                <InlineMath math={latex} errorColor="#ef4444" />
              </li>
            ))}
          </ul>
        )}
      </div>
      
      
      <button type="submit" className="btn btn-submit" disabled={disabled}>
        <span className="icon">→</span>
      </button>
      
      

    </div>
  </form>
)
}

export default MessageInput
