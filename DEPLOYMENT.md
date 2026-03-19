# FlipAha — Deployment Guide (Free Tier)

## What you have

| Component | Tech | Notes |
|-----------|------|-------|
| Backend | Python / Flask | Serves the API **and** the frontend HTML/JS/CSS |
| Frontend | Vanilla HTML + JS (no build step) | Served by Flask from the `frontend/` folder |
| Database | SQLite file (`backend/database/app.db`) | Lightweight, single-file database |
| ML Models | Pix2Text, Pix2Tex, TrOCR + PyTorch | Heavy (~1–2 GB RAM) — equation scanner only |
| LLM | Pollinations free API (external) | Chat tutor feature — no API key needed |
| Auth | Flask sessions + pbkdf2 password hashing | |

---

## Platform Choice: **Render** (recommended for this project)

| Platform | Works? | Why / Why Not |
|----------|--------|---------------|
| **Render** | **Yes** | Free web service, runs Python, supports persistent disk (paid), simple deploy from GitHub |
| Vercel | **No** | Serverless-only, no Python backend support, no SQLite |
| Railway | Maybe | $5/month credit, similar to Render. Good alternative |
| Fly.io | Maybe | 256 MB free VMs — too small for this app |
| Heroku | Maybe | No free tier anymore (cheapest is $5/month) |

**Render free tier limits:**
- 512 MB RAM
- Spins down after 15 minutes of inactivity (first request after sleep takes ~30–60s)
- Ephemeral disk — SQLite data resets on each deploy (see workarounds below)

---

## Step-by-Step Deployment on Render

### 1. Push your code to GitHub

```bash
git add -A
git commit -m "Prep for deployment"
git push origin main
```

### 2. Create a Render account

Go to [https://render.com](https://render.com) and sign up with your GitHub account.

### 3. Deploy using the Blueprint (easiest)

1. Go to **Dashboard → New → Blueprint**
2. Connect your GitHub repo
3. Render reads `render.yaml` and auto-configures everything
4. Click **Apply** — it will build and deploy

### 3b. (Alternative) Manual setup

1. **Dashboard → New → Web Service**
2. Connect your GitHub repo
3. Set these values:
   - **Runtime:** Python
   - **Build Command:** `cd backend && pip install -r requirements.txt`
   - **Start Command:** `cd backend && gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
4. Add environment variables (see below)
5. Click **Deploy**

### 4. Set Environment Variables

In the Render dashboard, go to your service → **Environment**:

| Variable | Value | Required? |
|----------|-------|-----------|
| `SECRET_KEY` | (generate a random string — `python -c "import secrets; print(secrets.token_hex(32))"`) | **Yes** |
| `ADMIN_SECRET_CODE` | Your admin registration code | **Yes** |
| `LITE_MODE` | `true` | **Yes** (on free tier) |
| `FLASK_ENV` | `production` | **Yes** |
| `CORS_ORIGIN` | `https://your-app-name.onrender.com` | Optional (but recommended) |

### 5. Wait for build

First build takes 3–5 minutes. Watch the logs in the Render dashboard. You should see:
```
[INFO] LITE_MODE enabled — ML models disabled to save memory
 * Running on http://0.0.0.0:10000
```

### 6. Open your app

Your app will be at: `https://your-app-name.onrender.com`

---

## Important Caveats

### Equation Scanner won't work on free tier

The ML models (Pix2Text/Pix2Tex/TrOCR + PyTorch) need ~1–2 GB RAM. The free tier only has 512 MB. That's why `LITE_MODE=true` skips loading them.

**The Chat Tutor (main feature) works perfectly** — it uses the Pollinations API which is external and free.

To enable the equation scanner, you need a **paid Render plan** ($7/month for 1 GB RAM, or $25/month for 2 GB).

### SQLite data is ephemeral on free tier

Render's free tier uses an ephemeral filesystem — your `app.db` file resets every time you deploy or the service restarts. This means:
- User accounts are lost on redeploy
- Question history is lost on redeploy

**Workarounds (in order of simplicity):**

1. **Accept it** — for an FYP demo, this is often fine. Seed data before each demo.
2. **Render Persistent Disk** ($0.25/GB/month, paid plan required) — attach a disk and point your DB path to it.
3. **Switch to PostgreSQL** — use [Neon](https://neon.tech) free tier (0.5 GB) or [Supabase](https://supabase.com) free tier. Requires code changes to switch from SQLite.
4. **Use Turso** — [turso.tech](https://turso.tech) offers free SQLite-compatible cloud database. Needs a minor driver change (`libsql` instead of `sqlite3`).

### Cold starts

On the free tier, Render spins down your service after 15 minutes of no traffic. The next request will take 30–60 seconds while it spins back up. This is normal.

---

## What was changed to make deployment work

| Change | File(s) | Why |
|--------|---------|-----|
| Hardcoded `localhost:5000` URLs → relative `''` | `app.js`, `login.js`, `register.js`, `dashboard.js`, `equation-scanner.js` | Frontend is served from the same origin as the API |
| Secret key → `SECRET_KEY` env var | `backend/app.py` | Never commit secrets to Git |
| Admin code → `ADMIN_SECRET_CODE` env var | `backend/register.py` | Same reason |
| Added `gunicorn` to requirements | `backend/requirements.txt` | Flask's dev server is not for production |
| `app.run()` uses `PORT` env var + `0.0.0.0` host | `backend/app.py` | Render sets `PORT` dynamically |
| CORS allows `CORS_ORIGIN` env var | `backend/app.py` | Support production domain |
| `LITE_MODE` skips ML model loading | `backend/latex_converter.py` | Saves ~1 GB RAM on free tier |
| Created `render.yaml` | root | Render Blueprint auto-config |
| Created `.env.example` | root | Documents all env vars |
| Added `.env` to `.gitignore` | root | Prevent leaking secrets |

---

## Local development (still works the same)

```bash
cd backend
pip install -r requirements.txt
python app.py          # runs on http://localhost:5000 with debug mode
```

Or with gunicorn:
```bash
cd backend
gunicorn app:app --bind 0.0.0.0:5000 --reload
```

---

## Generating a secure secret key

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output and paste it as the `SECRET_KEY` value in Render's environment settings.
