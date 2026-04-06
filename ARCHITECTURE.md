# FlipAha Architecture

This document describes FlipAha's runtime architecture, main data flows, the three-batch grammar-based suggestion engine (with GBDT ranking), and supporting subsystems (authentication, analytics dashboard, database).

---

## Recent Updates (March–April 2026)

### Suggestion Engine Refactored (March 16–20, 2026)

**Migration from Rule-Based to Grammar-Based Parsing:**

- **Permanently removed** (commit `24ce4f0`, March 19, 2026):
  - Subject modules: `subjects/trig.js`, `subjects/logs.js`, `subjects/vectors.js`, `subjects/normal.js`, `subjects/fractions.js` — **no longer exist in codebase**
  - Permutation rules: `permutation-rules/algebra-rules.js`, `permutation-rules/log-rules.js`, `permutation-rules/trig-rules.js` — **no longer exist in codebase**
  - Old orchestration approach via `mathToLatex.js` pattern compilation and Rule-Based Layer 1 / ML Layer 2 architecture

- **Added** (March 16–20, 2026):
  - `grammar-parser.js` (48 KB) — PEG-style recursive descent parser with 280+ function/constant support
  - `ambiguity-resolver.js` (91 KB) — Multi-interpretation generation with ~10 ambiguity rules
  - `suggestion-ranker.js` (675 lines, ~25 KB) — **XGBoost-style GBDT** ensemble for ranking suggestions using 20 learned features

**Rationale**: Grammar-based parsing provides:
- Better semantic understanding of complex expressions
- Structured handling of operator precedence
- Systematic ambiguity detection (vs. hard-coded patterns)
- Easier to extend and maintain

### Chat Context Memory (March 27, 2026+)

- **New environment variables**:
  - `CHAT_CONTEXT_TURNS` (default: 4) — number of recent message pairs to retain
  - `CHAT_CONTEXT_MAX_CHARS` (default: 1600) — character budget for context window
- **Implementation** (`backend/app.py`):
  - `_sanitize_chat_history()` — validates history format and caps message length
  - `_trim_chat_history()` — enforces turn limit and character budget
  - `_build_chat_messages()` — includes trimmed history in LLM prompt
- **Benefit**: Maintains question–answer continuity without storing sessions server-side

### UI Enhancements (March 20–27, 2026)

- **Navbar improvements**:
  - Display logged-in username (via `#navUsername` element)
  - Dropdown menu for navigation
  - Logout button with proper page redirects
- **Responsiveness**: CSS improvements for mobile/tablet views
- **Cleaning**: Removed status bar; consolidated styles into `frontend/styles.css`
- **Commits**: `6c85f0f` (navbar layout), `b9a21bf` (navbar dropdown and logout), `265cb98` (responsiveness)

### Core Data Structure: Abstract Syntax Tree (AST)

**Current Implementation (March 20, 2026+):**

- **What**: The AST is an intermediate representation built by `grammar-parser.js` that captures the semantic structure of mathematical input
- **Structure**: Hierarchical tree where each node represents:
  - Operands (numbers, variables, constants, functions)
  - Operations (addition, multiplication, power, function application)
  - Metadata (ambiguity flags, metadata for scoring)
- **Generation**: Tokens → Recursive descent parser → AST
- **Usage**:
  - **Batch 1**: Grammar parser outputs AST
  - **Batch 2**: Ambiguity resolver takes AST, expands nodes with multiple interpretations (func-implicit-mul, power-exponent, etc.)
  - **Batch 3**: Ranker scores each alternative AST and returns top suggestions
- **Rendering**: `astToLatex()` converts any AST node to valid LaTeX output
- **Caching**: Parsed ASTs can be cached in-memory to avoid re-parsing identical inputs

### Batch 3: GBDT-Powered Suggestion Ranking (Current Implementation)

**Implemented in `suggestion-ranker.js` (675 lines, ~25 KB):**

- **Architecture**: XGBoost-style Gradient Boosted Decision Tree ensemble running entirely client-side
- **Features Extracted** (20-dimensional vector):
  - **Structural** (0–2): input length, suggestion length, length ratio
  - **Edit Distance** (3): normalized Levenshtein distance
  - **Content Flags** (4–9): explicit parens, fractions, powers, square roots, degrees, inverses
  - **Input Type** (10–11): trig functions, logarithm detection
  - **LaTeX Complexity** (12–19): command count, shared tokens, character overlap, nesting depth, subscripts, common angles, prefix matching
