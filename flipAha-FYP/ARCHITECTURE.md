# FlipAha Architecture

This document describes FlipAha's runtime architecture, main data flows, the two-layer suggestion engine, and supporting subsystems (authentication, analytics dashboard, database).

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                          User Browser                            │
│                     http://localhost:5000                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────┐ ┌────────────┐ │
│  │  Chat Tutor  │ │   Equation   │ │  Admin   │ │  Login /   │ │
│  │  (index.html │ │   Scanner    │ │Dashboard │ │  Register  │ │
│  │   + app.js)  │ │  (standalone │ │(D3 charts│ │  Pages     │ │
│  │              │ │   + inline   │ │  admin   │ │            │ │
│  │ • MathLive   │ │   modal)     │ │  only)   │ │ • login    │ │
│  │ • KaTeX      │ │ • Cropper.js │ │          │ │ • register │ │
│  │ • Suggestions│ │ • KaTeX      │ │          │ │            │ │
│  │ • Scanner    │ │ • Gallery    │ │          │ │            │ │
│  │   Modal      │ │ • Editor     │ │          │ │            │ │
│  └──────────────┘ └──────────────┘ └──────────┘ └────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            Suggestion Engine (client-side JS)            │   │
│  │                                                          │   │
│  │  Layer 1 (Rule-Based)           Layer 2 (ML-Ranked)     │   │
│  │  • Subject modules (trig,       • Candidate generator   │   │
│  │    logs, vectors, normal)       • Logistic regression   │   │
│  │  • Permutation rules             model (trig ranking)   │   │
│  │  • mathToLatex orchestrator     • Levenshtein scoring   │   │
│  │  • math-extractor-enhanced      • Curriculum filtering  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │  RESTful API (JSON)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Flask Backend                              │
│                    http://localhost:5000                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     API Endpoints                        │   │
│  │                                                          │   │
│  │  Pages:                   Chat / Tutor:                 │   │
│  │  • GET  /                 • POST /api/questions         │   │
│  │  • GET  /login            • POST /api/suggestions       │   │
│  │  • GET  /register         • POST /api/suggestion-feedback│  │
│  │  • GET  /dashboard        • POST /api/response-quality  │   │
│  │  • GET  /image            • POST /api/log-input-method  │   │
│  │  • GET  /<static>         • GET  /api/llm/health        │   │
│  │                                                          │   │
│  │  Auth:                    Equation Scanner:             │   │
│  │  • POST /login            • POST /api/upload            │   │
│  │  • POST /register         • POST /api/convert           │   │
│  │  • POST /logout           • GET  /api/images            │   │
│  │  • GET  /api/me           • GET  /api/image/:id         │   │
│  │                           • DELETE /api/image/:id       │   │
│  │  Health:                  • PUT  /api/image/:id/rename  │   │
│  │  • GET  /health           • PUT  /api/latex             │   │
│  │                           • POST /api/rate              │   │
│  │  Dashboard (Admin):       • POST /api/update            │   │
│  │  • GET  /api/dashboard/active-users                     │   │
│  │  • GET  /api/dashboard/active-trend                     │   │
│  │  • GET  /api/dashboard/new-returning                    │   │
│  │  • GET  /api/dashboard/question-volume                  │   │
│  │  • GET  /api/dashboard/input-method-trends              │   │
│  │  • GET  /api/dashboard/topic-frequency                  │   │
│  │  • GET  /api/dashboard/suggestion-feedback              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │ ImageProcessor   │  │ LatexConverter   │  │ SessionManager │  │
│  │                  │  │                  │  │  (in-memory)   │  │
│  │ • Quality check  │  │ • Pix2Text (def) │  │ • 24hr timeout │  │
│  │ • Preprocess     │  │ • Pix2Tex (fb)   │  │ • Image store  │  │
│  │   (none/mild/    │  │ • TrOCR (fb)     │  │ • LaTeX data   │  │
│  │    binarize)     │  │ • Lazy init      │  │ • Ratings      │  │
│  │ • Crop           │  │ • Confidence     │  │                │  │
│  │ • Base64 convert │  │ • Validation     │  │                │  │
│  │                  │  │ • Scoring        │  │                │  │
│  └─────────────────┘  └─────────────────┘  └────────────────┘  │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │  Cloud LLM      │  │  Analytics      │  │  Auth          │  │
│  │  (Pollinations)  │  │  (analytics.py) │  │  (login.py /   │  │
│  │                  │  │                  │  │   register.py) │  │
│  │ • generate answer│  │ • Active users   │  │ • Flask session│  │
│  │ • classify topic │  │ • Question volume│  │ • pbkdf2 hash  │  │
│  │ • quality scoring│  │ • Input methods  │  │ • Role-based   │  │
│  │                  │  │ • Topic frequency│  │   (admin/user) │  │
│  │                  │  │ • Suggestion fb  │  │                │  │
│  └─────────────────┘  └─────────────────┘  └────────────────┘  │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────────────────────────────┐  │
│  │  Layer1.js       │  │          ML Models                   │  │
│  │  (Node bridge)   │  │                                      │  │
│  │ • subprocess call│  │  • Pix2Text   • PyTorch              │  │
│  │   to mathToLatex │  │  • Pix2Tex    • Transformers         │  │
│  │ • /api/suggestions│ │  • TrOCR      • OpenCV               │  │
│  └─────────────────┘  └──────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Storage Layer                             │
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │   SQLite Database    │  │   In-Memory Stores               │ │
│  │   (database/app.db)  │  │                                  │ │
│  │                      │  │  • image_store (session images)  │ │
│  │  Tables:             │  │  • SessionManager (24hr timeout) │ │
│  │  • users             │  │  • ML model cache                │ │
│  │  • user_activity     │  │    (~/.cache/torch, HuggingFace) │ │
│  │  • questions         │  │                                  │ │
│  │  • processing        │  │  Client-Side:                    │ │
│  │  • suggestion_feedback│ │  • localStorage (session_id)     │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Page & Route Map

