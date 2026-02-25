from flask import Flask, send_from_directory, request, jsonify, session, abort
from register import register_bp
from login import login_bp
import os
import json
import subprocess
import re
import requests
from datetime import datetime
from zoneinfo import ZoneInfo
import uuid
import io
from database.db import get_db
from image_processor import ImageProcessor
from latex_converter import LatexConverter
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_ROOT = os.path.join(BASE_DIR, "..", "frontend")

SINGAPORE_TZ = ZoneInfo("Asia/Singapore")

app = Flask(__name__)

# Initialize services for image processing and LaTeX conversion
image_processor = ImageProcessor()
latex_converter = LatexConverter()

# Configuration for file uploads
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'}
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10MB

# In-memory image storage (session_id -> {image_id -> image_data})
image_store = {}

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def store_image(session_id, image_id, image_data):
    """Store image data in memory"""
    if session_id not in image_store:
        image_store[session_id] = {}
    image_store[session_id][image_id] = image_data

def get_stored_image(session_id, image_id):
    """Retrieve stored image data"""
    return image_store.get(session_id, {}).get(image_id)
CLOUD_LLM_BASE_URL = os.getenv("CLOUD_LLM_BASE_URL", "https://text.pollinations.ai/openai").rstrip("/")
CLOUD_LLM_MODEL = os.getenv("CLOUD_LLM_MODEL", "openai")

########################################################################################################################
# USE CASE 1
########################################################################################################################

FALLBACK_RESPONSE = (
    "I can help with that. Please share the exact equation or expression you want to solve, "
    "and I will provide a clear step-by-step explanation."
)

def _normalize_response_text(text):
    if text is None:
        return ""
    normalized = str(text)
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"[\t\x0b\x0c]+", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    normalized = re.sub(r"[ ]{2,}", " ", normalized)
    return normalized.strip()


def format_llm_answer_for_chat(text):
    """Convert markdown/LaTeX-heavy LLM output into plain chat-friendly text."""
    s = _normalize_response_text(text)
    s = re.sub(r"\*\*(.*?)\*\*", r"\1", s)
    s = re.sub(r"^#{1,6}\s*", "", s, flags=re.MULTILINE)
    s = s.replace("\\[", "").replace("\\]", "")
    s = s.replace("\\(", "").replace("\\)", "")
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def evaluate_response_quality(question, answer):
    """Return quality diagnostics for a generated chatbot response."""
    q = _normalize_response_text(question)
    a = _normalize_response_text(answer)

    issues = []
    score = 100

    if not a:
        issues.append("empty_answer")
        score -= 80

    if len(a) < 30:
        issues.append("too_short")
        score -= 30

    if len(a) > 2000:
        issues.append("too_long")
        score -= 15

    placeholder_patterns = [
        r"\blorem ipsum\b",
        r"\btbd\b",
        r"\bcoming soon\b",
        r"\bplaceholder\b",
        r"\bundefined\b",
        r"\bnull\b",
    ]
    if any(re.search(p, a, flags=re.IGNORECASE) for p in placeholder_patterns):
        issues.append("contains_placeholder_text")
        score -= 40

    refusal_patterns = [
        r"sorry[, ]+i can'?t",
        r"i cannot help",
        r"as an ai",
    ]
    if any(re.search(p, a, flags=re.IGNORECASE) for p in refusal_patterns):
        issues.append("generic_refusal_or_meta")
        score -= 25

    if q and not re.search(r"[a-zA-Z0-9]", a):
        issues.append("no_readable_content")
        score -= 40

    score = max(0, min(100, score))
    is_proper = score >= 60 and "empty_answer" not in issues

    return {
        "is_proper": is_proper,
        "score": score,
        "issues": issues,
        "answer": a,
    }

