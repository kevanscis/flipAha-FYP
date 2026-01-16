# FlipAha - Separated Frontend & Backend Setup

This project now has a separated frontend and backend structure.

## Project Structure

```
flipAha-FYP/
├── frontend/                 # React/Vue/Static Frontend
│   ├── index.html           # Main HTML
│   ├── app.js               # Frontend JavaScript
│   ├── styles.css           # Styling
│   └── assets/              # Images, fonts, etc
├── backend/                 # Node.js Express API
│   ├── src/
│   │   └── server.js        # Main backend server
│   ├── package.json
│   └── .env
└── README.md
```

## Setup Instructions

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (copy from backend/.env):
```bash
PORT=3001
NODE_ENV=development
```

4. Start backend server:
```bash
npm start          # Production
npm run dev        # Development with auto-reload
```

Backend will run on: **http://localhost:3001**

### Frontend Setup

1. Frontend files are in `/frontend/` directory
2. Files:
   - `index.html` - Main HTML file
   - `app.js` - Frontend JavaScript
   - `styles.css` - Styling

3. Serve frontend:
   - **Option A:** Use a simple HTTP server
     ```bash
     cd frontend
     python -m http.server 3000    # Python
     # or
     npx http-server -p 3000        # Node.js
     ```
   
   - **Option B:** Use with backend (backend serves frontend)
     - Update backend `server.js` to serve static files:
     ```javascript
     app.use(express.static(path.join(__dirname, '../frontend')));
     ```

Frontend will run on: **http://localhost:3000** (or your chosen port)

## API Endpoints

### POST /api/questions
Ask a math question
```bash
curl -X POST http://localhost:3001/api/questions \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the derivative of x²?"}'
```

### GET /api/health
Health check
```bash
curl http://localhost:3001/api/health
```

## Development Workflow

### Terminal 1 - Backend
```bash
cd backend
npm run dev
```

### Terminal 2 - Frontend (if separate server)
```bash
cd frontend
npx http-server -p 3000
```

Then open: **http://localhost:3000**

## Environment Variables

### Backend (.env)
```
PORT=3001
NODE_ENV=development
FIREBASE_DATABASE_URL=your-firebase-db-url
```

### Frontend (app.js)
Update the `API_BASE_URL` to point to your backend:
```javascript
const API_BASE_URL = 'http://localhost:3001';  // Development
const API_BASE_URL = 'https://api.example.com'; // Production
```

## Deployment

### Backend Deployment Options:
- Heroku
- AWS Lambda
- DigitalOcean
- Google Cloud Run
- Azure Functions

### Frontend Deployment Options:
- Vercel
- Netlify
- GitHub Pages
- Firebase Hosting
- AWS S3 + CloudFront

## Next Steps

1. **Add Features:**
   - Integration with AI API (OpenAI, Gemini, etc.)
   - User authentication
   - Save question history
   - Database integration (Firebase, MongoDB, PostgreSQL)

2. **Frontend Improvements:**
   - Add build tool (Webpack, Vite)
   - Use a framework (React, Vue, Svelte)
   - Add TypeScript

3. **Backend Improvements:**
   - Add comprehensive logging
   - Add request validation
   - Add rate limiting
   - Add error handling middleware

## Troubleshooting

### Port Already in Use
```bash
# Kill process using port 3001
lsof -ti:3001 | xargs kill -9
```

### CORS Issues
Make sure backend has CORS enabled:
```javascript
app.use(cors());
```

### Frontend can't reach backend
Check:
1. Backend is running on correct port
2. `API_BASE_URL` in frontend/app.js is correct
3. No firewall blocking the connection

## Support

For issues or questions, refer to the main README.md file.