Flask serves the frontend as static files. Each page is a separate HTML document:

| URL Path        | Page Served                                    | Access        |
|-----------------|------------------------------------------------|---------------|
| `/`             | `frontend/index.html` (Chat Tutor)             | Auth required |
| `/login`        | `frontend/Login and Register/login.html`       | Public        |
| `/register`     | `frontend/Login and Register/register.html`    | Public        |
| `/dashboard`    | `frontend/Dashboard/dashboard.html`            | Admin only    |
| `/image`        | `frontend/equation_scanner/equation-scanner.html` | Auth required |
| `/<path>`       | Catch-all static file serving                  | Public        |

---

## Data Flow: Chat Tutor Question

```
┌──────────────┐
│  User types  │
│  in MathLive │
│  input field │
└──────┬───────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ 1. app.js: handleInputChange()                        │
│    • Extract query term (operator/trig-aware parsing) │
│    • Call getLatexSuggestions() — Layer 1              │
│    • If empty, call getLayer2Suggestions() — Layer 2  │
│    • Show suggestion dropdown (KaTeX-rendered)        │
└──────┬─────────────────────────────────────────────────┘
       │
       │ [User selects suggestion or submits question]
       ▼
┌────────────────────────────────────────────────────────┐
│ 2. app.js: handleSubmitQuestion()                     │
│    • Get LaTeX from MathLive field                    │
│    • Track input_method (typing/suggestion/image)     │
│    • POST /api/questions {question, input_method}     │
└──────┬─────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ 3. Backend: POST /api/questions                       │
│    • generate_llm_answer(question)                    │
│      → Calls Pollinations cloud LLM API              │
│    • classify_question_topic(question)                │
│      → LLM-based classification (Algebra/Trig/       │
│        Calculus/Geometry/Statistics/Other)             │
│    • evaluate_response_quality(question, answer)      │
│      → Heuristic quality score 0–100                  │
│    • Log to SQLite: questions table                   │
│    • Return {answer, topic, quality_score}            │
└──────┬─────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ 4. app.js: Render response                            │
│    • renderMixedTextMath() with KaTeX                 │
│    • Show quality indicator                           │
│    • Display suggestion feedback UI if suggestion used│
└────────────────────────────────────────────────────────┘
```

