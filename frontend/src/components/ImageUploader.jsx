import { useMemo, useState, useRef } from 'react'
import ReactCrop from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import './ImageUploader.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

function ImageUploader({ sessionId, onImageUploaded, onSessionCreated }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [qualityWarnings, setQualityWarnings] = useState([])
  const [crop, setCrop] = useState(null)
  const [showCrop, setShowCrop] = useState(false)
  const [completedCrop, setCompletedCrop] = useState(null)
  const [completedCropPercent, setCompletedCropPercent] = useState(null)
  const [uploadedImageId, setUploadedImageId] = useState(null)
  const [converting, setConverting] = useState(false)
  const [highAccuracy, setHighAccuracy] = useState(false)
  
  const fileInputRef = useRef(null)
  const imageRef = useRef(null)

  const defaultPercentCrop = useMemo(() => {
    return { unit: '%', x: 10, y: 10, width: 80, height: 60 }
  }, [])

  const stage = useMemo(() => {
    if (!selectedFile) return 'select'
    if (selectedFile && !uploadedImageId) return 'upload'
    if (uploadedImageId && showCrop) return 'crop'
    if (uploadedImageId) return 'convert'
    return 'select'
  }, [selectedFile, uploadedImageId, showCrop])

  const ensureDefaultCrop = () => {
    if (!crop) setCrop(defaultPercentCrop)
    if (!completedCropPercent) setCompletedCropPercent(defaultPercentCrop)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp']
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload an image file.')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size too large. Maximum size is 10MB.')
      return
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setError(null)
    setQualityWarnings([])
    setShowCrop(false)
    setUploadedImageId(null)
    setCrop(null)
    setCompletedCrop(null)
    setCompletedCropPercent(null)
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    setError(null)
    setQualityWarnings([])

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      if (sessionId) {
        formData.append('session_id', sessionId)
      }

      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.warnings && data.warnings.length > 0) {
          setQualityWarnings(data.warnings)
        }
        throw new Error(data.error || 'Upload failed')
      }

      // Update session ID if new one was created
      if (data.session_id && data.session_id !== sessionId) {
        onSessionCreated(data.session_id)
        localStorage.setItem('flipaha_session_id', data.session_id)
      }

      setUploadedImageId(data.image_id)
      setPreviewUrl(data.preview)
      
      if (data.quality.warnings && data.quality.warnings.length > 0) {
        setQualityWarnings(data.quality.warnings)
      }

      // Notify parent component
      if (onImageUploaded) {
        onImageUploaded({
          imageId: data.image_id,
          filename: data.filename,
          preview: data.preview
        })
      }

      // Automatically show crop tool after upload
      setShowCrop(true)
      ensureDefaultCrop()

    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleCropComplete = async () => {
    if (!uploadedImageId || !sessionId) return

    const cropPayload = completedCropPercent || crop
    if (!cropPayload) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/crop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: sessionId,
          image_id: uploadedImageId,
          crop_percent: {
            x: cropPayload.x,
            y: cropPayload.y,
            width: cropPayload.width,
            height: cropPayload.height,
            unit: cropPayload.unit || '%'
          }
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Crop failed')
      }

      setPreviewUrl(data.preview)
      setShowCrop(false)
      setCrop(null)
      setCompletedCrop(null)
      setCompletedCropPercent(null)

      // Notify parent so the LaTeX panel shows the cropped image immediately.
      if (onImageUploaded) {
        onImageUploaded({
          imageId: uploadedImageId,
          filename: selectedFile?.name,
          preview: data.preview
        })
      }

    } catch (err) {
      setError(err.message)
    }
  }

  const handleConvert = async () => {
    if (!uploadedImageId || !sessionId) return

    setConverting(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: sessionId,
          image_id: uploadedImageId,
          options: {
            high_accuracy: highAccuracy,
            preprocess: 'auto'
          }
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Conversion failed')
      }

      // Notify parent to show result
      if (onImageUploaded) {
        onImageUploaded({
          imageId: uploadedImageId,
          filename: selectedFile?.name,
          preview: previewUrl,
          latex: data.latex,
          confidence: data.confidence,
          converted: true
        })
      }

    } catch (err) {
      setError(err.message)
    } finally {
      setConverting(false)
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setError(null)
    setQualityWarnings([])
    setShowCrop(false)
    setCrop(null)
    setCompletedCrop(null)
    setCompletedCropPercent(null)
    setUploadedImageId(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="image-uploader">
      <h2>Upload Equation Image</h2>

      <div className="uploader-steps" aria-label="Upload steps">
        <div className={`step ${stage === 'select' ? 'active' : ''} ${['upload','crop','convert'].includes(stage) ? 'done' : ''}`}>1. Select</div>
        <div className={`step ${stage === 'upload' ? 'active' : ''} ${['crop','convert'].includes(stage) ? 'done' : ''}`}>2. Upload</div>
        <div className={`step ${stage === 'crop' ? 'active' : ''} ${stage === 'convert' ? 'done' : ''}`}>3. Crop</div>
        <div className={`step ${stage === 'convert' ? 'active' : ''}`}>4. Convert</div>
      </div>
      
      <div className="upload-controls">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="btn btn-primary"
          disabled={uploading}
        >
          Select Image
        </button>

        {selectedFile && !uploadedImageId && (
          <button
            onClick={handleUpload}
            className="btn btn-success"
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        )}

        {uploadedImageId && (
          <>
            {!showCrop ? (
              <>
                <button
                  onClick={() => {
                    setShowCrop(true)
                    ensureDefaultCrop()
                  }}
                  className="btn btn-secondary"
                >
                  Adjust Crop
                </button>

                <button
                  onClick={handleConvert}
                  className="btn btn-success"
                  disabled={converting}
                >
                  {converting ? 'Converting...' : 'Convert to LaTeX'}
                </button>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: '#6b7280' }}>
                  <input
                    type="checkbox"
                    checked={highAccuracy}
                    onChange={(e) => setHighAccuracy(e.target.checked)}
                  />
                  High accuracy (slower)
                </label>
              </>
            ) : (
              <button
                onClick={() => setShowCrop(false)}
                className="btn btn-secondary"
              >
                Skip Cropping
              </button>
            )}
          </>
        )}

        {selectedFile && (
          <button
            onClick={handleReset}
            className="btn btn-outline"
          >
            Reset
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {qualityWarnings.length > 0 && (
        <div className="alert alert-warning">
          <strong>Quality Warnings:</strong>
          <ul>
            {qualityWarnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
          <p>You can still proceed, but accuracy may be affected.</p>
        </div>
      )}

      {previewUrl && (
        <div className="preview-container">
          <h3>Preview</h3>
          {showCrop ? (
            <div className="crop-panel">
              <div className="crop-help">
                <div className="crop-help-title">Crop (recommended)</div>
                <div className="crop-help-text">Drag to select the equation area. Resize with corners. Use “Apply Crop” when ready.</div>
              </div>

              <div className="crop-stage">
                <ReactCrop
                  crop={crop || defaultPercentCrop}
                  ruleOfThirds
                  keepSelection
                  onChange={(nextCrop, percentCrop) => {
                    setCrop(nextCrop)
                    if (percentCrop) setCompletedCropPercent(percentCrop)
                  }}
                  onComplete={(pixelCrop, percentCrop) => {
                    setCompletedCrop(pixelCrop)
                    if (percentCrop) setCompletedCropPercent(percentCrop)
                  }}
                >
                  <img
                    ref={imageRef}
                    src={previewUrl}
                    alt="Preview"
                    className="crop-image"
                    onLoad={() => ensureDefaultCrop()}
                  />
                </ReactCrop>
              </div>

              <div className="crop-actions">
                <button
                  onClick={() => {
                    setCrop(defaultPercentCrop)
                    setCompletedCropPercent(defaultPercentCrop)
                    setCompletedCrop(null)
                  }}
                  className="btn"
                  type="button"
                >
                  Reset selection
                </button>

                <button
                  onClick={() => setShowCrop(false)}
                  className="btn btn-secondary"
                  type="button"
                >
                  Cancel
                </button>

                <button
                  onClick={handleCropComplete}
                  className="btn btn-primary"
                  type="button"
                  disabled={!completedCropPercent && !crop}
                >
                  Apply Crop
                </button>
              </div>
            </div>
          ) : (
            <img
              src={previewUrl}
              alt="Preview"
              style={{ maxWidth: '100%', border: '1px solid #ddd', borderRadius: '8px' }}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default ImageUploader
