import { useState } from 'react'
import { Link } from 'react-router-dom'
import './Login.module.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

function Login({ onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username || !password) {
      setStatusMessage('Please enter username and password')
      return
    }

    setLoading(true)
    setStatusMessage('Logging in...')

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      })

      const data = await response.json()
      setStatusMessage(data.message)

      if (response.ok && onSuccess) onSuccess()
    } catch (err) {
      console.error(err)
      setStatusMessage('Server error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      {/* FlipAha Header */}
      <header style={{ textAlign: 'center', padding: '2rem 0' }}>
        <h1>
          <span className="flip">Flip</span>
          <span className="aha">Aha</span>!
        </h1>
        <p>Your Personal Online Math Tutor</p>
      </header>

      {/* Login Form */}
      <main>
        <form className="question-form" onSubmit={handleSubmit}>
            {statusMessage && <p>{statusMessage}</p>}

            <div className="input-row">
                <label htmlFor="username">Username:</label>
                <input
                id="username"
                type="text"
                className="question-input"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                />
            </div>

            <div className="input-row">
                <label htmlFor="password">Password:</label>
                <input
                id="password"
                type="password"
                className="question-input"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                />
            </div>

            <div className="btn-center">
                <button type="submit" className="btn btn-submit" disabled={loading}>
                    <span>Login</span>
                    <span className="icon">→</span>
                </button>
            </div>
            
            <div className="auth-link">
                <p>
                    Don’t have an account?{' '}
                    <Link to="/signup">Sign up here</Link>
                </p>
            </div>
        </form>

      </main>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '1rem 0', marginTop: '2rem', color: '#6b7280' }}>
        <p>&copy; 2026 FlipAha - Math Tutoring Made Easy</p>
      </footer>
    </div>
  )
}

export default Login