---

## Data Flow: Suggestion Engine (Two-Layer)

```
┌──────────────────────────────────────────────────────────────┐
│                     User Input (MathLive)                     │
│                    e.g. "sin2x", "log2(8)"                   │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    LAYER 1: Rule-Based                        │
│                   (mathToLatex.js orchestrator)               │
│                                                              │
│  1. Normalise input                                          │
│  2. Try trig suggestions (subjects/trig.js)                  │
│     • parseTrigExpression() — 10 regex patterns              │
│     • generateTrigSuggestions() — degrees, pi, Greek, etc.   │
│     • getFuzzySuggestions() — Levenshtein fuzzy matching      │
│  3. Try rule matching (subjects: logs, vectors, normal)      │
│     • ~190 compiled [pattern → replacement] rules            │
│     • Wildcards (%) recursively apply mathToLatex()          │
│  4. Try fraction ambiguity (a/bx → two interpretations)     │
│  5. Try permutation engine                                   │
│     • parseExpression() (math-extractor-enhanced.js)         │
│     • Route by type → log/trig/algebra permutation rules     │
│     • Validate all results                                   │
│  6. Deduplicate and return up to max suggestions             │
│                                                              │
│  Result: LaTeX strings or empty                              │
└───────────────┬──────────────────────────┬───────────────────┘
                │                          │
        [has results]              [empty — fallback]
                │                          │
                ▼                          ▼
┌──────────────────┐   ┌───────────────────────────────────────┐
│ Show suggestions │   │          LAYER 2: ML-Ranked           │
│ directly         │   │         (suggestor.js)                │
└──────────────────┘   │                                       │
                       │  1. Extract primary math expression   │
                       │     (math-extractor.js)               │
                       │  2. Generate Layer 1 candidates       │
                       │  3. Generate Layer 2 candidates       │
                       │     (pattern-based: trig, num-id-num) │
                       │  4. Deduplicate (keep highest score)  │
                       │  5. Rank with blended scoring:        │
                       │     • 35% type prior probability      │
                       │     • 30% Levenshtein distance        │
                       │     • 20% curriculum constraint       │
                       │       (O-level penalty for advanced)  │
                       │     • 5%  context match (history)     │
                       │     • 10% logistic regression model   │
                       │       (trigModel from layer2.csv)     │
                       │  6. Filter by minConfidence (0.7)     │
                       │  7. Return ranked suggestions         │
                       └───────────────────────────────────────┘
```

### Subject Modules (Layer 1)

| Module         | File                            | Coverage |
|----------------|---------------------------------|----------|
| Trigonometry   | `src/core/subjects/trig.js`     | sin/cos/tan/csc/sec/cot, inverses, degrees, pi fractions, Greek args, modifiers, fuzzy matching (~430 lines) |
| Logarithms     | `src/core/subjects/logs.js`     | ln, log, log_e, lg, arbitrary bases (~45 rules) |
| Vectors        | `src/core/subjects/vectors.js`  | vec, hat, bar, overrightarrow (~20 rules) |
| Normal/General | `src/core/subjects/normal.js`   | Fractions, summation, differentiation, powers, inequalities, Greek letters, typo correction (~70 rules + utilities) |

### Permutation Rules (Layer 1)

| Module  | File                                       | What It Generates |
|---------|--------------------------------------------|-------------------|
| Algebra | `permutation-rules/algebra-rules.js`       | `fx` → `f(x)` or `f*x`; `2x3` → `2*x*3` or `2*x^3`; `e^2x` → `e^(2x)` or `e^2*x` |
| Logs    | `permutation-rules/log-rules.js`           | `234` → all base splits; `2x` → `log_2(x)`, `log(2x)`, `log(2)*x` |
| Trig    | `permutation-rules/trig-rules.js`          | Digit/var/ambiguity/inverse/pi permutations for all 6 trig functions (~400 lines) |

### ML Model (Layer 2)

