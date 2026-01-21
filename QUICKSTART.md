# Quick Start Guide - Equation Image to LaTeX

## Prerequisites

- Python 3.8+ installed
- Node.js 16+ installed
- pip and npm available

## Installation

### Option 1: Automated Setup (Recommended)

```bash
./setup.sh
```

### Option 2: Manual Setup

#### Backend
```bash
pip install -r requirements.txt
```

#### Frontend
```bash
cd frontend
npm install
```

## Running the Application

### Step 1: Start Backend Server

Open a terminal and run:
```bash
python app.py
```

You should see:
```
* Running on http://0.0.0.0:5000
```

The backend will:
- Load the Pix2Tex model (may take 1-2 minutes first time)
- Listen for API requests on port 5000

### Step 2: Start Frontend Development Server

Open a **new terminal** and run:
```bash
cd frontend
npm run dev
```

You should see:
```
  VITE ready in Xms
  ➜  Local:   http://localhost:5173/
```

### Step 3: Open Browser

Navigate to: **http://localhost:5173**

## Using the Equation Scanner

### Basic Workflow

1. **Click "📸 Equation Scanner" tab** in the header

2. **Upload an Image**
   - Click "Select Image"
   - Choose a photo of a handwritten equation
   - Review any quality warnings
   - Click "Upload"

3. **Crop (Optional)**
   - Click "Crop Image"
   - Drag to select the equation area
   - Click "Apply Crop"

4. **Convert to LaTeX**
   - Click "Convert to LaTeX"
   - Wait 5-10 seconds for processing
   - View the rendered equation

5. **Edit if Needed**
   - Click "Edit" button
   - Modify LaTeX code
   - Click "Save Changes"

6. **Rate the Result**
   - Click 1-5 stars to rate accuracy
   - Helps track conversion quality

7. **View Your Images**
   - All uploaded images appear in the gallery
   - Click any image to view details
   - Delete unwanted images with 🗑️

## Tips for Best Results

### Image Quality
- **Good lighting** - Avoid shadows
- **Clear focus** - Ensure text is sharp
- **High contrast** - Dark writing on light background
- **Straight angle** - Photo taken from above
- **Minimum 100x100px** resolution

### Supported Equations
- Handwritten equations
- Printed equations
- Simple to complex math expressions
- Fractions, exponents, roots
- Greek letters and symbols
- Matrices and systems

### What Works Best
✅ Clear handwriting
✅ Standard mathematical notation
✅ Good lighting
✅ High resolution images
✅ Cropped to equation only

### What May Not Work Well
❌ Very messy handwriting
❌ Faded/light writing
❌ Blurry or out-of-focus images
❌ Low resolution images
❌ Non-standard notation

## Troubleshooting

### Backend Issues

**"ModuleNotFoundError"**
```bash
pip install -r requirements.txt
```

**"Address already in use"**
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

**Model loading is slow**
- First-time model download can take 2-5 minutes
- Subsequent loads are faster (model cached)
- Requires ~2GB RAM

### Frontend Issues

**"Cannot GET /"**
- Ensure frontend dev server is running
- Check that it's on port 5173

**"Network Error"**
- Verify backend is running on port 5000
- Check CORS settings in app.py

**Images not uploading**
- Check file size (max 10MB)
- Verify file format (PNG, JPG, etc.)
- Review browser console for errors

### Session Issues

**"Session not found"**
- Sessions expire after 24 hours
- Clear browser localStorage and refresh
- Upload new image to create session

**Images disappeared**
- Session may have expired
- Images are stored in memory (not persistent)
- For production, implement database storage

## Architecture Overview

```
FlipAha-FYP/
├── app.py                      # Main Flask application
├── requirements.txt            # Python dependencies
├── backend/
│   ├── image_processor.py     # Image quality & preprocessing
│   ├── latex_converter.py     # ML model for LaTeX conversion
│   └── session_manager.py     # Session & storage management
└── frontend/
    ├── package.json
    └── src/
        ├── App.jsx            # Main React component
        └── components/
            ├── ImageUploader.jsx   # Upload & crop UI
            ├── LatexEditor.jsx     # Edit & display LaTeX
            └── ImageGallery.jsx    # View all images
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/session` | POST | Create session |
| `/api/upload` | POST | Upload image |
| `/api/crop` | POST | Crop image |
| `/api/convert` | POST | Convert to LaTeX |
| `/api/images` | GET | List all images |
| `/api/image/:id` | GET | Get image details |
| `/api/image/:id` | DELETE | Delete image |
| `/api/latex` | PUT | Update LaTeX |
| `/api/rate` | POST | Rate conversion |

## Example Use Cases

### Homework Help
1. Take photo of problem
2. Upload to FlipAha
3. Get LaTeX code
4. Copy to document editor

### Note Taking
1. Photo of whiteboard equations
2. Convert to digital LaTeX
3. Store in gallery
4. Review anytime

### Study Review
1. Upload old problem sets
2. Convert handwritten work
3. Rate accuracy
4. Edit corrections

## Next Steps

- Try uploading your first equation!
- Experiment with cropping
- Test different types of equations
- Rate conversions to track quality
- Build your equation gallery

## Need Help?

- Check EQUATION_FEATURES.md for detailed documentation
- Review API responses in browser console
- Check backend terminal for error messages
- Verify model loaded successfully

---

Happy equation scanning! 📸✨