def generate_llm_answer(question):
    """
    Generate a response using a hosted ChatGPT-style endpoint.
    This requires no local model installation.
    """
    payload = {
        "model": CLOUD_LLM_MODEL,
        "stream": False,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a concise and accurate math tutor for O-Level students. "
                    "Give clear step-by-step explanations when asked to solve. "
                    "If the input is ambiguous, ask one short clarifying question. "
                    "IMPORTANT OUTPUT FORMAT: Return plain text only. "
                    "Do NOT use Markdown (no **, headings, bullet markdown) and do NOT use LaTeX wrappers like \\( \\), \\[ \\]."
                )
            },
            {
                "role": "user",
                "content": question
            }
        ]
    }

    try:
        resp = requests.post(
            f"{CLOUD_LLM_BASE_URL}/chat/completions",
            json=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0"
            },
            timeout=60
        )
        resp.raise_for_status()
        data = resp.json()

        choices = data.get("choices") or []
        first = choices[0] if choices else {}
        message = first.get("message") or {}
        content = (message.get("content") or "").strip()

        if not content:
            raise ValueError("Empty LLM response")

        content = format_llm_answer_for_chat(content)

        return content, {
            "provider": "pollinations",
            "model": CLOUD_LLM_MODEL,
            "used_fallback": False
        }
    except (requests.RequestException, TimeoutError, ValueError) as e:
        content = (
            "Cloud LLM is unavailable right now. "
            "Please try again in a moment."
        )
        return content, {
            "provider": "fallback-llm-unavailable",
            "model": None,
            "used_fallback": True,
            "error": str(e)
        }

def classify_question_topic(question):
    """
    Classify a question into a math topic using the LLM.
    Returns one of: Algebra, Trigonometry, Calculus, Geometry, Statistics, or Other
    """
    payload = {
        "model": CLOUD_LLM_MODEL,
        "stream": False,
        "temperature": 0,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a math topic classifier. Classify the given math question into ONE of these categories:\n"
                    "- Algebra\n"
                    "- Trigonometry\n"
                    "- Calculus\n"
                    "- Geometry\n"
                    "- Statistics\n"
                    "- Other\n\n"
                    "Respond with ONLY the topic name, nothing else."
                )
            },
            {
                "role": "user",
                "content": question
            }
        ]
    }

    try:
        resp = requests.post(
            f"{CLOUD_LLM_BASE_URL}/chat/completions",
            json=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0"
            },
            timeout=60
        )
        resp.raise_for_status()
        data = resp.json()

        choices = data.get("choices") or []
        first = choices[0] if choices else {}
        message = first.get("message") or {}
        topic = (message.get("content") or "").strip()

        # Validate topic is one of the allowed categories
        valid_topics = ["Algebra", "Trigonometry", "Calculus", "Geometry", "Statistics", "Other"]
        if topic not in valid_topics:
            topic = "Other"

        return topic
    except (urlerror.URLError, urlerror.HTTPError, TimeoutError, ValueError, json.JSONDecodeError) as e:
        return "Other"

@app.after_request
def add_cors_headers(response):
    allowed = {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
    }

    origin = request.headers.get("Origin")
    if origin in allowed:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"

    response.headers["Vary"] = "Origin"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Max-Age"] = "86400"
    return response

@app.route('/api/questions', methods=['OPTIONS'])
def preflight_questions():
    """Explicit CORS preflight for /api/questions"""
    return jsonify({'status': 'ok'}), 200

