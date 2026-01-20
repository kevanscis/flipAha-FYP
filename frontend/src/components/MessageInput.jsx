import { useState } from 'react'
import './MessageInput.css'
import 'katex/dist/katex.min.css';
import katex from 'katex';

const getSuggestions = (input) => {
  if (!input.trim()) return null

  return {
    trigger: input,
    latex: ['x^2', 'x', '\\frac{d}{dx}x^n', '\int x^n dx', 'e^{x}', '\sqrt{x}', '\sin(x)', '\cos(x)', '\tan(x)', '\log(x)']
  }
}

function MessageInput({ onSubmit, disabled }) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [lowerInput, setLowerInput] = useState('') // For Case-Insensitive

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim()) {
      onSubmit(input)
      setInput('')
      setSuggestions([])
    }
  }

return (
  <form className="question-form" onSubmit={handleSubmit}>
    <div className="input-wrapper">
      <div className='input-dropdown-wrapper'>
        <textarea
          className="question-input"
          placeholder="Ask your math question here...&#10;(e.g., What is the derivative of x²? or Solve 2x + 5 = 13)"
          rows="2"
          value={input}
          onChange={(e) => {
            const value = e.target.value
            setInput(value)
            setLowerInput(value.toLowerCase())  // For Case-Insensitive
            if (value.trim() === '') {
              // if input is empty, clear suggestions
              setSuggestions([])
              return
            }
            const result = getSuggestions(lowerInput).latex.slice(0,5)  // Case-Insensitive Input
            setSuggestions(result)
            console.log(result)
            console.log('Lowercase input:', value.toLowerCase())  // For Case-Insensitive
          }}
          disabled={disabled}
        />
        
        {suggestions.length > 0 && (
          <ul className="suggestion-list">
            {suggestions.map((latex, index) => (
              <li
                key={index}
                className="suggestion-item"
                onClick={() => {
                  setInput(latex)
                  setSuggestions([])
                }}
                dangerouslySetInnerHTML={{ __html: katex.renderToString(latex, { throwOnError: false }) }}
              >
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