- **Model Training**:
  - **Algorithm**: Gradient boosting with MSE loss + L2 regularization (λ, default 1.0)
  - **Hyperparameters**: 
    - `learningRate` (η): shrinkage/step size, default 0.1
    - `nTrees`: ensemble size (default 50 boosting rounds)
    - `maxDepth`: max tree depth (default 2, very shallow for fast inference)
    - `minSamplesLeaf`: leaf node minimum size
  - **Split Finding**: XGBoost exact greedy algorithm with information gain (Hessian-weighted)
  - **Regularization**: L2 penalty on leaf weights to prevent overfitting
- **Training Data**: User feedback from `suggestion_feedback` table (thumbs-up / thumbs-down ratings)
- **Inference**: Fast recursive tree traversal; trained GBDT trees can be serialized to JSON for browser execution
- **Benefits**:
  - Non-linear feature interactions (beyond hand-crafted scoring)
  - Automatic importance weighting learned from user data
  - Improves over time as more feedback is collected
  - Completely client-side (no server ML required for inference)

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
│  │      Suggestion Engine (3-Batch Grammar-Based)           │   │
│  │                                                          │   │
│  │ Batch 1: Grammar Parser        (grammar-parser.js)      │   │
│  │ • Tokenize & parse input                                │   │
│  │ • Operator precedence handling                          │   │
│  │ • Build AST (Abstract Syntax Tree)                      │   │
│  │ • Render AST → LaTeX                                    │   │
│  │                                                          │   │
│  │ Batch 2: Ambiguity Resolver    (ambiguity-resolver.js) │   │
│  │ • Detect ambiguous patterns in AST (~10 rules)         │   │
│  │ • Generate alternative AST interpretations              │   │
│  │ • Deduplicate by LaTeX output                           │   │
│  │                                                          │   │
│  │ Batch 3: GBDT Suggestion Ranker (suggestion-ranker.js) │   │
│  │ • 20-dim feature extraction (syntax, edit distance, ...) │  │
│  │ • XGBoost-style gradient boosted decision trees         │   │
│  │ • Score by: learnable non-linear feature interactions  │   │
│  │ • Return top-N ranked suggestions                       │   │
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
│  │   SQLite Database    │  │   In-Memory Stores (Client)      │ │
│  │   (database/app.db)  │  │                                  │ │
│  │                      │  │  • image_store (session images)  │ │
│  │  Tables:             │  │  • SessionManager (24hr timeout) │ │
│  │  • users             │  │  • AST cache (parsed trees)      │ │
│  │  • user_activity     │  │  • ML model weights cache        │ │
│  │  • questions         │  │  • HuggingFace/PyTorch cache    │ │
│  │  • processing        │  │    (~/.cache/torch, ~/.cache/hf) │ │
│  │  • suggestion_feedback│ │                                  │ │
│  │                      │  │  Client-Side:                    │ │
│  │                      │  │  • localStorage (session_id)     │ │
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

## Data Flow: Suggestion Engine (Grammar + Ambiguity Resolution)

