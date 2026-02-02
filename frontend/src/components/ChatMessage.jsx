import './ChatMessage.css'
import 'katex/dist/katex.min.css'
import { InlineMath } from 'react-katex'

function normalizeToLatex(input) {
  let s = input

  // ---- Logs ----
  // log(2,10) -> \log_{2}(10)
  s = s.replace(/\blog\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/g, '\\log_{$1}($2)')

  // log_2(10) -> \log_{2}(10)
  s = s.replace(/\blog_([A-Za-z0-9]+)\s*\(\s*([^)]+)\s*\)/g, '\\log_{$1}($2)')

  // log2(10) -> \log_{2}(10)
  s = s.replace(/\blog([A-Za-z0-9]+)\s*\(\s*([^)]+)\s*\)/g, '\\log_{$1}($2)')

  // log_2 -> \log_{2}
  s = s.replace(/\blog_([A-Za-z0-9]+)\b/g, '\\log_{$1}')

  // log2 -> \log_{2}
  s = s.replace(/\blog([A-Za-z0-9]+)\b/g, '\\log_{$1}')

  // plain log -> \log(x)
  s = s.replace(/\blog\b/g, '\\log')

  // ---- Fractions ----
  s = s.replace(
    /(^|[^A-Za-z0-9/])(\([^)]+\)|[A-Za-z0-9]+)\s*\/\s*(\([^)]+\)|[A-Za-z0-9]+)(?=$|[^A-Za-z0-9/])/g,
    '$1\\frac{$2}{$3}'
  )

  return s
}

function ChatMessage({ message }) {
  const raw = String(message?.text ?? '')
  const mathText = raw.trim().replace(/^\$+/, '').replace(/\$+$/, '')
  const normalized = normalizeToLatex(mathText)

  return (
    <div className={`message ${message.role}`}>
      <div className="message-bubble">
        {message.role === 'user' ? <InlineMath math={normalized} /> : raw}
      </div>
    </div>
  )
}

export default ChatMessage
