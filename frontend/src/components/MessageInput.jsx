import { useEffect, useRef, useState } from 'react'
import './MessageInput.css'
import { getLatexSuggestions } from '../utils/mathToLatex';

function MessageInput({ onSubmit, disabled }) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const inputRef = useRef(null)
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

  const handleInputChange = (e) => {
    const value = e.target.value
    const caret = e.target.selectionStart ?? value.length
    setInput(value)

    const isWordChar = (ch) => /[A-Za-z0-9_\\^/+-]/.test(ch)
    let start = caret
    let end = caret

    while (start > 0 && isWordChar(value[start - 1])) start -= 1
    while (end < value.length && isWordChar(value[end])) end += 1

    const query = value.slice(start, end)
    suggestionContextRef.current = { start, end }
    updateSuggestions(query)
  }

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.disabled = Boolean(disabled)
    }
  }, [disabled])

  return (
  <form className="question-form" onSubmit={handleSubmit}>
    <div className="input-wrapper">
      <div className='input-dropdown-wrapper'>
        <textarea
          ref={inputRef}
          className="question-input"
          placeholder="Ask your math question here... (e.g., x^2, 2x+5=13)"
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
                  const nextValue = `${before}${latex}${after}`
                  setInput(nextValue)
                  setSuggestions([])
                  requestAnimationFrame(() => {
                    const caretPos = before.length + latex.length
                    inputRef.current.focus()
                    inputRef.current.setSelectionRange(caretPos, caretPos)
                  })
                }}
              >
                {latex}
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
