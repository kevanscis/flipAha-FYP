import { useState } from 'react'
import './MessageInput.css'
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';

const API_BASE_URL = 'http://localhost:5000/api'

const getSuggestions = async (input) => {
  if (!input.trim()) return []

  try {
    const response = await fetch(`${API_BASE_URL}/suggestions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input })
    })
    
    if (!response.ok) throw new Error('Failed to fetch suggestions')
    
    const data = await response.json()
    return data.success ? data.suggestions : []
  } catch (error) {
    console.error('Error fetching suggestions:', error)
    return []
  }
}

function MessageInput({ onSubmit, disabled }) {
  const [input, setInput] = useState('')
  const [valueStored, setValueStored] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [lowerInput, setLowerInput] = useState('') // For Case-Insensitive

  const handleSubmit = (e) => {
    e.preventDefault()
    const fullValue = valueStored + input
    if (fullValue.trim()) {
      onSubmit(fullValue)
      setInput('')
      setValueStored('')
      setSuggestions([])
    }
  }

return (
  <form className="question-form" onSubmit={handleSubmit}>
    <div className="input-wrapper">
      <div className='input-dropdown-wrapper'>
        {(valueStored + input).trim() && (
          <div className="latex-preview">
            <InlineMath math={valueStored + input} />
          </div>
        )}
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
            // Fetch suggestions from backend using case-insensitive input
            getSuggestions(lowerInput).then(result => {
              setSuggestions(result)
              console.log(result)
              console.log('Lowercase input:', value.toLowerCase())  // For Case-Insensitive
            })
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
                  setValueStored(valueStored + latex)
                  setInput('')
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
