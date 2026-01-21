# FlipAha Architecture

This document describes FlipAha’s runtime architecture and the main data flows for the chat tutor and equation scanner.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                         │
│                    http://localhost:5173                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/JSON
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                          │
│                                                               │
│  ┌───────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  Chat Tutor   │  │   Equation   │  │   Shared UI     │  │
│  │               │  │   Scanner    │  │                 │  │
│  │ • ChatMessage │  │ • ImageUpload│  │ • Tab Nav       │  │
│  │ • MessageInput│  │ • LatexEditor│  │ • Loading States│  │
│  │               │  │ • ImageGallery│ │ • Error Display │  │
│  └───────────────┘  └──────────────┘  └─────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ RESTful API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Flask Backend                            │
│                  http://localhost:5000                       │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              API Endpoints                           │   │
│  │                                                       │   │
│  │  Chat:                  Equation:                   │   │
│  │  • POST /api/questions  • POST /api/session        │   │
│  │                         • POST /api/upload         │   │
│  │                         • POST /api/crop           │   │
│  │                         • POST /api/convert        │   │
│  │                         • GET  /api/images         │   │
│  │                         • GET  /api/image/:id      │   │
│  │                         • DELETE /api/image/:id    │   │
│  │                         • PUT  /api/latex          │   │
│  │                         • POST /api/rate           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │ImageProcessor  │  │LatexConverter  │  │SessionManager│  │
│  │                │  │                │  │              │  │
│  │• Quality Check │  │• Pix2Text (default)││• Create   │  │
│  │• Preprocess    │  │• Pix2Tex (fallback)││• Store   │  │
│  │• Crop          │  │• TrOCR fallback│ │• Retrieve    │  │
│  │• Crop          │  │• Validation    │  │• Retrieve    │  │
│  │• Base64 Conv   │  │• Confidence    │  │• Delete      │  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
│                              │                                │
│                              ▼                                │
│                    ┌──────────────────┐                     │
│                    │   ML Models      │                     │
│                    │                  │                     │
│                    │ • Pix2Text      │                     │
│                    │ • Pix2Tex       │                     │
│                    │ • TrOCR         │                     │
│                    │ • PyTorch       │                     │
│                    └──────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Storage Layer                            │
│                                                               │
│  ┌─────────────────────┐      ┌──────────────────────┐     │
│  │  In-Memory Sessions │      │  Model Cache         │     │
│  │  • 24hr timeout     │      │  • ~/.cache/torch   │     │
│  │  • Image data       │      │  • Hugging Face     │     │
│  │  • LaTeX strings    │      │                      │     │
│  │  • Ratings          │      │                      │     │
│  └─────────────────────┘      └──────────────────────┘     │
│                                                               │
│  [Future: PostgreSQL/Redis]                                 │
└─────────────────────────────────────────────────────────────┘
```

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
│ 1. Frontend: ImageUploader Component          │
│    • Validate file type (PNG, JPG, etc.)      │
│    • Check file size (< 10MB)                 │
│    • Generate preview                         │
└─────┬──────────────────────────────────────────┘
      │
      │ FormData
      ▼
┌────────────────────────────────────────────────┐
│ 2. Backend: POST /api/upload                  │
│    • Receive multipart file                   │
│    • Get or create session                    │
└─────┬──────────────────────────────────────────┘
      │
      ▼
┌────────────────────────────────────────────────┐
│ 3. ImageProcessor: check_image_quality()      │
│    • Resolution check (≥ 100x100)             │
│    • Sharpness (Laplacian variance ≥ 50)      │
│    • Brightness (50-200 range)                │
│    • Contrast (std dev ≥ 30)                  │
└─────┬──────────────────────────────────────────┘
      │
      ├─ Valid ──────────┐
      │                  │
      └─ Invalid ────┐   │
                     │   │
         ┌───────────▼───▼────────────────────────┐
         │ 4. Return Quality Result               │
         │    • warnings: [...]                   │
         │    • metrics: {...}                    │
         │    • preview: base64                   │
         └───────────┬────────────────────────────┘
                     │
         ┌───────────▼────────────────────────────┐
         │ 5. Frontend: Display Preview           │
         │    • Show image                        │
         │    • Display warnings if any           │
         │    • Enable crop/convert               │
         └───────────┬────────────────────────────┘
                     │
      [Optional Crop]│
                     │
         ┌───────────▼────────────────────────────┐
         │ 6. POST /api/crop (Optional)           │
         │    • Apply crop coordinates            │
         │    • Update image in session           │
         └───────────┬────────────────────────────┘
                     │
         ┌───────────▼────────────────────────────┐
         │ 7. POST /api/convert                   │
         └───────────┬────────────────────────────┘
                     │
                     ▼
         ┌──────────────────────────────────────────┐
         │ 8. ImageProcessor: preprocess_image()   │
         │    • Convert to grayscale               │
         │    • Denoise (fastNlMeansDenoising)     │
         │    • Adaptive thresholding              │
         └───────────┬──────────────────────────────┘
                     │
                     ▼
         ┌──────────────────────────────────────────┐
         │ 9. LatexConverter: convert_to_latex()   │
         │    • Lazy-initialize OCR model          │
         │      (keeps server startup fast)        │
         │    • Run Pix2Tex/Pix2Text/TrOCR         │
         │    • Run inference                      │
         │    • Generate LaTeX string              │
         │    • Calculate confidence               │
         └───────────┬──────────────────────────────┘
                     │
                     ▼
         ┌──────────────────────────────────────────┐
         │ 10. SessionManager: update_latex()      │
         │     • Store LaTeX in session            │
         │     • Store confidence score            │
         └───────────┬──────────────────────────────┘
                     │
                     ▼
         ┌──────────────────────────────────────────┐
         │ 11. Return Result                       │
         │     • success: true                     │
         │     • latex: "\\frac{d}{dx}(x^2)=2x"   │
         │     • confidence: 0.85                  │
         └───────────┬──────────────────────────────┘
                     │
                     ▼
         ┌──────────────────────────────────────────┐
         │ 12. Frontend: LatexEditor Component     │
         │     • Render LaTeX with MathJax         │
         │     • Show editable code                │
         │     • Display rating stars              │
         │     • Enable copy to clipboard          │
         └──────────────────────────────────────────┘
                     │
                     ▼
         ┌──────────────────────────────────────────┐
         │ 13. User Actions                        │
         │     • Edit LaTeX → PUT /api/latex       │
         │     • Rate output → POST /api/rate      │
         │     • Delete image → DELETE /api/image  │
         │     • View gallery → GET /api/images    │
         └──────────────────────────────────────────┘
```

