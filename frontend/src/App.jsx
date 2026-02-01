import { useState, useRef, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import ChatMessage from './components/ChatMessage'
import MessageInput from './components/MessageInput'
import Login from './components/Login'
import SignUp from './components/SignUp'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

function Chat() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [responseStatus, setResponseStatus] = useState({ type: '', message: '' })
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmitQuestion = async (question) => {
    if (!question.trim()) {
      setResponseStatus({ type: 'error', message: 'Please enter a math question' })
      return
    }

    setMessages(prev => [...prev, { text: question, role: 'user' }])
    setLoading(true)
    setResponseStatus({ type: 'loading', message: 'Processing your question...' })

    try {
      const response = await fetch(`${API_BASE_URL}/api/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      })

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

      const data = await response.json()
      if (data.success) {
        setMessages(prev => [...prev, { text: data.answer, role: 'assistant' }])
        setResponseStatus({ type: 'success', message: '✅ Response received!' })
      } else {
        throw new Error(data.error || 'Failed to get response')
      }
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [...prev, { text: 'Sorry, I encountered an error. Please try again.', role: 'assistant' }])
      setResponseStatus({ type: 'error', message: 'Error: ' + error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <header style={{ position: 'relative', textAlign: 'center', padding: '1rem 0' }}>
        <div>
          <h1>
            <span className="flip">Flip</span>
            <span className="aha">Aha</span>!
          </h1>
          <p>Your Personal Online Math Tutor</p>
        </div>
        <Link to="/login">
          <button className="btn btn-submit" style={{ position: 'absolute', top: '1rem', right: '1rem' }}>Login</button>
        </Link>
      </header>

      <main className="tutor-main">
        <div className="chat-section">
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="welcome-message">
                <h2>Welcome to FlipAha! 👋</h2>
                <p>Ask me any math question and I'll help you understand it step by step.</p>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => <ChatMessage key={idx} message={msg} />)}
                {loading && <ChatMessage message={{ text: 'Thinking...', role: 'loading' }} />}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        <div className="input-section">
          <MessageInput onSubmit={handleSubmitQuestion} disabled={loading} />
          {responseStatus.message && (
            <div className={`response-message ${responseStatus.type}`}>
              {responseStatus.message}
            </div>
          )}
        </div>
      </main>

      <footer>
        <p>&copy; 2026 FlipAha - Math Tutoring Made Easy</p>
      </footer>
    </div>
  )
}

function App() {
  return (
    <Router>
    <Routes>
      <Route path="/" element={<Chat />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
    </Routes>
    </Router>
  )
}

export default App
