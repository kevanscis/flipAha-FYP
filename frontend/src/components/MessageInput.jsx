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

    const mathfield = new MathfieldElement()
    mathfield.className = 'question-input'
    mathfield.placeholder = 'Ask your math question here... (e.g., x^2, 2x+5=13)'
    mathfield.setOptions({
      defaultMode: 'text',
      smartMode: true,
      smartSuperscript: true,
      mathVirtualKeyboardPolicy: 'manual'
    })
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
        <div ref={mathfieldHostRef} className="math-field-host" />
        
        {suggestions.length > 0 && (
          <ul className="suggestion-list">
            {suggestions.map((latex, index) => (
              <li
                key={index}
                className="suggestion-item"
                onClick={() => {
                  if (mathfieldRef.current) {
                    const current = mathfieldRef.current.getValue('latex')
                    const { query } = suggestionContextRef.current
                    let nextValue = current

                    if (query) {
                      const replaceIndex = current.lastIndexOf(query)
                      if (replaceIndex !== -1) {
                        nextValue =
                          current.slice(0, replaceIndex) +
                          latex +
                          current.slice(replaceIndex + query.length)
                      } else {
                        nextValue = `${current} ${latex}`.trim()
                      }
                    } else {
                      nextValue = `${current} ${latex}`.trim()
                    }

                    mathfieldRef.current.setValue(nextValue)
                    mathfieldRef.current.focus()
                    setInput(nextValue)
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
        <span>Get Help</span>
        <span className="icon">→</span>
      </button>
      
      

    </div>
  </form>
)
}

export default MessageInput