```
┌──────────────────────────────────────────────────────────────┐
│                     User Input (MathLive)                     │
│                    e.g. "sin2x", "log2(8)"                   │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│           BATCH 1: Grammar Parsing (grammar-parser.js)       │
│                                                              │
│  1. Tokenize input                                           │
│     • NUMBER, IDENTIFIER, FUNCTION, CONSTANT, OPERATOR      │
│     • POWER(^), LPAREN, RPAREN, DEGREE(°), PIPE(|), etc.   │
│  2. Recursive descent parser                                 │
│     • expression() → term() → factor() → primary()          │
│     • Operator precedence (power > mul/div > add/sub)       │
│  3. Build Abstract Syntax Tree (AST)                         │
│     • Nodes: number, variable, function, power, mult, add   │
│     • Stores ambiguity metadata per node                    │
│  4. Render AST to LaTeX                                      │
│     • astToLatex() traverses tree and generates \frac, ^{}  │
│                                                              │
│  Output: AST node with rendered LaTeX                        │
└───────────────┬──────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────┐
│     BATCH 2: Ambiguity Detection (ambiguity-resolver.js)     │
│                                                              │
│  1. Detect ambiguous patterns in AST                         │
│     • Rule: func-implicit-mul (sin2x → sin(2x)?, sin²x?)   │
│     • Rule: power-exponent (e2x → e^(2x)?, e^2·x?)         │
│     • Rule: fraction-denominator (a/bc → a/(bc)?, (a/b)c?) │
│     • Rule: log-base (log234 → log_2(34)?, log₂₃(4)?, ...) │
│     • ~8-10 ambiguity rules total                            │
│  2. Generate alternative interpretations                     │
│     • For each detected ambiguity, expand() → AST[]        │
│     • Include original interpretation + alternatives        │
│  3. Deduplicate and normalize                               │
│     • Remove identical LaTeX outputs                         │
│     • Preserve highest-quality alternatives (top ~5-15)    │
│                                                              │
│  Output: Array of {latex, ast, confidence, ruleId}          │
└───────────────┬──────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────┐
│      BATCH 3: Ranking & Filtering (suggestion-ranker.js)     │
│                                                              │
│  1. Score each candidate                                     │
│     • Syntax complexity (simpler = higher score)             │
│     • Curriculum context (O-level penalty for advanced)      │
│     • Rule confidence (some rules more reliable)             │
│     • History matching (contextual preference)               │
│  2. Rank by combined score                                   │
│  3. Filter by minConfidence threshold (0.6–0.7)             │
│  4. Return top N suggestions (typically 3–8)                │
│                                                              │
│  Output: Ranked array of LaTeX suggestions                   │
└──────────────────────────────────────────────────────────────┘
```

### Grammar Parser (Batch 1)

- **File**: `src/core/grammar-parser.js` (48 KB)
- **Approach**: PEG-style recursive descent parser
- **Features**:
  - Tokenizer recognizing 280+ math functions/constants
  - Operator precedence handling (power > multiply/divide > add/subtract)
  - Parentheses and brace balancing
  - Greek letters (α, β, θ, π, etc.) and mathematical constants (e, ℼ)
  - Factorial, degree symbol, absolute value pipes
- **Output**: Abstract Syntax Tree (AST) with ambiguity metadata

### Ambiguity Resolver (Batch 2)

- **File**: `src/core/ambiguity-resolver.js` (91 KB, latest updated April 6, 2026)
- **Approach**: Rule-based detection and multi-interpretation generation
- **Ambiguity Rules** (~10):
  - **func-implicit-mul**: `sin2x` → `sin(2x)` | `sin²(x)` | `sin(2)·x`
  - **power-exponent**: `e2x` → `e^(2x)` | `e^2·x`
  - **fraction-denominator**: `a/bx` → `a/(bx)` | `(a/b)·x`
  - **log-base**: `log234` → `log₂(34)` | `log₂₃(4)` | `log(2·3·4)` | combinations
  - **mult-order**: Treats `xy` ambiguities in various contexts
  - And others for edge cases (Greek letters, modifiers, etc.)
- **Output**: Array of alternative AST interpretations, deduplicated by LaTeX output

### Suggestion Ranker (Batch 3)

- **File**: `src/core/suggestion-ranker.js` (25 KB)
- **Ranking Signals**:
  - Syntax simplicity (length heuristic)
  - Curriculum constraints (penalize out-of-scope functions)
  - Rule confidence (some ambiguity rules more reliable)
  - Historical context matching
  - User input patterns
