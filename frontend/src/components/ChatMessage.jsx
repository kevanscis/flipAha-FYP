import './ChatMessage.css'
import 'katex/dist/katex.min.css'
import { InlineMath } from 'react-katex'

function toLatexFractions(input) {
  let s = input

  // Convert simple fractions like 1/2, x/y, (a+b)/(c+d)
  // Avoid converting things like http:// or dates by requiring boundaries.
  s = s.replace(
    /(^|[^A-Za-z0-9/])(\([^)]+\)|[A-Za-z0-9]+)\s*\/\s*(\([^)]+\)|[A-Za-z0-9]+)(?=$|[^A-Za-z0-9/])/g,
    '$1\\frac{$2}{$3}'
  )
  return s
}

function ChatMessage({ message }) {
  const raw = String(message?.text ?? '')
  const mathText = raw.trim().replace(/^\$+/, '').replace(/\$+$/, '')
  const normalized = toLatexFractions(mathText)

  return (
    <div className={`message ${message.role}`}>
      <div className="message-bubble">
        {message.role === 'user' ? (
          <InlineMath math={normalized} />
        ) : (
          raw
        )}
      </div>
    </div>
  )
}

export default ChatMessage
