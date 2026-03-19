---
title: FlipAha
emoji: 📚
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# FlipAha

FlipAha is a full-stack mathematical education application with:

- 💬 **Chat Tutor**: Interactive math Q&A (keyword-based responses)
- 📸 **Equation Scanner**: Upload equation images → Convert to LaTeX → Edit/Rate → Browse gallery

**Backend**: Flask (Python)  
**Frontend**: Vanilla JavaScript + HTML/CSS

## Quick Start

### Prerequisites

- Python 3.10+ (required for dependencies)
- Pip (Python package manager)
- Browser (Chrome, Safari, Firefox)

### 1. Setup Backend with Virtual Environment

Navigate to the project root and create/activate a Python virtual environment:

```bash
# Create virtual environment (one time only)
python3 -m venv venv

# Activate the virtual environment
# On macOS/Linux:
source venv/bin/activate

# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt
```

**Note**: Always activate the virtual environment before running the backend!

### 2. Run the Backend

From the project root (with `venv` activated):

```bash
./venv/bin/python backend/app.py
```

You should see:
```
* Running on http://127.0.0.1:5000
* Debug mode: on
```

### 3. Open Frontend

Open your browser and go to:

```
http://127.0.0.1:5000
```

The frontend is served directly from the Flask backend (no separate build needed).

## Configuration

### Backend Environment Variables

Optional - set before running the backend:

```bash
# Choose OCR engine (default: pix2text)
export LATEX_OCR_ENGINE=pix2text

# Or to use the older Pix2Tex model:
export LATEX_OCR_ENGINE=pix2tex

# Run with environment variable set
python backend/app.py
```

### Frontend API Configuration

If the backend is on a different host/port, edit `frontend/equation-scanner.js`:

```javascript
const API_BASE_URL = 'http://localhost:5000';  // Change this
```

## Usage

### Chat Tutor

1. Open the **Chat Tutor** tab
2. Enter a question like “What is the derivative of $x^2$?”

### Equation Scanner workflow

1. Open the **Equation Scanner** tab
2. **Select Image** → **Upload**
3. Optionally **Crop** to the equation region
4. Click **Convert to LaTeX**
5. Review the **Rendered Equation** and **LaTeX Code**
6. Optionally **Edit** → **Save Changes**
7. Optionally rate the result (⭐ 1–5)

Tips for better accuracy:

- Crop tightly around the equation
- Use good lighting and high contrast
- Try “High accuracy (slower)” in the UI

## API (backend)

Health:

- `GET /health`

Chat:

- `POST /api/questions`

Equation Scanner:

- `POST /api/session`
- `POST /api/upload`
- `POST /api/crop`
- `POST /api/convert`
- `GET /api/images`
- `GET /api/image/:id`
- `DELETE /api/image/:id`
- `PUT /api/latex`
- `POST /api/rate`

## Troubleshooting

### `net::ERR_CONNECTION_REFUSED` to `http://localhost:5000` (often on macOS)

First, double-check the backend is actually running.

If the backend is running but your browser still shows connection refused to `localhost`, some macOS setups resolve `localhost` to IPv6 (`::1`) while the Flask dev server is only reachable on IPv4.

- Keep the repo default as-is for portability.
- On macOS, create a local-only override file (it is already gitignored):
    - Create `frontend/.env.local` with:
        - `VITE_API_BASE_URL=http://127.0.0.1:5000`

Then restart the frontend dev server so Vite reloads env vars.

### “Failed to fetch” / network errors

- Confirm backend is running: `curl http://localhost:5000/health`
- If that fails but you believe the backend is running, try: `curl http://127.0.0.1:5000/health`
- Confirm frontend API base URL is correct (`VITE_API_BASE_URL`)
- If port 5000 is stuck: `lsof -ti :5000 | xargs kill -9`

### Model is slow / hangs on first conversion

- First-time model initialization can take a while.
- Keep the backend running and try converting again after the initial load.

## Testing

Backend smoke test:

```bash
python test_backend.py
```

## Project Structure

```
flipAha-FYP/
├── app.py
├── requirements.txt
├── backend/
│   ├── image_processor.py
│   ├── latex_converter.py
│   └── session_manager.py
└── frontend/
    ├── vite.config.js
    └── src/
        ├── App.jsx
        └── components/
            ├── ImageUploader.jsx
            ├── LatexEditor.jsx
            └── ImageGallery.jsx
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for diagrams and data flow.

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
