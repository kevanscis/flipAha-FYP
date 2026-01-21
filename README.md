# FlipAha - Math Tutor Application

A modern web application with a **Python Flask** backend and **React + Vite** frontend for interactive math tutoring and equation image-to-LaTeX conversion.

## ✨ Features

### 💬 Chat Tutor
- Interactive Q&A with math explanations
- Step-by-step solutions
- Topic classification

### 📸 Equation Scanner (NEW!)
- **Upload handwritten equation images**
- **AI-powered LaTeX conversion** using transformer models
- **Interactive image cropping**
- **Quality warnings** for optimal accuracy
- **Edit converted LaTeX** before use
- **Rate conversions** for quality tracking
- **Session-based image gallery**
- **Delete and manage** your images

## 🚀 Quick Start

### Automated Setup (Recommended)

```bash
./setup.sh
```

### Manual Setup

1. **Install Python Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Install Node Dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Run Backend**
   ```bash
   python app.py
   ```

4. **Run Frontend** (in new terminal)
   ```bash
   cd frontend
   npm run dev
   ```

5. **Open Browser**
   Navigate to: http://localhost:5173

## 📖 Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Get started in 5 minutes
- **[EQUATION_FEATURES.md](EQUATION_FEATURES.md)** - Detailed equation scanner documentation
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Technical implementation details

## Project Structure

```
flipAha-FYP/
├── app.py                          # Flask backend with API endpoints
├── requirements.txt                # Python dependencies (ML models included)
├── setup.sh                        # Automated setup script
├── test_backend.py                 # Backend testing suite
├── QUICKSTART.md                   # Quick start guide
├── EQUATION_FEATURES.md            # Equation scanner documentation
├── IMPLEMENTATION_SUMMARY.md       # Technical details
├── backend/
│   ├── image_processor.py         # Image quality & preprocessing
│   ├── latex_converter.py         # ML model for LaTeX conversion
│   ├── session_manager.py         # Session-based storage
│   └── firebase_*.py              # Firebase integration
└── frontend/
    ├── package.json               # Node dependencies
    ├── vite.config.js            # Vite configuration
    └── src/
        ├── App.jsx               # Main app with tabs
        ├── index.css             # Global styles
        └── components/
            ├── ChatMessage.jsx   # Chat UI
            ├── MessageInput.jsx  # Input UI
            ├── ImageUploader.jsx # Image upload & crop
            ├── LatexEditor.jsx   # LaTeX edit & rate
            └── ImageGallery.jsx  # Image management
```

## 🛠️ Tech Stack

### Backend
- **Flask** - Web framework
- **Pix2Tex** - LaTeX OCR model (transformer-based)
- **Pix2Text** - Optional OCR engine (enable with `LATEX_OCR_ENGINE=pix2text`)
- **OpenCV** - Image processing
- **PyTorch** - ML framework
- **Pillow** - Image manipulation

## OCR Engine Selection

By default, the backend uses **Pix2Tex**.

To use **Pix2Text** instead:

```bash
LATEX_OCR_ENGINE=pix2text python app.py
```

Note: the first conversion request may take longer while Pix2Text downloads/initializes its models.

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **KaTeX** - LaTeX rendering
- **react-image-crop** - Image cropping

## 📋 API Endpoints

### Chat
- `POST /api/questions` - Ask math questions

### Equation Scanner
- `POST /api/session` - Create session
- `POST /api/upload` - Upload image
- `POST /api/crop` - Crop image
- `POST /api/convert` - Convert to LaTeX
- `GET /api/images` - List all images
- `GET /api/image/:id` - Get image details
- `DELETE /api/image/:id` - Delete image
- `PUT /api/latex` - Update LaTeX
- `POST /api/rate` - Rate conversion

## Setup Instructions

### 1. Install Python Dependencies (Backend)

```ensure you are in flipAha-FYP folder```
```bash
pip install -r requirements.txt
```

### 2. Install Node Dependencies (Frontend)

```bash
cd frontend
npm install
```

### 3. Run the Flask Backend

```bash
python app.py
```

The backend will start on `http://localhost:5000`

### 4. Run the React Frontend (in a separate terminal)

```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:5173`

## 🧪 Testing

Test backend functionality:
```bash
python test_backend.py
```

## 💡 Usage

### Chat Tutor
1. Click "💬 Chat Tutor" tab
2. Type your math question
3. Get instant explanations

### Equation Scanner
1. Click "📸 Equation Scanner" tab
2. Upload an equation image
3. Optionally crop to focus area
4. Click "Convert to LaTeX"
5. Edit if needed
6. Rate the accuracy
7. View all images in gallery

## 🎯 Tips for Best Results

### Image Quality
- ✅ Good lighting, no shadows
- ✅ Clear focus, sharp text
- ✅ High contrast (dark on light)
- ✅ Straight angle, minimum 100x100px
- ❌ Avoid blurry or faded writing

## 📝 API Documentation

See [EQUATION_FEATURES.md](EQUATION_FEATURES.md) for complete API documentation.

## Environment Configuration

### Frontend `.env`
The frontend uses an environment variable to configure the API URL:

```env
VITE_API_BASE_URL=http://localhost:5000
```

Copy `.env.example` files:
```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

## 🔧 Troubleshooting

### Model Loading Issues
- First-time download takes 1-2 minutes
- Requires ~2GB RAM
- Falls back to TrOCR if Pix2Tex unavailable

### Connection Issues
- **CORS Error**: Verify backend on port 5000, frontend on 5173
- **Connection Refused**: Start backend before frontend
- **Module Not Found**: Run `pip install -r requirements.txt`

### Image Upload Issues
- Check file size (max 10MB)
- Verify format (PNG, JPG, etc.)
- Review quality warnings

## 🚀 Deployment

For production:
1. Set `FLASK_ENV=production`
2. Use proper database for sessions (Redis/PostgreSQL)
3. Add authentication
4. Use cloud storage for images
5. Configure proper CORS origins

## 📄 License

Educational project for FlipAha FYP

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

---

Built with ❤️ for math education
