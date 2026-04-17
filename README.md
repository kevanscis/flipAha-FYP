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
# App/server
export PORT=5000
export FLASK_ENV=development
export SECRET_KEY=change-me

# Choose OCR engine (default: pix2text)
export LATEX_OCR_ENGINE=pix2text

# Or to use the older Pix2Tex model:
export LATEX_OCR_ENGINE=pix2tex

# Optional: lighter runtime mode
export LITE_MODE=true

# Optional: allow a production frontend origin
export CORS_ORIGIN=https://your-frontend.example

# Optional: admin registration secret
export ADMIN_SECRET_CODE=ADMIN123

# Run with environment variable set
python backend/app.py
```

### Frontend API Configuration

If the backend is on a different host/port, update `API_BASE_URL` in these files:

- `frontend/app.js`
- `frontend/equation_scanner/equation-scanner.js`
- `frontend/Dashboard/dashboard.js`
- `frontend/Login and Register/login.js`
- `frontend/Login and Register/register.js`

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
- `GET /api/llm/health`

Auth/session:

- `POST /register`
- `POST /login`
- `POST /logout`
- `GET /api/me`

Chat:

- `POST /api/questions`
- `POST /api/equation-draft`
- `POST /api/suggestions`
- `POST /api/suggestion-feedback`
- `GET /api/suggestion-feedback/training-data`
- `GET /api/suggestion-feedback/scores`
- `POST /api/response-quality`
- `POST /api/log-input-method`

Equation Scanner:

- `POST /api/upload`
- `POST /api/convert`
- `GET /api/images`
- `DELETE /api/image/:id`
- `POST /api/scan-feedback`

Dashboard (admin):

- `GET /api/dashboard/active-users`
- `GET /api/dashboard/active-trend`
- `GET /api/dashboard/new-returning`
- `GET /api/dashboard/question-volume`
- `GET /api/dashboard/input-method-trends`
- `GET /api/dashboard/topic-frequency`
- `GET /api/dashboard/question-difficulty`
- `GET /api/dashboard/suggestion-feedback`
- `GET /api/dashboard/image-feedback`

## Troubleshooting

### `net::ERR_CONNECTION_REFUSED` to `http://localhost:5000` (often on macOS)

First, double-check the backend is actually running.

If the backend is running but your browser still shows connection refused to `localhost`, some macOS setups resolve `localhost` to IPv6 (`::1`) while the Flask dev server is only reachable on IPv4.

- Update `API_BASE_URL` constants in the frontend files (see Configuration above) to use:
    - `http://127.0.0.1:5000`
- Restart the backend and reload the browser.

### “Failed to fetch” / network errors

- Confirm backend is running: `curl http://localhost:5000/health`
- If that fails but you believe the backend is running, try: `curl http://127.0.0.1:5000/health`
- Confirm frontend API base URL is correct (`API_BASE_URL` in frontend JS files)
- If port 5000 is stuck: `lsof -ti :5000 | xargs kill -9`

### Model is slow / hangs on first conversion

- First-time model initialization can take a while.
- Keep the backend running and try converting again after the initial load.

## Testing

Quick backend smoke checks:

```bash
curl http://127.0.0.1:5000/health
curl http://127.0.0.1:5000/api/llm/health
```

## Project Structure

```
flipAha-FYP/
├── ARCHITECTURE.md
├── README.md
├── backend/
│   ├── app.py
│   ├── analytics.py
│   ├── image_processor.py
│   ├── latex_converter.py
│   ├── login.py
│   ├── register.py
│   ├── requirements.txt
│   ├── session_manager.py
│   └── database/
│       ├── db.py
│       ├── schema.py
│       └── seed.py
└── frontend/
    ├── app.js
    ├── index.html
    ├── nav.js
    ├── styles.css
    ├── Dashboard/
    │   ├── dashboard.css
    │   ├── dashboard.html
    │   └── dashboard.js
    ├── equation_scanner/
    │   ├── equation-scanner.html
    │   └── equation-scanner.js
    ├── imageHistory/
    │   ├── image-history.html
    │   └── image-history.js
    ├── Login and Register/
    │   ├── login.html
    │   ├── login.js
    │   ├── register.html
    │   └── register.js
    ├── scripts/
    │   └── train_ranker.mjs
    └── src/
        ├── index.css
        └── core/
            ├── ambiguity-resolver.js
            ├── grammar-parser.js
            └── suggestion-ranker.js
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for diagrams and data flow.

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
