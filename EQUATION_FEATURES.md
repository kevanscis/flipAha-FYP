# FlipAha - Equation Image to LaTeX Converter

## New Features Implemented

This update adds comprehensive equation image processing capabilities to FlipAha, allowing students to convert handwritten equation images to LaTeX.

### User Stories Implemented

✅ **Upload Photo of Handwritten Equation**
- Students can upload images from phone or computer
- Preview images before processing
- Support for PNG, JPG, JPEG, GIF, BMP, TIFF formats
- File size limit: 10MB

✅ **Image to LaTeX Conversion**
- Uses Pix2Tex transformer model (specialized for mathematical equations)
- Automatic preprocessing for better accuracy
- Displays confidence scores

✅ **Manual Cropping**
- Interactive cropping tool using react-image-crop
- Crop before conversion to focus on specific equations
- Real-time preview

✅ **Rating System**
- 5-star rating for each conversion
- Helps track accuracy improvements
- Session statistics showing average ratings

✅ **Session-based Image Storage**
- Images stored in memory per session (24-hour timeout)
- Session ID saved in localStorage for persistence
- Secure session management

✅ **Delete Images**
- Delete unwanted images
- Organize your image library
- Confirmation dialog to prevent accidents

✅ **Edit LaTeX Output**
- Manual editing of generated LaTeX
- Real-time LaTeX rendering with KaTeX
- Copy LaTeX to clipboard

✅ **Image Quality Warnings**
- Automatic quality checks:
  - Resolution validation
  - Sharpness/blur detection
  - Brightness checks
  - Contrast analysis
- Warnings displayed before processing
- Can proceed despite warnings

## Architecture

### Backend (Python/Flask)

#### New Modules

1. **`backend/image_processor.py`**
   - Image quality checking
   - Preprocessing (denoising, thresholding)
   - Cropping functionality
   - Base64 encoding/decoding

2. **`backend/latex_converter.py`**
   - Pix2Tex model integration
   - TrOCR fallback (if Pix2Tex unavailable)
   - LaTeX validation
   - Confidence scoring

3. **`backend/session_manager.py`**
   - Session creation and management
   - Image storage (in-memory)
   - CRUD operations for images
   - Rating system
   - Session cleanup

#### New API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/session` | POST | Create new session |
| `/api/upload` | POST | Upload image with quality check |
| `/api/crop` | POST | Crop uploaded image |
| `/api/convert` | POST | Convert image to LaTeX |
| `/api/images` | GET | Get all images in session |
| `/api/image/<id>` | GET | Get specific image |
| `/api/image/<id>` | DELETE | Delete image |
| `/api/latex` | PUT | Update LaTeX for image |
| `/api/rate` | POST | Rate conversion (1-5 stars) |

### Frontend (React)

#### New Components

1. **`ImageUploader.jsx`**
   - File selection and validation
   - Image preview
   - Upload progress
   - Quality warning display
   - Crop tool integration
   - Convert button

2. **`LatexEditor.jsx`**
   - LaTeX rendering with KaTeX
   - Edit mode with textarea
   - Save changes
   - 5-star rating UI
   - Copy to clipboard
   - Confidence badge

3. **`ImageGallery.jsx`**
   - Grid view of all images
   - LaTeX preview for each
   - Session statistics
   - Delete functionality
   - Click to view details

#### UI Updates

- New "Equation Scanner" tab in navigation
- Two-column layout for equation processing
- Responsive design for mobile devices

## Installation & Setup

### Backend Dependencies

```bash
pip install -r requirements.txt
```

New packages:
- `Pillow` - Image processing
- `transformers` - Transformer models
- `torch` & `torchvision` - PyTorch for ML
- `pix2tex` - LaTeX OCR specialized model
- `opencv-python` - Advanced image processing
- `numpy` - Numerical operations

### Frontend Dependencies

```bash
cd frontend
npm install
```

New packages:
- `react-image-crop` - Interactive cropping
- `react-latex-next` - LaTeX rendering
- `katex` - Math typesetting

## Running the Application

### Start Backend

```bash
python app.py
```

The API will run on `http://localhost:5000`

### Start Frontend

