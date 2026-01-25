import { useEffect, useRef, useState } from 'react'
import './MessageInput.css'
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';
import { MathfieldElement } from 'mathlive';
import 'mathlive/static.css';
import 'mathlive/fonts.css';
import { getLatexSuggestions } from '../utils/mathToLatex';

function MessageInput({ onSubmit, disabled }) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const mathfieldRef = useRef(null)
  const mathfieldHostRef = useRef(null)
  const handleMathInputRef = useRef(() => {})
  const suggestionContextRef = useRef({ query: '', value: '' })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim()) {
      onSubmit(input)
      setInput('')
      setSuggestions([])
      if (mathfieldRef.current) {
        mathfieldRef.current.setValue('')
      }
    }
  }

  const updateSuggestions = (query) => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      setSuggestions([])
      return
    }

    const nextSuggestions = getLatexSuggestions(trimmedQuery)
      .filter(s => s !== trimmedQuery)

    setSuggestions(nextSuggestions)
  }

  const handleMathInput = () => {
    if (!mathfieldRef.current) return
    const value = mathfieldRef.current.getValue('latex')
    const textValue = value.replace(/\\text\{([^}]*)\}/g, '$1')
    const match = textValue.match(/([A-Za-z0-9_\\^/+-]+)$/)
    const query = match ? match[1] : ''
    setInput(value)
    suggestionContextRef.current = { query, value }
    updateSuggestions(query)
  }

  handleMathInputRef.current = handleMathInput

  useEffect(() => {
    if (!mathfieldHostRef.current || mathfieldRef.current) return
    
    const mathfield = new MathfieldElement({
      defaultMode: 'text',
      smartMode: false,
      smartSuperscript: false,
      mathVirtualKeyboardPolicy: 'manual',
    })

    mathfield.className = 'question-input'
    mathfield.addEventListener('input', () => handleMathInputRef.current())

    mathfieldHostRef.current.appendChild(mathfield)
    mathfieldRef.current = mathfield

    return () => {
      mathfield.remove()
      mathfieldRef.current = null
    }
  }, [])

  useEffect(() => {
    if (mathfieldRef.current) {
      mathfieldRef.current.disabled = Boolean(disabled)
    }
  }, [disabled])

  return (
    <form className="question-form" onSubmit={handleSubmit}>
      <div className="input-wrapper">
        <div className='input-dropdown-wrapper'>
          <div className="math-field-container">
            <div ref={mathfieldHostRef} className="math-field-host" />
            {!input && (
              <div className="custom-placeholder">
                Ask your math question here... (e.g., x², 2x+5=13)
              </div>
            )}
          </div>
          
          {suggestions.length > 0 && (
            <ul className="suggestion-list">
              {suggestions.map((latex, index) => (
                <li
                  key={index}
                  className="suggestion-item"
                  onClick={() => {
                    if (mathfieldRef.current) {
                      const { query, value } = suggestionContextRef.current

                      const newValue = value.slice(0, value.length - query.length) + latex

                      mathfieldRef.current.setValue(newValue, { mode: 'latex' })
                      mathfieldRef.current.focus()
                      setInput(newValue)
                    }
                    setSuggestions([])
                  }}
                >
                  <InlineMath math={latex} />
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