import { useEffect, useMemo, useRef, useState } from 'react'
import { MathJax, MathJaxContext } from 'better-react-mathjax'
import './LatexEditor.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

function sanitizeLatexForMathJax(input) {
  let expr = (input || '').trim()
  if (!expr) return ''

  // Strip common math delimiters if users include them.
  if (expr.startsWith('$$') && expr.endsWith('$$')) {
    expr = expr.slice(2, -2).trim()
  } else if (expr.startsWith('$') && expr.endsWith('$')) {
    expr = expr.slice(1, -1).trim()
  } else if (expr.startsWith('\\[') && expr.endsWith('\\]')) {
    expr = expr.slice(2, -2).trim()
  } else if (expr.startsWith('\\(') && expr.endsWith('\\)')) {
    expr = expr.slice(2, -2).trim()
  }

  // Pix2Tex sometimes emits \mathcal{\chi} (\mathcal is for Latin letters).
  // MathJax can fail hard on this; unwrap \mathcal when the argument is a control sequence.
  expr = expr.replace(/\\mathcal\s*\{\s*(\\[a-zA-Z]+)\s*\}/g, '$1')

  // MathJax prefers \{ and \} over \lbrace/\rbrace.
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
        // Drop extra close brace.
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

function LatexEditor({ sessionId, imageId, initialLatex, confidence, imageData, filename, onUpdate }) {
  const [latex, setLatex] = useState(initialLatex || '')
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rating, setRating] = useState(null)
  const [error, setError] = useState(null)
  const [typesetError, setTypesetError] = useState(null)
  const typesetContainerRef = useRef(null)

  // IMPORTANT: keep internal latex state in sync with the selected image.
  // Without this, switching images or converting a new image won't update until refresh.
  useEffect(() => {
    setLatex(initialLatex || '')
    setIsEditing(false)
    setSaving(false)
    setError(null)
    setTypesetError(null)
    setRating(null)
  }, [imageId, initialLatex])

  const renderPrep = useMemo(() => {
    const expr = sanitizeLatexForMathJax(latex)
    if (!expr) return { expr: '', fixedExpr: '', valid: true, note: null }

    const { balance, minBalance } = balanceBraces(expr)
    const valid = balance === 0 && minBalance >= 0
    const fixedExpr = valid ? expr : autoFixBraces(expr)

    const fixedStats = valid ? null : balanceBraces(fixedExpr)
    const fixedValid = valid || (fixedStats.balance === 0 && fixedStats.minBalance >= 0)

    return {
      expr,
      fixedExpr,
      valid: fixedValid,
      note: valid
        ? null
        : fixedValid
          ? 'Auto-fixed unmatched braces for preview.'
          : 'LaTeX appears malformed (unmatched braces).'
    }
  }, [latex])

  const mathJaxConfig = useMemo(
    () => ({
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
    }),
    []
  )

  const handleSave = async () => {
    if (!sessionId || !imageId) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/latex`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: sessionId,
          image_id: imageId,
          latex: latex
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save')
      }

      setIsEditing(false)
      if (onUpdate) {
        onUpdate(latex)
      }

    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRate = async (newRating) => {
    if (!sessionId || !imageId) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: sessionId,
          image_id: imageId,
          rating: newRating
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to rate')
      }

      setRating(newRating)

    } catch (err) {
      setError(err.message)
    }
  }

  const renderStars = () => {
    return [1, 2, 3, 4, 5].map((star) => (
      <span
        key={star}
        onClick={() => handleRate(star)}
        className={`star ${rating >= star ? 'filled' : ''}`}
        style={{ cursor: 'pointer', fontSize: '24px' }}
      >
        {rating >= star ? '★' : '☆'}
      </span>
    ))
  }

  return (
    <div className="latex-editor">
      <div className="editor-header">
        <h3>LaTeX Output</h3>
        {confidence && (
          <span className="confidence-badge">
            Confidence: {(confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {imageData && (
        <div className="original-image-section">
          <h4>Original Equation Image</h4>
          <div className="original-image-container">
            <img src={imageData} alt={filename || 'Equation'} />
            {filename && <p className="image-filename">{filename}</p>}
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="latex-display">
        <h4>Rendered Equation:</h4>
        <div className="latex-render">
          {latex ? (
            <div className="latex-container">
              <MathJaxContext version={3} config={mathJaxConfig}>
                <div className="latex-mathjax" ref={typesetContainerRef}>
                  {renderPrep.valid && !typesetError ? (
                    <>
                      {renderPrep.note && (
                        <p className="latex-render-hint">{renderPrep.note}</p>
                      )}
                      <MathJax
                        dynamic
                        hideUntilTypeset="first"
                        renderMode="pre"
                        typesettingOptions={{ fn: 'tex2chtmlPromise' }}
                        text={renderPrep.fixedExpr}
                        onInitTypeset={() => setTypesetError(null)}
                        onTypeset={() => {
                          const root = typesetContainerRef.current
                          if (!root) return
                          const mjxError = root.querySelector('mjx-merror')
                          if (mjxError) {
                            const msg = (mjxError.textContent || '').trim() || 'MathJax failed to typeset this LaTeX.'
                            setTypesetError(msg)
                          }
                        }}
                      >
                        {renderPrep.fixedExpr}
                      </MathJax>
                    </>
                  ) : (
                    <div className="latex-render-fallback">
                      <p className="latex-render-hint">
                        Unable to render this LaTeX{typesetError ? `: ${typesetError}` : ': syntax error detected.'}
                      </p>
                      <pre className="latex-render-raw">{latex}</pre>
                    </div>
                  )}
                </div>
              </MathJaxContext>
            </div>
          ) : (
            <p className="empty-state">No LaTeX to display</p>
          )}
        </div>
      </div>

      <div className="latex-source">
        <div className="source-header">
          <h4>LaTeX Code:</h4>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="btn btn-small btn-secondary"
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {isEditing ? (
          <div className="editor-container">
            <textarea
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              rows={6}
              className="latex-textarea"
              placeholder="Enter LaTeX code..."
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
              style={{ marginTop: '8px' }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        ) : (
          <pre className="latex-code">{latex || 'No LaTeX code'}</pre>
        )}
      </div>

      <div className="rating-section">
        <h4>Rate this conversion:</h4>
        <div className="stars-container">
          {renderStars()}
        </div>
        {rating && (
          <p className="rating-text">Thank you for rating: {rating} stars</p>
        )}
      </div>

      <div className="copy-section">
        <button
          onClick={() => {
            navigator.clipboard.writeText(latex)
            alert('LaTeX copied to clipboard!')
          }}
          className="btn btn-outline"
        >
          Copy LaTeX
        </button>
      </div>
    </div>
  )
}

export default LatexEditor