- **Type**: Multinomial logistic regression
- **Training script**: `scripts/train_layer2_trig.mjs`
- **Training data**: `src/core/layer2.csv` (169 rows of `input_text,target_latex`)
- **Output**: `src/core/layer2-trig-model.js` (serialised weights)
- **Classes**: 8 trig types (`trig_argument`, `trig_basic`, `trig_degree`, `trig_expression`, `trig_inverse`, `trig_power`, `trig_product`, `trig_ratio`)
- **Features**: Character n-grams (1–3 chars, top 280) + 7 boolean features (`has_power`, `has_inverse`, `has_degree`, `has_ratio`, `has_product`, `has_expression`, `has_parentheses`)

---

## Data Flow: Image Upload to LaTeX

```
┌────────────┐
│   User     │
│ Selects    │
│  Image     │
└─────┬──────┘
      │
      ▼
┌────────────────────────────────────────────────┐
│ 1. Frontend: File selection & validation      │
│    • Validate file type (PNG, JPG, etc.)      │
│    • Check file size (< 10MB)                 │
│    • Generate preview                         │
│    (equation-scanner.js or inline scanner     │
│     modal in app.js)                          │
└─────┬──────────────────────────────────────────┘
      │
      │ FormData (multipart)
      ▼
┌────────────────────────────────────────────────┐
│ 2. Backend: POST /api/upload                  │
│    • Receive multipart file                   │
│    • Validate extension (ALLOWED_EXTENSIONS)  │
│    • Store in image_store dict (in-memory)    │
│    • Return image_id                          │
└─────┬──────────────────────────────────────────┘
      │
      ▼
┌────────────────────────────────────────────────┐
│ 3. ImageProcessor: check_image_quality()      │
│    • Resolution check (≥ 100x100)             │
│    • File size check (≤ 10MB)                 │
│    • Sharpness (Laplacian variance ≥ 50)      │
│    • Brightness (50–200 range)                │
│    • Contrast (std dev ≥ 30)                  │
└─────┬──────────────────────────────────────────┘
      │
      ├─ Return warnings + metrics + preview
      │
      ▼
┌────────────────────────────────────────────────┐
│ 4. Frontend: Display preview & warnings       │
│    • Show image thumbnail                     │
│    • Display quality warnings if any          │
│    • Enable crop / convert buttons            │
└─────┬──────────────────────────────────────────┘
      │
      │ [Optional: Crop via Cropper.js]
      │
┌─────▼────────────────────────────────────────────┐
│ 5. POST /api/convert                             │
│    • Preprocess image in 3 variants:             │
│      raw (none) / mild / binarize                │
│    • Run LatexConverter on each variant           │
│    • Score each result (score_latex heuristics)   │
│    • Select best variant                          │
└─────┬────────────────────────────────────────────┘
      │
      ▼
┌──────────────────────────────────────────────────┐
│ 6. LatexConverter: convert_to_latex()            │
│    • Lazy-initialize OCR model (thread-safe)     │
│    • Run Pix2Text / Pix2Tex / TrOCR inference    │
│    • Strip math delimiters                       │
│    • Calculate confidence score                  │
│    • Validate LaTeX (brace/begin-end balance)    │
└─────┬────────────────────────────────────────────┘
      │
      ▼
┌──────────────────────────────────────────────────┐
│ 7. Return result                                 │
│    • success: true                               │
│    • latex: "\\frac{d}{dx}(x^2)=2x"             │
│    • confidence: 0.85                            │
│    • model: "pix2text"                           │
└─────┬────────────────────────────────────────────┘
      │
      ▼
┌──────────────────────────────────────────────────┐
│ 8. Frontend: Display & edit LaTeX                │
│    • Render with KaTeX (or MathJax in React)     │
│    • Editable LaTeX textarea                     │
│    • Confidence badge                            │
│    • 5-star rating                               │
│    • Copy to clipboard                           │
│    • Insert into chat (inline scanner modal)     │
└──────────────────────────────────────────────────┘
```

---

## Authentication Flow