- **Filtering**: Threshold-based filtering (default 0.6–0.7 confidence)
- **Output**: Top 3–15 ranked suggestions with confidence scores

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
| `grammar-parser.js`               | PEG-style recursive descent parser — tokenizer, parser, AST builder, LaTeX renderer (48 KB; added March 20) |
| `ambiguity-resolver.js`           | Multi-interpretation suggestion generation — detects ambiguities and expands AST alternatives (func-implicit-mul, power-exponent, fraction-denominator, log-base, ~10 rules) (91 KB; added March 20) |
| `suggestion-ranker.js`            | **XGBoost-style GBDT Ranker** — 20-dimensional feature extraction, gradient boosted decision tree ensemble, trained on user feedback (675 lines, ~25 KB; added March 16) |
| `math-extractor.js`               | Extract math expressions from natural language, classify types |
| `math-extractor-enhanced.js`      | Enhanced parser — keyword+operand separation for better permutations |
| `permutation-engine.js`           | Legacy wrapper (kept for compatibility) |
| `suggestor.js`                    | Legacy Layer 2 engine (may be deprecated; check if still used) |
| `layer2-trig-model.js`            | Serialised logistic regression model (legacy, may not be used) |
| `layer2.csv`                      | Training data (169 rows, legacy) |
| ~~`subjects/`~~ **REMOVED**        | **Permanently deleted March 19, 2026**: trig.js, logs.js, vectors.js, normal.js, fractions.js |
| ~~`permutation-rules/`~~ **REMOVED** | **Permanently deleted March 19, 2026**: algebra-rules.js, log-rules.js, trig-rules.js |

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
│  PEG Parser: Grammar Parser (tokenizer + AST builder)       │
│  AST Processing: Ambiguity Resolver, GBDT Ranker             │
│  • Batch 1: Parse input → build Abstract Syntax Tree (AST)  │
│  • Batch 2: Detect ambiguities → expand AST alternatives    │
│  • Batch 3: XGBoost-style GBDT → score with 20 features     │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                      ML / AI Layer                           │
│                                                              │
│  OCR: Pix2Text 1.1.4  •  Pix2Tex  •  TrOCR (microsoft)    │
│  Core: PyTorch ≥2.2  •  Transformers ≥4.37  •  OpenCV      │
│  Ranking: XGBoost-style GBDT (client-side, gradient boosted)│
│  Utils: NumPy ≥1.26  •  Pillow 10.2  •  Levenshtein         │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                      Storage Layer                           │
│                                                              │
│  SQLite (WAL mode)  •  In-memory image store                │
│  Flask session cookies  •  Browser localStorage             │
│  AST cache (parsed expressions)                             │
│  ML model cache (~/.cache/torch, ~/.cache/huggingface)      │
└──────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

- **Server-rendered pages**: Flask serves frontend HTML directly (no separate dev server in production). A Vite dev workflow exists as an alternative.
- **Grammar-based suggestion engine** (Refactored March 2026): Replaced regex/rule-based pattern matching with a PEG-style recursive descent parser:
  - **Batch 1 (Grammar Parser)**: Tokenizes input → parses using operator precedence → builds Abstract Syntax Tree (AST)
  - **Batch 2 (Ambiguity Resolver)**: Detects inherent ambiguities in parse trees (~10 rules) → generates multiple interpretations → deduplicates by LaTeX output
  - **Batch 3 (Suggestion Ranker)**: Scores by syntax complexity, curriculum fit, rule confidence, history → filters by confidence threshold → returns top suggestions
  - Provides better handling of complex expressions (log-base ambiguities, power vs multiply, function application with implicit arguments)
- **Lightweight chat memory** (Added March 27, 2026): Maintains recent conversation context with configurable turn limit (CHAT_CONTEXT_TURNS, default 4) and character budget (CHAT_CONTEXT_MAX_CHARS, default 1600)
- **Client-side suggestions**: All suggestion logic runs in the browser — no server round-trip for autocomplete. The only server call is `/api/suggestions` via `Layer1.js` (Node subprocess), used as an alternative path.
- **Cloud LLM for chat**: Uses Pollinations API (OpenAI-compatible) with configurable backup URLs and retry logic (CLOUD_LLM_RETRIES, default 2)
- **OCR engine cascade**: Pix2Text (default) → Pix2Tex → TrOCR. Controlled by `LATEX_OCR_ENGINE` env var. Lazy-initialized on first use to keep server startup fast.
- **Multi-variant conversion**: The `/api/convert` endpoint runs OCR on three preprocessing variants (raw, mild, binarize) and picks the best result by heuristic scoring.
- **SQLite for persistence**: User accounts, question logs, and analytics are stored in SQLite with WAL mode. Image data remains in-memory (24hr session timeout).
- **Role-based access**: Admin users access the analytics dashboard; regular users cannot. Admin registration requires a secret code.
- **UI Enhancements** (March 2026+): 
  - Displayed logged-in username in navbar
  - Improved logout functionality with page redirects
  - Responsive navbar with dropdown menu
  - Removed status bar for cleaner UI
  - Consolidated styling into centralized `style.css`
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