@app.route('/api/questions', methods=['POST']) # Updates data on questions table
def ask_question():
    """Handle question submissions + log to DB"""
    try:
        # 1) Require login
        user_id = session.get("user_id")

        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Not logged in'
            }), 401
        
        # print("User ID from session:", user_id)

        # 2) Read request
        data = request.get_json(silent=True) or {}
        question = (data.get('question') or '').strip()
        input_method = (data.get('input_method') or 'typing').strip()

        if not question:
            return jsonify({
                'success': False,
                'error': 'Question is empty'
            }), 400

        # 3) Generate answer via hosted LLM
        answer, llm_meta = generate_llm_answer(question)
        # Classify question into a topic
        topic = classify_question_topic(question)
        
        # Ensure quality before returning to client
        quality = evaluate_response_quality(question, answer)
        if not quality["is_proper"]:
            answer = FALLBACK_RESPONSE
            quality = evaluate_response_quality(question, answer)

        # 4) Insert into DB
        question_id = str(uuid.uuid4())
        ts = datetime.now(SINGAPORE_TZ).isoformat()

        conn = get_db()
        cursor = conn.cursor()
        with conn:
            cursor.execute("SELECT 1 FROM users WHERE user_id = ?", (user_id,))
            user_exists = cursor.fetchone() is not None

            if not user_exists:
                conn.close()
                return jsonify({
                    'success': False,
                    'error': 'Invalid user session. Please log in again.'
                }), 403

            conn.execute("""
                INSERT INTO questions (
                    question_id, user_id, question_timestamp,
                    input_method, topic
                )
                VALUES (?, ?, ?, ?, ?)
            """, (question_id, user_id, ts, input_method, topic))
        conn.close()

        # 5) Return response
        return jsonify({
            'success': True,
            'question': question,
            'answer': answer,
            'topic': topic,
            'question_id': question_id,
            'llm': llm_meta,
            'quality': {
                'is_proper': quality['is_proper'],
                'score': quality['score'],
                'issues': quality['issues']
            }
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/log-input-method', methods=['POST'])
def log_input_method():
    """Log input method usage (e.g., image uploads) to questions table"""
    try:
        user_id = session.get("user_id")
        
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Not logged in'
            }), 401
        
        data = request.get_json(silent=True) or {}
        input_method = (data.get('input_method') or '').strip()
        
        if not input_method:
            return jsonify({
                'success': False,
                'error': 'Input method is required'
            }), 400
        
        # Generate a question ID and timestamp
        question_id = str(uuid.uuid4())
        ts = datetime.now(SINGAPORE_TZ).isoformat()
        
        # Log to questions table with empty question text and generic topic
        conn = get_db()
        cursor = conn.cursor()
        with conn:
            cursor.execute("SELECT 1 FROM users WHERE user_id = ?", (user_id,))
            user_exists = cursor.fetchone() is not None
            
            if not user_exists:
                conn.close()
                return jsonify({
                    'success': False,
                    'error': 'Invalid user session. Please log in again.'
                }), 403
            
            conn.execute("""
                INSERT INTO questions (
                    question_id, user_id, question_timestamp,
                    input_method, topic
                )
                VALUES (?, ?, ?, ?, ?)
            """, (question_id, user_id, ts, input_method, 'others'))
        conn.close()
        
        return jsonify({
            'success': True,
            'question_id': question_id,
            'message': f'Input method "{input_method}" logged successfully'
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/suggestions', methods=['OPTIONS'])
def preflight_suggestions():
    """Explicit CORS preflight for /api/suggestions"""
    return jsonify({'status': 'ok'}), 200

@app.route('/api/suggestions', methods=['POST'])
def get_suggestions():
    """Get LaTeX suggestions based on user input"""
    try:
        data = request.json
        user_input = data.get('input', '').strip()

        layer1_path = os.path.join(os.path.dirname(__file__), 'Layer1.js')
        result = subprocess.run(
            ['node', layer1_path, '--input', user_input, '--max', '5'],
            capture_output=True,
            text=True,
            check=True
        )

        payload = json.loads(result.stdout.strip() or '{}')
        suggestions = payload.get('suggestions', [])

        return jsonify({
            'success': True,
            'suggestions': suggestions[:5]
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/suggestion-feedback', methods=['OPTIONS'])
def preflight_suggestion_feedback():
    return jsonify({'status': 'ok'}), 200


@app.route('/api/suggestion-feedback', methods=['POST'])
def submit_suggestion_feedback():
    """Record thumbs-up / thumbs-down feedback for a suggestion"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'Not logged in'}), 401

        data = request.get_json(silent=True) or {}
        suggestion_text = (data.get('suggestion_text') or '').strip()
        question_id = data.get('question_id')
        # Accept either 'rating' (preferred) or legacy 'useful' boolean
        if 'rating' in data:
            try:
                rating = int(data.get('rating') or 0)
            except Exception:
                rating = 0
        else:
            rating = 1 if data.get('useful') else 0

        if not suggestion_text:
            return jsonify({'success': False, 'error': 'Missing suggestion_text'}), 400

        feedback_id = str(uuid.uuid4())
        ts = datetime.now(SINGAPORE_TZ).isoformat()

        conn = get_db()
        with conn:
            conn.execute("""
                INSERT INTO suggestion_feedback (
                    feedback_id, user_id, question_id, suggestion_text, rating, feedback_timestamp
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (feedback_id, user_id, question_id, suggestion_text, rating, ts))
        conn.close()

        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/dashboard/suggestion-feedback')
def dashboard_suggestion_feedback():
    # Only allow admin
    if session.get('role') != 'admin':
        abort(403)

    try:
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute('SELECT COUNT(*) AS total FROM suggestion_feedback')
        total = cursor.fetchone()['total'] or 0

        cursor.execute('SELECT COUNT(*) AS useful FROM suggestion_feedback WHERE rating = 1')
        useful = cursor.fetchone()['useful'] or 0

        cursor.execute('SELECT suggestion_text, COUNT(*) AS cnt, SUM(rating) AS useful_count FROM suggestion_feedback GROUP BY suggestion_text ORDER BY cnt DESC LIMIT 20')
        rows = cursor.fetchall()

        top = []
        for r in rows:
            top.append({
                'suggestion_text': r['suggestion_text'],
                'count': r['cnt'],
                'useful_count': r['useful_count'] if r['useful_count'] is not None else 0
            })

        conn.close()

        return jsonify({
            'total': total,
            'useful': useful,
            'not_useful': total - useful,
            'top_suggestions': top
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/response-quality', methods=['OPTIONS'])
def preflight_response_quality():
    """Explicit CORS preflight for /api/response-quality"""
    return jsonify({'status': 'ok'}), 200


@app.route('/api/response-quality', methods=['POST'])
def response_quality():
    """Validate chatbot response quality for moderation/QA checks."""
    try:
        data = request.get_json(silent=True) or {}
        question = (data.get('question') or '').strip()
        answer = data.get('answer')

        result = evaluate_response_quality(question, answer)

        return jsonify({
            'success': True,
            'quality': {
                'is_proper': result['is_proper'],
                'score': result['score'],
                'issues': result['issues']
            },
            'normalized_answer': result['answer']
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/llm/health', methods=['GET'])
def llm_health_check():
    """Check if hosted LLM service is reachable."""
    try:
        payload = {
            "model": CLOUD_LLM_MODEL,
            "stream": False,
            "messages": [
                {"role": "user", "content": "Respond with OK"}
            ],
            "max_tokens": 8,
            "temperature": 0
        }
        resp = requests.post(
            f"{CLOUD_LLM_BASE_URL}/chat/completions",
            json=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0"
            },
            timeout=20
        )
        resp.raise_for_status()
        data = resp.json()

        choices = data.get("choices") or []
        ok = bool(choices)
        return jsonify({
            'success': ok,
            'provider': 'pollinations',
            'base_url': CLOUD_LLM_BASE_URL,
            'configured_model': CLOUD_LLM_MODEL
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'provider': 'pollinations',
            'base_url': CLOUD_LLM_BASE_URL,
            'configured_model': CLOUD_LLM_MODEL,
            'error': str(e)
        }), 503

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok'}), 200

########################################################################################################################
# USE CASE 3
########################################################################################################################

from analytics import *


app.secret_key = "your-super-secret-key"  # Change this in production

# Load routes in another folder
app.register_blueprint(register_bp)
app.register_blueprint(login_bp)

@app.route("/")
def home_page():
    return send_from_directory(os.path.join(FRONTEND_ROOT), "index.html")

@app.route("/register")
def register_page():
    return send_from_directory(os.path.join(FRONTEND_ROOT, "Login and Register"), "register.html")

@app.route("/login")
def login_page():
    return send_from_directory(os.path.join(FRONTEND_ROOT, "Login and Register"), "login.html")

@app.route("/logout", methods=["POST"])
def logout():
    session.clear()   # removes user_id and everything in session
    return jsonify({"message": "Logged out successfully"}), 200

@app.route("/dashboard")
def dashboard_page():
    # Only allow admin
    if session["role"] != "admin":
        abort(403)  # Forbidden

    return send_from_directory(os.path.join(FRONTEND_ROOT, "Dashboard"), "dashboard.html")

@app.route("/image")
def image_page():
    return send_from_directory(os.path.join(FRONTEND_ROOT, "equation_scanner"), "equation-scanner.html")

# API CALLS
@app.route("/api/me")
def get_current_user():
    if "user_id" in session:
        return jsonify({
            "logged_in": True,
            "user_id": session["user_id"],
            "role": session["role"] 
        }), 200
    return jsonify({"logged_in": False}), 200

@app.route("/api/dashboard/active-users")
def active_users_dashboard():
    daily, weekly, monthly, inactive = get_active_user_counts()

    return jsonify({
        "daily": daily,
        "weekly": weekly,
        "monthly": monthly,
        "inactive": inactive,
    })

@app.route("/api/dashboard/active-trend")
def active_trend():
    granularity = request.args.get("granularity", "daily")  # daily/weekly/monthly

    if granularity == "daily":
        data = get_active_users_daily_trend(days=7)
    elif granularity == "weekly":
        data = get_active_users_weekly_trend(weeks=4)
    elif granularity == "monthly":
        data = get_active_users_monthly_trend(months=6)
    elif granularity == "inactive":
        data = get_inactive_users_monthly_trend(months=6)
    else:
        return jsonify({"error": "Invalid granularity"}), 400

    return jsonify(data), 200

@app.route("/api/dashboard/new-returning")
def new_vs_returning_dashboard():
    new_users, returning_users = get_new_vs_returning_last_7_days()

    return jsonify({
        "new_active": new_users,
        "returning_active": returning_users,
    })

@app.route("/api/dashboard/question-volume")
def dashboard_question_volume():
    data = get_weekly_question_volume()
    return jsonify(data)

@app.route("/api/dashboard/input-method-trends")
def input_method_trends():
    data = get_weekly_input_method_trends()
    return jsonify(data), 200

########################################################################################################################
# IMAGE UPLOAD & LATEX CONVERSION (USE CASE 2)
########################################################################################################################

@app.route('/api/upload', methods=['POST'])
def upload_image():
    """
    Upload an equation image
    Form data: file (image file), session_id (optional)
    Returns: image_id, session_id, filename, size
    """
    try:
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No file provided'
            }), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No file selected'
            }), 400
        
        if not allowed_file(file.filename):
            return jsonify({
                'success': False,
                'error': f'Invalid file type. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'
            }), 400
        
        # Get or create session ID
        session_id = request.form.get('session_id')
        if not session_id:
            session_id = 'session_' + str(uuid.uuid4())
        
        # Read and store file data
        file_data = file.read()
        image_id = str(uuid.uuid4())
        
        # Store the image data for later retrieval
        store_image(session_id, image_id, file_data)
        
        return jsonify({
            'success': True,
            'image_id': image_id,
            'session_id': session_id,
            'filename': secure_filename(file.filename),
            'size': len(file_data)
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/convert', methods=['POST'])
def convert_to_latex():
    """
    Convert uploaded image to LaTeX
    JSON: {session_id, image_id, options?: {high_accuracy?: bool, preprocess?: 'auto'|'none'|'mild'|'binarize'}}
    """
    try:
        data = request.json or {}
        session_id = data.get('session_id')
        image_id = data.get('image_id')
        options = data.get('options') or {}
        
        if not all([session_id, image_id]):
            return jsonify({
                'success': False,
                'error': 'Missing required fields: session_id and image_id'
            }), 400
        
        # Get stored image data
        original_bytes = get_stored_image(session_id, image_id)
        if not original_bytes:
            return jsonify({
                'success': False,
                'error': 'Image not found. Please upload an image first.'
            }), 404
        
        # Get options
        high_accuracy = bool(options.get('high_accuracy'))
        preprocess_mode = (options.get('preprocess') or 'auto').strip().lower()
        
        def pil_to_bytes(pil_img):
            """Convert PIL image to bytes"""
            buf = io.BytesIO()
            pil_img.save(buf, format='PNG')
            return buf.getvalue()
        
        # Prepare variants based on preprocessing mode
        variants = []
        if preprocess_mode == 'none':
            variants = [('raw', original_bytes)]
        elif preprocess_mode == 'mild':
            variants = [('mild', pil_to_bytes(image_processor.preprocess_image(original_bytes, mode='mild')))]
        elif preprocess_mode == 'binarize':
            variants = [('binarize', pil_to_bytes(image_processor.preprocess_image(original_bytes, mode='binarize')))]
        else:
            # auto: try raw first (best for Pix2Tex), fall back to mild, and optionally binarize
            variants = [('raw', original_bytes), ('mild', pil_to_bytes(image_processor.preprocess_image(original_bytes, mode='mild')))]
            if high_accuracy:
                variants.append(('binarize', pil_to_bytes(image_processor.preprocess_image(original_bytes, mode='binarize'))))
        
        best = None
        attempts = []
        
        # Try each variant
        for tag, img_bytes in variants:
            attempt = latex_converter.convert_to_latex(img_bytes)
            if not attempt.get('success'):
                attempts.append({
                    'variant': tag,
                    'success': False,
                    'error': attempt.get('error', 'Conversion failed')
                })
                continue
            
            score_info = latex_converter.score_latex(attempt.get('latex', ''))
            attempts.append({
                'variant': tag,
                'success': True,
                'latex': attempt.get('latex', ''),
                'confidence': attempt.get('confidence', 0),
                'score': score_info.get('score', 0)
            })
            
            # Keep the best result
            if best is None or score_info.get('score', 0) > best.get('score', 0):
                best = {
                    'variant': tag,
                    'latex': attempt.get('latex', ''),
                    'confidence': attempt.get('confidence', 0),
                    'score': score_info.get('score', 0)
                }
            
            # Fast path: if not in high-accuracy mode and got a valid result, stop
            if not high_accuracy and score_info.get('valid', False):
                break
        
        if best is None:
            return jsonify({
                'success': False,
                'error': 'Could not convert image to LaTeX',
                'attempts': attempts
            }), 400
        
        return jsonify({
            'success': True,
            'latex': best['latex'],
            'preprocess_variant': best['variant'],
            'confidence': best['confidence'],
            'score': best['score'],
            'message': 'Equation converted to LaTeX successfully',
            'attempts': attempts if high_accuracy else None
        }), 200
    
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'details': traceback.format_exc()
        }), 500

@app.route('/api/images', methods=['GET'])
def get_images():
    """
    Get all images for a session
    Query params: session_id
    Returns: {images: [...], stats: {total_images: N}}
    """
    try:
        import base64
        
        session_id = request.args.get('session_id')
        if not session_id:
            return jsonify({
                'success': False,
                'error': 'Missing session_id parameter'
            }), 400
        
        # Get all images for this session
        session_images = image_store.get(session_id, {})
        
        images = []
        for image_id, image_bytes in session_images.items():
            # Convert bytes to base64 for display
            b64_data = base64.b64encode(image_bytes).decode('utf-8')
            images.append({
                'id': image_id,
                'data': f'data:image/png;base64,{b64_data}',
                'filename': f'equation_{image_id[:8]}.png',
                'latex': '',
                'edited_latex': '',
                'rating': 0
            })
        
        return jsonify({
            'success': True,
            'images': images,
            'stats': {
                'total_images': len(images)
            }
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route("/api/dashboard/topic-frequency")
def topic_frequency():
    """Get the frequency distribution of question topics"""
    if session.get('role') != 'admin':
        abort(403)
    
    try:
        data = get_topic_frequency()
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Serve JS/CSS files
@app.route("/<path:filename>")
def serve_file(filename):
    """
    Look for the file in all subfolders of frontend dynamically.
    """
    # Loop through subfolders
    for subfolder in os.listdir(FRONTEND_ROOT):
        subfolder_path = os.path.join(FRONTEND_ROOT, subfolder)
        file_path = os.path.join(subfolder_path, filename)
        if os.path.isfile(file_path):
            return send_from_directory(subfolder_path, filename)
    
    # Also check root of frontend
    file_path = os.path.join(FRONTEND_ROOT, filename)
    if os.path.isfile(file_path):
        return send_from_directory(FRONTEND_ROOT, filename)

    return "File Not Found", 404

if __name__ == "__main__":
    app.run(port=5000, debug=True)