```
┌───────────────────────────┐
│    Register Page           │
│    POST /register          │
│    {username, password,    │
│     isAdmin?, adminCode?}  │
├───────────────────────────┤
│ • Admin requires secret   │
│   code (ADMIN_SECRET_CODE)│
│ • Password hashed with    │
│   pbkdf2:sha256           │
│ • UUID user_id generated  │
│ • Inserted into users     │
│   table with role         │
└───────────┬───────────────┘
            │ → redirect to /login
            ▼
┌───────────────────────────┐
│    Login Page              │
│    POST /login             │
│    {username, password}    │
├───────────────────────────┤
│ • Verify password hash    │
│ • Set Flask session:      │
│   session["user_id"]      │
│   session["role"]         │
│ • Update last_login in DB │
│ • Return user info        │
└───────────┬───────────────┘
            │ → redirect to /
            ▼
┌───────────────────────────┐
│    Main App (index.html)   │
│    GET /api/me             │
├───────────────────────────┤
│ • checkAuthStatus()       │
│ • Shows/hides dashboard   │
│   button (admin only)     │
│ • Locks chat if not       │
│   authenticated           │
└───────────────────────────┘
```

---

## Admin Dashboard

The dashboard (`/dashboard`) is an admin-only page with D3.js charts powered by analytics endpoints:

| Chart                     | Endpoint                              | Visualisation |
|---------------------------|---------------------------------------|---------------|
| KPI Cards (4)             | `/api/dashboard/active-users`         | Daily / Weekly / Monthly / Inactive counts |
| Active Users Trend        | `/api/dashboard/active-trend`         | Line+area chart with Daily/Weekly/Monthly/Inactive toggle |
| New vs Returning Users    | `/api/dashboard/new-returning`        | Donut chart |
| Question Volume           | `/api/dashboard/question-volume`      | Line+area chart (last 7 days) |
| Input Method Usage        | `/api/dashboard/input-method-trends`  | Pie chart (Typing / Suggestion / Image) |
| Topic Distribution        | `/api/dashboard/topic-frequency`      | Bar chart |
| Suggestion Feedback       | `/api/dashboard/suggestion-feedback`  | Emoji sentiment gauge with percentages |

All analytics queries are in `analytics.py` and operate on `Asia/Singapore` timezone.

---

## Database Schema

SQLite database at `database/app.db`. Connection via `database/db.py` with WAL journal mode and foreign keys enabled.

```
┌─────────────────────────────┐
│           users             │
├─────────────────────────────┤
│ user_id      TEXT PK        │
│ username     TEXT NOT NULL   │
│ password     TEXT NOT NULL   │
│ role         TEXT NOT NULL   │  ← "admin" or "student"
│ created_at   DATETIME       │
│ last_login   DATETIME       │
└──────────┬──────────────────┘
           │ 1
           │
     ┌─────┴──────┬──────────────────────────┐
     │            │                          │
     ▼ *          ▼ *                        ▼ *
┌────────────┐  ┌────────────────┐  ┌──────────────────┐
│user_activity│  │   questions    │  │suggestion_feedback│
├────────────┤  ├────────────────┤  ├──────────────────┤
│activity_id │  │question_id  PK │  │feedback_id    PK │
│user_id  FK │  │user_id      FK │  │user_id        FK │
│activity_   │  │question_      │  │question_id    FK │
│ timestamp  │  │ timestamp     │  │suggestion_text   │
└────────────┘  │input_method   │  │rating (1–5)      │
                │topic          │  │feedback_timestamp│
                └───────┬───────┘  └──────────────────┘
                        │ 1
                        │
                        ▼ *
                ┌───────────────┐
                │  processing   │
                ├───────────────┤
                │processing_id  │
                │question_id FK │
                │processing_    │
                │ success (0/1) │
                │ocr_confidence │
                │retake         │
                │response_time  │
                │ _ms           │
                │system_error   │
                │ (0/1)         │
                └───────────────┘
```

---

## File Structure & Responsibilities

### Backend (`backend/`)