## Component Interaction Map

```
┌─────────────────────────────────────────────────────────┐
│                        App.jsx                          │
│                     (Main Component)                    │
│                                                          │
│  State:                                                 │
│  • activeTab (chat/equation)                           │
│  • sessionId                                            │
│  • currentImage                                         │
│  • currentLatex                                         │
│  • galleryRefresh                                       │
└────────────┬────────────────────────────────────────────┘
             │
             ├──[activeTab === 'chat']───────────────────┐
             │                                            │
             │    ┌─────────────────────────────────┐    │
             │    │    Chat Components              │    │
             │    │  • ChatMessage.jsx              │    │
             │    │  • MessageInput.jsx             │    │
             │    └─────────────────────────────────┘    │
             │                                            │
             └──[activeTab === 'equation']───────────────┤
                                                          │
    ┌─────────────────────────────────────────────────────┘
    │
    ├─────────────────┬──────────────────────────┐
    │                 │                          │
    ▼                 ▼                          ▼
┌─────────────┐  ┌──────────────┐    ┌────────────────┐
│ImageUploader│  │LatexEditor   │    │ImageGallery    │
│             │  │              │    │                │
│Props:       │  │Props:        │    │Props:          │
│• sessionId  │  │• sessionId   │    │• sessionId     │
│• onUploaded │  │• imageId     │    │• onImageSelect │
│• onSession  │  │• initialLatex│    │• refreshTrigger│
│             │  │• confidence  │    │                │
│Emits:       │  │• onUpdate    │    │Emits:          │
│• imageData  │  │              │    │• imageSelect   │
│• newSession │  │Emits:        │    │                │
│             │  │• latexUpdate │    │Actions:        │
│Actions:     │  │              │    │• fetchImages() │
│• Select     │  │Actions:      │    │• delete()      │
│• Upload     │  │• edit()      │    │• view()        │
│• Crop       │  │• save()      │    │                │
│• Convert    │  │• rate()      │    │                │
└─────────────┘  │• copy()      │    └────────────────┘
                 └──────────────┘
```

