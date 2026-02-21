from flask import Flask, send_from_directory, request, jsonify, session, abort
from register import register_bp
from login import login_bp
import os
import json
import subprocess
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

########################################################################################################################
# USE CASE 1
########################################################################################################################

# Hardcoded responses for different topics
responses = {
    'derivative': 'To find the derivative of x², we use the power rule: d/dx(x^n) = n·x^(n-1). So d/dx(x²) = 2x. The derivative represents the instantaneous rate of change of the function.',
    'solve': 'Let me solve 2x + 5 = 13 step by step:\n1. Start: 2x + 5 = 13\n2. Subtract 5 from both sides: 2x = 8\n3. Divide by 2: x = 4\n\nTo verify: 2(4) + 5 = 8 + 5 = 13 ✓',
    'integral': 'The integral (antiderivative) of x² is x³/3 + C, where C is the constant of integration. This is found using the power rule for integration: ∫x^n dx = x^(n+1)/(n+1) + C.',
    'quadratic': 'The quadratic formula is used to solve ax² + bx + c = 0:\n\nx = (-b ± √(b² - 4ac)) / 2a\n\nThe discriminant (b² - 4ac) tells us about the nature of roots.',
    'limit': 'A limit describes the value that a function approaches as the input approaches some value. For example: lim(x→2) (x²) = 4 means as x gets closer to 2, x² approaches 4.',
    'algebra': 'Algebra is the branch of mathematics that uses symbols (variables) to represent unknown quantities and express mathematical relationships. Key concepts include: equations, inequalities, and functions.',
    'geometry': 'Geometry is the study of shapes, sizes, and properties of figures and spaces. Key topics include: points, lines, angles, triangles, circles, area, and volume.',
    'trigonometry': 'Trigonometry deals with relationships between angles and sides of triangles. The main ratios are: sin(θ) = opposite/hypotenuse, cos(θ) = adjacent/hypotenuse, tan(θ) = opposite/adjacent.'
}

def classify_question(question):
    """Classify the question to determine which response to return"""
    question_lower = question.lower()
    
    # Define keywords for each topic
    keywords = {
        'derivative': ['derivative', 'differentiate', 'd/dx', 'rate of change'],
        'solve': ['solve', 'solution', 'equation', '2x', 'equals'],
        'integral': ['integral', 'antiderivative', 'integrate', '∫'],
        'quadratic': ['quadratic', 'quadratic formula', 'ax²', 'discriminant'],
        'limit': ['limit', 'approaches', 'lim', 'converges'],
        'algebra': ['algebra', 'algebraic', 'variable', 'expression'],
        'geometry': ['geometry', 'geometric', 'shape', 'triangle', 'circle'],
        'trigonometry': ['trigonometry', 'trigonometric', 'sin', 'cos', 'tan']
    }
    
    # Check which keywords match
    for topic, words in keywords.items():
        for word in words:
            if word in question_lower:
                return topic
    
    # Default to algebra if no match found
    return 'algebra'

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
        # user_id = "dev_user_123"  # ← Temporary placeholder
        user_id = session.get("user_id")
        
        # Commenting out login requirement for now to allow testing without login flow
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
        use_suggestion = 1 if data.get('use_suggestion') else 0
        accept_suggestion = 1 if data.get('accept_suggestion') else 0

        # print(question)

        if not question:
            return jsonify({
                'success': False,
                'error': 'Question is empty'
            }), 400

        # 3) Your existing logic
        topic = classify_question(question)
        answer = responses.get(topic, responses['algebra'])

        # 4) Insert into DB
        question_id = str(uuid.uuid4())

        ts = datetime.now(SINGAPORE_TZ).isoformat()

        conn = get_db()
        cursor = conn.cursor()
        with conn:
            cursor.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
            user = cursor.fetchone()
            # print(user)
            conn.execute("""
                INSERT INTO questions (
                    question_id, user_id, question_timestamp,
                    input_method, topic, use_suggestion, accept_suggestion
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (question_id, user_id, ts, input_method, topic, use_suggestion, accept_suggestion))
        conn.close()

        # 5) Return response
        return jsonify({
            'success': True,
            'question': question,
            'answer': answer,
            'topic': topic,
            'question_id': question_id
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
                'confidence': score_info.get('confidence', 0),
                'score': score_info.get('score', 0)
            })
            
            # Keep the best result
            if best is None or score_info.get('score', 0) > best.get('score', 0):
                best = {
                    'variant': tag,
                    'latex': attempt.get('latex', ''),
                    'confidence': score_info.get('confidence', 0),
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