| File                    | Responsibility |
|-------------------------|----------------|
| `app.py`                | Flask app, all API endpoints, CORS, page serving, LLM integration, image processing orchestration |
| `image_processor.py`    | Image quality checking, preprocessing (none/mild/binarize), cropping, base64 conversion |
| `latex_converter.py`    | OCR-to-LaTeX conversion (Pix2Text/Pix2Tex/TrOCR), LaTeX validation, heuristic scoring |
| `session_manager.py`    | In-memory session management with 24hr timeout (defined but image storage handled directly in `app.py`) |
| `analytics.py`          | All dashboard analytics queries (active users, question volume, topics, input methods, feedback) |
| `login.py`              | Login blueprint — password verification, Flask session creation, `last_login` update |
| `register.py`           | Register blueprint — user creation, password hashing, admin code verification |
| `Layer1.js`             | Node.js bridge — subprocess-callable wrapper around `mathToLatex.js` for `/api/suggestions` |
| `database/db.py`        | SQLite connection factory (WAL mode, foreign keys) |
| `database/schema.py`    | Table definitions — `users`, `user_activity`, `questions`, `processing`, `suggestion_feedback` |

### Frontend (`frontend/`)

| File                              | Responsibility |
|-----------------------------------|----------------|
| `index.html`                      | Chat tutor main page — MathLive input, KaTeX rendering, scanner modal, script loading |
| `app.js`                          | Main controller — auth checks, MathLive setup, suggestion handling, chat submission, inline equation scanner |
| `mathToLatex.js`                  | Layer 1 orchestrator — rule compilation, suggestion pipeline, permutation routing |
| `layer2-suggestions.js`           | Bridge — exposes `suggestor.js` as `window.getLayer2Suggestions()` |
| `nav.js`                          | Active page highlighting |
| `styles.css`                      | Main app styles |
| `equation_scanner/`               | Standalone equation scanner page (upload → crop → convert → gallery → editor) |
| `Dashboard/`                      | Admin analytics dashboard (D3.js charts, 7 visualisations) |
| `Login and Register/`             | Auth pages (login form, register form with optional admin code) |

### Frontend Core Engine (`frontend/src/core/`)

| File                              | Responsibility |
|-----------------------------------|----------------|
| `math-extractor.js`               | Extract math expressions from natural language, classify types |
| `math-extractor-enhanced.js`      | Enhanced parser — keyword+operand separation for better permutations |
| `permutation-engine.js`           | Re-export wrapper delegating to `mathToLatex.js` permutation generation |
| `suggestor.js`                    | Layer 2 engine — candidate generation, blended ranking (5 signals), logistic regression integration |
| `layer2-trig-model.js`            | Serialised logistic regression model (auto-generated, 8 trig classes, 280 n-gram vocab) |
| `layer2.csv`                      | Training data (169 rows of input→LaTeX pairs) |
| `subjects/trig.js`                | Trig subject module — parsing, suggestion generation, fuzzy matching |
| `subjects/logs.js`                | Log rules (~45 pattern→replacement pairs) |
| `subjects/vectors.js`             | Vector rules (~20 pattern→replacement pairs) |
| `subjects/normal.js`              | General math rules (~70 rules), typo correction, fraction ambiguity |
| `permutation-rules/algebra-rules.js` | Algebra permutations (function app, implicit mult, power ambiguity) |
| `permutation-rules/log-rules.js`     | Log permutations (base splits, digit+var combinations) |
| `permutation-rules/trig-rules.js`    | Trig permutations (digit/var/ambiguity/inverse/pi, ~400 lines) |

### Frontend React App (`frontend/src/`)

An alternative/earlier React+Vite implementation of the equation scanner:

| File                              | Responsibility |
|-----------------------------------|----------------|
| `App.jsx`                         | Main component — two tabs (Chat/Equation), state management |
| `components/ImageUploader.jsx`    | Upload workflow with ReactCrop, 4-step indicator |
| `components/ImageGallery.jsx`     | Gallery grid with MathJax previews, rename/delete |
| `components/LatexEditor.jsx`      | LaTeX editing with MathJax rendering, confidence badge, star rating |

---

## Technology Stack

