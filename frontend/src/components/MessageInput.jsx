import { useState } from 'react'
import './MessageInput.css'

function MessageInput({ onSubmit, disabled }) {
  const [input, setInput] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim()) {
      onSubmit(input)
      setInput('')
    }
  }

  return (
    <form className="question-form" onSubmit={handleSubmit}>
      <div className="input-wrapper">
        <textarea
          className="question-input"
          placeholder="Ask your math question here...&#10;(e.g., What is the derivative of x²? or Solve 2x + 5 = 13)"
          rows="4"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled}
        />
        <button type="submit" className="btn btn-submit" disabled={disabled}>
          <span>Get Help</span>
          <span className="icon">→</span>
        </button>
      </div>
    </form>
  )
}

export default MessageInput
