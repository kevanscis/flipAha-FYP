import { useState, useEffect } from 'react'
import { MathJax, MathJaxContext } from 'better-react-mathjax'
import './ImageGallery.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

function sanitizeLatexForMathJax(input) {
  let expr = (input || '').trim()
  if (!expr) return ''

  if (expr.startsWith('$$') && expr.endsWith('$$')) {
    expr = expr.slice(2, -2).trim()
  } else if (expr.startsWith('$') && expr.endsWith('$')) {
    expr = expr.slice(1, -1).trim()
  } else if (expr.startsWith('\\[') && expr.endsWith('\\]')) {
    expr = expr.slice(2, -2).trim()
  } else if (expr.startsWith('\\(') && expr.endsWith('\\)')) {
    expr = expr.slice(2, -2).trim()
  }

  expr = expr.replace(/\\mathcal\s*\{\s*(\\[a-zA-Z]+)\s*\}/g, '$1')

  expr = expr.replace(/\\lbrace\b/g, '\\{')
  expr = expr.replace(/\\rbrace\b/g, '\\}')
  return expr
}

function balanceBraces(expr) {
  let balance = 0
  let minBalance = 0

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i]
    const prev = i > 0 ? expr[i - 1] : ''
    if (prev === '\\') continue
    if (ch === '{') balance += 1
    if (ch === '}') balance -= 1
    if (balance < minBalance) minBalance = balance
  }

  return { balance, minBalance }
}

function autoFixBraces(expr) {
  let balance = 0
  let out = ''

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i]
    const prev = i > 0 ? expr[i - 1] : ''
    if (prev === '\\') {
      out += ch
      continue
    }

    if (ch === '{') {
      balance += 1
      out += ch
      continue
    }

    if (ch === '}') {
      if (balance === 0) {
        continue
      }
      balance -= 1
      out += ch
      continue
    }

    out += ch
  }

  if (balance > 0) {
    out += '}'.repeat(balance)
  }

  return out
}

function prepareLatexForPreview(input) {
  const expr = sanitizeLatexForMathJax(input)
  if (!expr) return { valid: true, fixedExpr: '' }

  const { balance, minBalance } = balanceBraces(expr)
  const valid = balance === 0 && minBalance >= 0
  if (valid) return { valid: true, fixedExpr: expr }

  const fixedExpr = autoFixBraces(expr)
  const fixedStats = balanceBraces(fixedExpr)
  const fixedValid = fixedStats.balance === 0 && fixedStats.minBalance >= 0
  return { valid: fixedValid, fixedExpr }
}

function ImageGallery({ sessionId, onImageSelect, refreshTrigger }) {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)

  const mathJaxConfig = {
    loader: {
      load: ['[tex]/ams', '[tex]/newcommand', '[tex]/mathtools']
    },
    tex: {
      packages: { '[+]': ['ams', 'newcommand', 'mathtools'] },
      inlineMath: [
        ['$', '$'],
        ['\\(', '\\)']
      ],
      displayMath: [
        ['$$', '$$'],
        ['\\[', '\\]']
      ]
    },
    options: {
      renderActions: {
        addMenu: []
      }
    }
  }

  useEffect(() => {
    if (sessionId) {
      fetchImages()
    }
  }, [sessionId, refreshTrigger])

  const fetchImages = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/images?session_id=${sessionId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch images')
      }

      setImages(data.images || [])
      setStats(data.stats)

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (imageId) => {
    if (!confirm('Are you sure you want to delete this image?')) {
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/image/${imageId}?session_id=${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete image')
      }

      // Refresh the list
      fetchImages()

    } catch (err) {
      alert(`Error deleting image: ${err.message}`)
    }
  }

  const handleViewImage = async (imageId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/image/${imageId}?session_id=${sessionId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch image')
      }

      if (onImageSelect) {
        onImageSelect(data.image)
      }
      
      // Scroll to top to see the editor
      window.scrollTo({ top: 0, behavior: 'smooth' })

    } catch (err) {
      alert(`Error loading image: ${err.message}`)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  if (loading) {
    return <div className="gallery-loading">Loading images...</div>
  }

  if (error) {
    return <div className="gallery-error">Error: {error}</div>
  }

  if (!sessionId) {
    return <div className="gallery-empty">No session active. Upload an image to start.</div>
  }

  return (
    <MathJaxContext version={3} config={mathJaxConfig}>
      <div className="image-gallery">
        <div className="gallery-header">
          <h2>Your Images</h2>
          <button onClick={fetchImages} className="btn btn-small btn-secondary">
            Refresh
          </button>
        </div>

        {stats && (
          <div className="gallery-stats">
            <div className="stat">
              <span className="stat-label">Total Images:</span>
              <span className="stat-value">{stats.total_images}</span>
            </div>
            {stats.average_rating && (
              <div className="stat">
                <span className="stat-label">Average Rating:</span>
                <span className="stat-value">
                  {stats.average_rating.toFixed(1)} ★
                </span>
              </div>
            )}
          </div>
        )}

        {images.length === 0 ? (
          <div className="gallery-empty">
            <p>No images uploaded yet. Upload your first equation image to get started!</p>
          </div>
        ) : (
          <div className="gallery-grid">
            {images.map((image) => (
              <div key={image.id} className="gallery-item">
                <div className="item-header">
                  <h3>{image.filename}</h3>
                  <button
                    onClick={() => handleDelete(image.id)}
                    className="btn-delete"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>

                {image.latex && (
                  <div className="item-latex">
                    {(() => {
                      const prepared = prepareLatexForPreview(image.edited_latex || image.latex)
                      if (!prepared.valid) {
                        return (
                          <div className="latex-preview-error">
                            <span className="latex-preview-badge">Invalid LaTeX</span>
                          </div>
                        )
                      }
                      return (
                        <MathJax
                          dynamic
                          hideUntilTypeset="first"
                          renderMode="pre"
                          typesettingOptions={{ fn: 'tex2chtmlPromise' }}
                          text={prepared.fixedExpr}
                        >
                          {prepared.fixedExpr}
                        </MathJax>
                      )
                    })()}
                  </div>
                )}

                <div className="item-details">
                  <div className="detail-row">
                    <span className="detail-label">Uploaded:</span>
                    <span className="detail-value">{formatDate(image.uploaded_at)}</span>
                  </div>

                  {image.confidence > 0 && (
                    <div className="detail-row">
                      <span className="detail-label">Confidence:</span>
                      <span className="detail-value">{(image.confidence * 100).toFixed(0)}%</span>
                    </div>
                  )}

                  {image.rating && (
                    <div className="detail-row">
                      <span className="detail-label">Rating:</span>
                      <span className="detail-value">{'★'.repeat(image.rating)}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleViewImage(image.id)}
                  className="btn btn-primary btn-small"
                  style={{ width: '100%' }}
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </MathJaxContext>
  )
}

export default ImageGallery