```
┌──────────────────────────────────────────────────────────────┐
│                    Presentation Layer                         │
│                                                              │
│  Vanilla JS  •  MathLive (0.104)  •  KaTeX  •  D3.js       │
│  Bootstrap 5  •  Cropper.js  •  Google Fonts                │
│  (Alt: React 18 + Vite + MathJax + react-image-crop)        │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│                                                              │
│  Flask 3.0  •  Flask-CORS  •  Flask Sessions                │
│  Blueprints (login, register)  •  RESTful JSON API          │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                     Business Logic                           │
│                                                              │
│  ImageProcessor  •  LatexConverter  •  SessionManager       │
│  Analytics  •  Cloud LLM (Pollinations API)                 │
│  Layer1.js (Node subprocess)                                │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                Suggestion Engine (Client-Side)               │
│                                                              │
│  Layer 1: Subject modules + Permutation rules + mathToLatex │
│  Layer 2: Suggestor + Logistic regression + Levenshtein     │
│  Math Extractors: regex-based + enhanced keyword parser     │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                      ML / AI Layer                           │
│                                                              │
│  Pix2Text 1.1.4  •  Pix2Tex  •  TrOCR (microsoft)         │
│  PyTorch ≥2.2  •  Transformers ≥4.37  •  OpenCV            │
│  Pillow 10.2  •  NumPy ≥1.26                               │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                      Storage Layer                           │
│                                                              │
│  SQLite (WAL mode)  •  In-memory image store                │
│  Flask session cookies  •  Browser localStorage             │
│  ML model cache (~/.cache/torch, HuggingFace)               │
└──────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

- **Server-rendered pages**: Flask serves frontend HTML directly (no separate dev server in production). A Vite dev workflow exists as an alternative.
- **Two-layer suggestion engine**: Layer 1 (rule-based, fast) runs first; Layer 2 (ML-ranked, broader) activates only as a fallback when Layer 1 produces no results.
- **Client-side suggestions**: All suggestion logic runs in the browser — no server round-trip for autocomplete. The only server call is `/api/suggestions` via `Layer1.js` (Node subprocess), used as an alternative path.
- **Cloud LLM for chat**: Uses Pollinations API (OpenAI-compatible) — no local LLM required. Configurable via `CLOUD_LLM_BASE_URL` and `CLOUD_LLM_MODEL` env vars.
- **OCR engine cascade**: Pix2Text (default) → Pix2Tex → TrOCR. Controlled by `LATEX_OCR_ENGINE` env var. Lazy-initialized on first use to keep server startup fast.
- **Multi-variant conversion**: The `/api/convert` endpoint runs OCR on three preprocessing variants (raw, mild, binarize) and picks the best result by heuristic scoring.
- **SQLite for persistence**: User accounts, question logs, and analytics are stored in SQLite with WAL mode. Image data remains in-memory (24hr session timeout).
- **Role-based access**: Admin users access the analytics dashboard; regular users cannot. Admin registration requires a secret code.
- **LaTeX safety**: Both frontend implementations (vanilla JS and React) include sanitisation and auto-fix utilities for LaTeX rendering (brace balancing, delimiter stripping, MathJax error detection).

---

## Deployment Architecture (Future)

```
┌──────────────────────────────────────────────────────────┐
│                      Load Balancer                        │
│                    (AWS ALB / Nginx)                      │
└────────────────────┬─────────────────────────────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
         ▼                        ▼
┌─────────────────┐      ┌─────────────────┐
│  Frontend CDN   │      │  Backend API    │
│  (CloudFront)   │      │  (ECS/K8s)      │
│                 │      │                 │
│  • Static HTML  │      │  • Flask App    │
│  • JS/CSS       │      │  • ML Models    │
│  • Cached       │      │  • Node.js      │
│                 │      │  • 2+ Instances │
└─────────────────┘      └────────┬────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
           ┌──────────────┐ ┌──────────┐ ┌──────────────┐
           │   Redis      │ │PostgreSQL│ │  S3 Bucket   │
           │   (Sessions) │ │(Users,   │ │   (Images)   │
           │              │ │ Logs,    │ │              │
           │              │ │ Analytics│ │              │
           └──────────────┘ └──────────┘ └──────────────┘
```

---

Refer to this document to understand system architecture, data flows, and component responsibilities.