```bash
cd frontend
npm run dev
```

The UI will run on `http://localhost:5173`

## Usage Guide

### Converting an Equation Image

1. **Switch to Equation Scanner Tab**
   - Click "📸 Equation Scanner" in the header

2. **Upload Image**
   - Click "Select Image"
   - Choose an image file
   - Review quality warnings (if any)
   - Click "Upload"

3. **Crop (Optional)**
   - Click "Crop Image"
   - Drag to select region
   - Click "Apply Crop"

4. **Convert to LaTeX**
   - Click "Convert to LaTeX"
   - Wait for processing
   - View rendered equation and LaTeX code

5. **Edit if Needed**
   - Click "Edit" in LaTeX section
   - Modify the LaTeX code
   - Click "Save Changes"

6. **Rate the Result**
   - Click stars to rate (1-5)
   - Helps improve accuracy tracking

7. **Manage Images**
   - View all images in gallery
   - Click any image to view details
   - Delete unwanted images

## Technical Details

### Image Processing Pipeline

1. **Upload & Validation**
   - File type check
   - File size check
   - Quality metrics calculation

2. **Quality Checks**
   - Resolution: Minimum 100x100px
   - Sharpness: Laplacian variance > 50
   - Brightness: 50-200 (0-255 scale)
   - Contrast: Standard deviation > 30

3. **Preprocessing**
   - Grayscale conversion
   - Noise reduction (fastNlMeansDenoising)
   - Adaptive thresholding

4. **Conversion**
   - Pix2Tex model inference
   - LaTeX generation
   - Confidence scoring

### Session Management

- **Duration**: 24 hours from last access
- **Storage**: In-memory (for production, use Redis/Database)
- **Cleanup**: Automatic expiration
- **Persistence**: Session ID in localStorage

### Model Information

**Primary Model: Pix2Tex**
- Specialized for mathematical equations
- Transformer-based architecture
- Handles handwritten and printed equations
- Better accuracy than general OCR

**Fallback Model: TrOCR**
- Microsoft's handwriting recognition
- General text recognition
- Used if Pix2Tex unavailable

## API Response Examples

### Upload Image

```json
{
  "success": true,
  "session_id": "123e4567-e89b-12d3-a456-426614174000",
  "image_id": "987fcdeb-51a2-43f7-b123-456789abcdef",
  "filename": "equation.jpg",
  "preview": "data:image/png;base64,...",
  "quality": {
    "valid": true,
    "warnings": ["Image appears blurry"],
    "metrics": {
      "resolution": "800x600",
      "sharpness": 45.2,
      "brightness": 128.5,
      "contrast": 35.8
    }
  }
}
```

### Convert to LaTeX

```json
{
  "success": true,
  "latex": "\\frac{d}{dx}(x^2) = 2x",
  "confidence": 0.85,
  "model": "pix2tex"
}
```

## Security Considerations

- File type validation
- File size limits
- Session-based isolation
- XSS protection in LaTeX rendering
- CORS configured for localhost

## Future Enhancements

- [ ] Persistent storage (database)
- [ ] User authentication
- [ ] Batch processing
- [ ] Export to PDF
- [ ] Cloud storage integration
- [ ] Fine-tuned model training
- [ ] Multi-language support
- [ ] Equation solving integration

## Troubleshooting

### Model Loading Issues

If Pix2Tex fails to load:
- Check CUDA availability for GPU acceleration
- Ensure sufficient memory (model ~2GB)
- Falls back to TrOCR automatically

### Image Quality Warnings

If you get persistent warnings:
- Ensure good lighting
- Use a stable camera/scanner
- Focus properly
- Increase resolution
- Improve contrast

### Session Expiration

Sessions expire after 24 hours:
- Upload images again
- Consider implementing persistent storage
- Session ID is saved in localStorage for browser restarts

## Development Notes

- Frontend uses Vite for fast development
- Backend uses Flask development server
- Hot reload enabled for both
- CORS configured for localhost:5173

## Contributing

When adding features:
1. Update API documentation
2. Add error handling
3. Include loading states
4. Test quality checks
5. Update this README

---

Built with ❤️ for FlipAha FYP
