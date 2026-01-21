import { useState, useRef, useEffect } from 'react'
import ChatMessage from './components/ChatMessage'
import MessageInput from './components/MessageInput'
import ImageUploader from './components/ImageUploader'
import LatexEditor from './components/LatexEditor'
import ImageGallery from './components/ImageGallery'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

function App() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [responseStatus, setResponseStatus] = useState({ type: '', message: '' })
  const messagesEndRef = useRef(null)
  
  // Equation image processing states
  const [sessionId, setSessionId] = useState(null)
  const [currentImage, setCurrentImage] = useState(null)
  const [currentLatex, setCurrentLatex] = useState(null)
  const [activeTab, setActiveTab] = useState('chat') // 'chat' or 'equation'
  const [galleryRefresh, setGalleryRefresh] = useState(0)

  useEffect(() => {
    // Try to restore session from localStorage
    const savedSession = localStorage.getItem('flipaha_session_id')
    if (savedSession) {
      setSessionId(savedSession)
    }
  }, [])

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

    // Add user message
    setMessages(prev => [...prev, { text: question, role: 'user' }])
    setLoading(true)
    setResponseStatus({ type: 'loading', message: 'Processing your question...' })

    try {
      const response = await fetch(`${API_BASE_URL}/api/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question: question })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

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

  const handleImageUploaded = (imageData) => {
    // ImageUploader may send partial updates (e.g., convert result only).
    // Merge so we don't lose preview/filename and the LaTeX panel can render immediately.
    setCurrentImage(prev => ({
      ...(prev || {}),
      ...(imageData || {})
    }))
    
    if (imageData.converted && imageData.latex) {
      setCurrentLatex({
        imageId: imageData.imageId,
        latex: imageData.latex,
        confidence: imageData.confidence
      })
      setGalleryRefresh(prev => prev + 1)
    }
  }

  const handleSessionCreated = (newSessionId) => {
    setSessionId(newSessionId)
  }

  const handleImageSelect = (image) => {
    setCurrentImage({
      imageId: image.id,
      filename: image.filename,
      preview: image.data
    })
    setCurrentLatex({
      imageId: image.id,
      latex: image.edited_latex || image.latex,
      confidence: image.confidence
    })
  }

  const handleImageRenamed = (imageId, filename) => {
    setCurrentImage(prev => {
      if (!prev || prev.imageId !== imageId) return prev
      return { ...prev, filename }
    })
    setGalleryRefresh(prev => prev + 1)
  }

  return (
    <div className="container">
      <header>
        <h1>
          <span className="flip">Flip</span>
          <span className="aha">Aha</span>!
        </h1>
        <p>Your Personal Online Math Tutor</p>
        
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            💬 Chat Tutor
          </button>
          <button
            className={`tab-button ${activeTab === 'equation' ? 'active' : ''}`}
            onClick={() => setActiveTab('equation')}
          >
            📸 Equation Scanner
          </button>
        </div>
      </header>

      <main className="tutor-main">
        {activeTab === 'chat' ? (
          <>
            <div className="chat-section">
              <div className="messages-container">
                {messages.length === 0 ? (
                  <div className="welcome-message">
                    <h2>Welcome to FlipAha! 👋</h2>
                    <p>Ask me any math question and I'll help you understand it step by step.</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, idx) => (
                      <ChatMessage key={idx} message={msg} />
                    ))}
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
          </>
        ) : (
          <div className="equation-section">
            <div className="equation-uploader">
              <ImageUploader
                sessionId={sessionId}
                onImageUploaded={handleImageUploaded}
                onSessionCreated={handleSessionCreated}
              />
            </div>
            
            <div className="equation-results">
              <div className="equation-right">
                <ImageGallery
                  sessionId={sessionId}
                  onImageSelect={handleImageSelect}
                  onImageRenamed={handleImageRenamed}
                  refreshTrigger={galleryRefresh}
                />
              </div>

              <div className="equation-left">
                {currentLatex && (
                  <LatexEditor
                    sessionId={sessionId}
                    imageId={currentLatex.imageId}
                    initialLatex={currentLatex.latex}
                    confidence={currentLatex.confidence}
                    imageData={currentImage?.preview}
                    filename={currentImage?.filename}
                    onUpdate={(newLatex) => {
                      setCurrentLatex({ ...currentLatex, latex: newLatex })
                      setGalleryRefresh(prev => prev + 1)
                    }}
                    onRename={(newFilename) => handleImageRenamed(currentLatex.imageId, newFilename)}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer>
        <p>&copy; 2026 FlipAha - Math Tutoring Made Easy</p>
      </footer>
    </div>
  )
}

export default App