## Session Lifecycle

```
┌──────────────────────────────────────────────────────┐
│                  Session Creation                     │
└───────────────────┬──────────────────────────────────┘
                    │
                    ▼
        ┌────────────────────────┐
        │ User uploads first image│
        └────────┬────────────────┘
                 │
                 ▼
        ┌─────────────────────────┐
        │ Check localStorage      │
        │ for session_id          │
        └────┬────────────┬───────┘
             │            │
     Found   │            │   Not Found
             ▼            ▼
    ┌─────────────┐  ┌──────────────┐
    │ Validate    │  │ POST /api/   │
    │ Session     │  │ session      │
    └──────┬──────┘  └──────┬───────┘
           │                │
      Valid│           ┌────▼─────────┐
           │           │ Create new   │
           │           │ session_id   │
           │           └────┬─────────┘
           │                │
           └────────┬───────┘
                    │
                    ▼
        ┌────────────────────────┐
        │ Store in localStorage  │
        └────────┬───────────────┘
                 │
                 ▼
        ┌─────────────────────────────┐
        │ Session Active              │
        │ • Stores images             │
        │ • Tracks LaTeX              │
        │ • Records ratings           │
        │ • Updates last_accessed     │
        └────────┬────────────────────┘
                 │
                 │ (24 hours later)
                 ▼
        ┌─────────────────────────────┐
        │ Session Cleanup             │
        │ • Remove from memory        │
        │ • User must re-upload       │
        └─────────────────────────────┘
```

## Technology Stack Layers

```
┌─────────────────────────────────────────────────────────┐
│                   Presentation Layer                     │
│                                                           │
│  React 18  •  Vite  •  MathJax  •  react-image-crop     │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                      │
│                                                           │
│  Flask 3.0  •  CORS  •  RESTful API  •  JSON            │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Business Logic                        │
│                                                           │
│  ImageProcessor  •  LatexConverter  •  SessionManager   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   ML/AI Layer                            │
│                                                           │
│  Pix2Tex  •  Pix2Text  •  TrOCR  •  PyTorch  •  Transformers │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Processing Layer                       │
│                                                           │
│  OpenCV  •  Pillow  •  NumPy  •  Image Processing       │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Storage Layer                         │
│                                                           │
│  In-Memory Dict  •  localStorage  •  (Future: Database) │
└─────────────────────────────────────────────────────────┘
```

## Key Design Decisions

- **Session storage**: in-memory on the backend with a 24h timeout; the browser keeps a `session_id` in `localStorage`.
- **OCR engine selection**: controlled by `LATEX_OCR_ENGINE` (Pix2Text default, Pix2Tex fallback, TrOCR fallback).
- **Lazy model init**: OCR models can be heavy; the converter initializes on first conversion request to keep server startup responsive.
- **Rendering robustness**: the frontend sanitizes and auto-fixes common LaTeX issues to reduce renderer failures.

## Deployment Architecture (Future)

```
┌──────────────────────────────────────────────────────────┐
│                      Load Balancer                        │
│                    (AWS ALB / Nginx)                     │
└────────────────────┬─────────────────────────────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
         ▼                        ▼
┌─────────────────┐      ┌─────────────────┐
│  Frontend CDN   │      │  Backend API    │
│  (CloudFront)   │      │  (ECS/K8s)      │
│                 │      │                 │
│  • React App    │      │  • Flask App    │
│  • Static Assets│      │  • ML Models    │
│  • Cached       │      │  • 2+ Instances │
└─────────────────┘      └────────┬────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
           ┌──────────────┐ ┌──────────┐ ┌──────────────┐
           │   Redis      │ │PostgreSQL│ │  S3 Bucket   │
           │   (Sessions) │ │(Metadata)│ │   (Images)   │
           └──────────────┘ └──────────┘ └──────────────┘
```

---

**Visual Guide Complete!**
Refer to this diagram to understand system architecture and data flow.
