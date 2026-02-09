from flask import Flask, request, jsonify, send_file
import re
import os
import io
from werkzeug.utils import secure_filename
from backend.image_processor import ImageProcessor
from backend.latex_converter import LatexConverter
from backend.session_manager import SessionManager

app = Flask(__name__)

# Initialize services
image_processor = ImageProcessor()
latex_converter = LatexConverter()
session_manager = SessionManager(session_timeout_hours=24)

# Configuration
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'}
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10MB

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
from flask import Flask, send_from_directory, request, jsonify
from register import register_bp
from login import login_bp
import os
import json
import subprocess

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_ROOT = os.path.join(BASE_DIR, "..", "frontend")

app = Flask(__name__)

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
    """Add CORS headers to every response"""
    origin = request.headers.get('Origin', '')
    # Allow common local dev origins (Vite may pick a different port).
    if origin and re.match(r'^http://(localhost|127\.0\.0\.1)(:\d+)?$', origin):
        response.headers['Access-Control-Allow-Origin'] = origin
    else:
        response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Max-Age'] = '86400'
    return response

@app.route('/api/questions', methods=['OPTIONS'])
def preflight_questions():
    """Explicit CORS preflight for /api/questions"""
    return jsonify({'status': 'ok'}), 200

@app.route('/api/questions', methods=['POST'])
def ask_question():
    """Handle question submissions"""
    try:
        data = request.json
        question = data.get('question', '').strip()
        topic = classify_question(question)
        answer = responses.get(topic, responses['algebra'])
        return jsonify({
            'success': True,
            'question': question,
            'answer': answer,
            'topic': topic
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

# ==================== IMAGE UPLOAD & PROCESSING ====================

@app.route('/api/session', methods=['POST'])
def create_session():
    """Create a new session"""
    try:
        session_id = session_manager.create_session()
        return jsonify({
            'success': True,
            'session_id': session_id
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/upload', methods=['POST'])
def upload_image():
    """
    Upload an equation image
    Form data: file (image file), session_id (optional)
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
        
        # Get or create session
        session_id = request.form.get('session_id')
        session_id = session_manager.get_or_create_session(session_id)
        
        # Read file data
        file_data = file.read()
        filename = secure_filename(file.filename)
        
        # Check image quality
        quality_check = image_processor.check_image_quality(file_data)
        
        if not quality_check['valid']:
            return jsonify({
                'success': False,
                'error': 'Image quality check failed',
                'warnings': quality_check['warnings'],
                'metrics': quality_check['metrics']
            }), 400
        
        # Store image temporarily (before conversion)
        image_id = session_manager.add_image(
            session_id=session_id,
            image_data=file_data,
            filename=filename
        )
        
        # Convert image to base64 for preview
        image_base64 = image_processor.image_to_base64(file_data)
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'image_id': image_id,
            'filename': filename,
            'preview': f'data:image/png;base64,{image_base64}',
            'quality': quality_check,
            'message': 'Image uploaded successfully. You can now crop or process it.'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/crop', methods=['POST'])
def crop_image():
    """
    Crop an uploaded image
    JSON: {session_id, image_id, crop_coords: {x, y, width, height}} OR
          {session_id, image_id, crop_percent: {x, y, width, height, unit}}
    """
    try:
        data = request.json
        session_id = data.get('session_id')
        image_id = data.get('image_id')
        crop_coords = data.get('crop_coords')
        crop_percent = data.get('crop_percent')
        
        if not all([session_id, image_id]) or (not crop_coords and not crop_percent):
            return jsonify({
                'success': False,
                'error': 'Missing required fields'
            }), 400
        
        # Get original image
        image_data = session_manager.get_image(session_id, image_id)
        if not image_data:
            return jsonify({
                'success': False,
                'error': 'Image not found'
            }), 404
        
        # Convert percent crop -> pixel crop (preferred from UI)
        if crop_percent and not crop_coords:
            try:
                from PIL import Image
                img = Image.open(io.BytesIO(image_data['image_data']))
                img_w, img_h = img.size

                unit = (crop_percent.get('unit') or '%').strip()
                x = float(crop_percent.get('x', 0))
                y = float(crop_percent.get('y', 0))
                w = float(crop_percent.get('width', 0))
                h = float(crop_percent.get('height', 0))

                # Support 0..1 and 0..100 percent formats
                scale = 1.0
                max_val = max(x, y, w, h)
                if unit == '%' or max_val > 1.0:
                    scale = 0.01

                px = int(round(x * scale * img_w))
                py = int(round(y * scale * img_h))
                pw = int(round(w * scale * img_w))
                ph = int(round(h * scale * img_h))

                # Clamp
                px = max(0, min(px, img_w - 1))
                py = max(0, min(py, img_h - 1))
                pw = max(1, min(pw, img_w - px))
                ph = max(1, min(ph, img_h - py))

                crop_coords = { 'x': px, 'y': py, 'width': pw, 'height': ph }
            except Exception as e:
                return jsonify({
                    'success': False,
                    'error': f'Invalid crop_percent: {str(e)}'
                }), 400

        # Crop image
        cropped_data = image_processor.crop_image(
            image_data['image_data'], 
            crop_coords
        )
        
        # Update session with cropped image
        image_data['image_data'] = cropped_data
        cropped_base64 = image_processor.image_to_base64(cropped_data)
        
        return jsonify({
            'success': True,
            'preview': f'data:image/png;base64,{cropped_base64}',
            'message': 'Image cropped successfully'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/convert', methods=['POST'])
def convert_to_latex():
    """
    Convert image to LaTeX
    JSON: {session_id, image_id, options?: {high_accuracy?: bool, preprocess?: 'auto'|'none'|'mild'|'binarize'}}
    """
    try:
        data = request.json
        session_id = data.get('session_id')
        image_id = data.get('image_id')
        options = data.get('options') or {}
        high_accuracy = bool(options.get('high_accuracy') or data.get('high_accuracy'))
        preprocess_mode = (options.get('preprocess') or 'auto').strip().lower()
        
        if not all([session_id, image_id]):
            return jsonify({
                'success': False,
                'error': 'Missing required fields'
            }), 400
        
        # Get image
        image_data = session_manager.get_image(session_id, image_id)
        if not image_data:
            return jsonify({
                'success': False,
                'error': 'Image not found'
            }), 404
        
        original_bytes = image_data['image_data']

        def pil_to_bytes(pil_img):
            buf = io.BytesIO()
            pil_img.save(buf, format='PNG')
            return buf.getvalue()

        variants = []
        if preprocess_mode == 'none':
            variants = [('raw', original_bytes)]
        elif preprocess_mode == 'mild':
            variants = [('mild', pil_to_bytes(image_processor.preprocess_image(original_bytes, mode='mild')))]
        elif preprocess_mode == 'binarize':
            variants = [('binarize', pil_to_bytes(image_processor.preprocess_image(original_bytes, mode='binarize')))]
        else:
            # auto: try raw first (best for Pix2Tex), fall back to mild, and optionally binarize.
            variants = [('raw', original_bytes), ('mild', pil_to_bytes(image_processor.preprocess_image(original_bytes, mode='mild')))]
            if high_accuracy:
                variants.append(('binarize', pil_to_bytes(image_processor.preprocess_image(original_bytes, mode='binarize'))))

        best = None
        attempts = []

        for tag, img_bytes in variants:
            attempt = latex_converter.convert_to_latex(img_bytes)
            if not attempt.get('success'):
                attempts.append({ 'variant': tag, 'success': False, 'error': attempt.get('error', 'Conversion failed') })
                continue

            score_info = latex_converter.score_latex(attempt.get('latex', ''))
            attempts.append({
                'variant': tag,
                'success': True,
                'model': attempt.get('model', 'unknown'),
                'score': score_info['score'],
                'valid': score_info['valid'],
                'errors': score_info['errors'],
            })

            if best is None or score_info['score'] > best['score']:
                best = {
                    'result': attempt,
                    'score': score_info['score'],
                    'valid': score_info['valid'],
                    'errors': score_info['errors'],
                    'variant': tag,
                }

            # Fast path: if we're not in high-accuracy mode and got a valid result, stop.
            if not high_accuracy and score_info['valid']:
                break

        if best is None:
            return jsonify({
                'success': False,
                'error': 'Conversion failed',
                'attempts': attempts
            }), 500

        result = best['result']
        
        # Update session with LaTeX
        session_manager.update_latex(session_id, image_id, result['latex'])
        image_data['latex'] = result['latex']
        image_data['edited_latex'] = result['latex']
        image_data['confidence'] = result['confidence']
        
        return jsonify({
            'success': True,
            'latex': result['latex'],
            'confidence': result['confidence'],
            'model': result.get('model', 'unknown'),
            'warning': result.get('warning'),
            'preprocess_variant': best['variant'],
            'validation': { 'valid': best['valid'], 'errors': best['errors'] },
            'attempts': attempts if high_accuracy else None,
            'message': 'Equation converted to LaTeX successfully'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ==================== IMAGE MANAGEMENT ====================

@app.route('/api/images', methods=['GET'])
def get_images():
    """Get all images in a session"""
    try:
        session_id = request.args.get('session_id')
        
        if not session_id:
            return jsonify({
                'success': False,
                'error': 'Session ID required'
            }), 400
        
        images = session_manager.get_all_images(session_id)
        stats = session_manager.get_session_stats(session_id)
        
        return jsonify({
            'success': True,
            'images': images,
            'stats': stats
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/image/<image_id>', methods=['GET'])
def get_image(image_id):
    """Get specific image with full data including binary"""
    try:
        session_id = request.args.get('session_id')
        
        if not session_id:
            return jsonify({
                'success': False,
                'error': 'Session ID required'
            }), 400
        
        image_data = session_manager.get_image(session_id, image_id)
        
        if not image_data:
            return jsonify({
                'success': False,
                'error': 'Image not found'
            }), 404
        
        # Convert image to base64 for JSON response
        image_base64 = image_processor.image_to_base64(image_data['image_data'])
        
        return jsonify({
            'success': True,
            'image': {
                'id': image_data['id'],
                'filename': image_data['filename'],
                'data': f'data:image/png;base64,{image_base64}',
                'latex': image_data['latex'],
                'edited_latex': image_data['edited_latex'],
                'confidence': image_data['confidence'],
                'uploaded_at': image_data['uploaded_at'],
                'rating': image_data['rating']
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/image/<image_id>', methods=['DELETE'])
def delete_image(image_id):
    """Delete an image"""
    try:
        # Try to get session_id from query params first, then from JSON body
        session_id = request.args.get('session_id')
        if not session_id and request.is_json:
            data = request.get_json(silent=True) or {}
            session_id = data.get('session_id')
        
        if not session_id:
            return jsonify({
                'success': False,
                'error': 'Session ID required'
            }), 400
        
        success = session_manager.delete_image(session_id, image_id)
        
        if not success:
            return jsonify({
                'success': False,
                'error': 'Image not found or already deleted'
            }), 404
        
        return jsonify({
            'success': True,
            'message': 'Image deleted successfully'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/image/<image_id>/rename', methods=['PUT'])
def rename_image(image_id):
    """Rename an image (display name only). JSON: {session_id, filename}"""
    try:
        data = request.get_json(silent=True) or {}
        session_id = data.get('session_id')
        filename = data.get('filename')

        if not session_id or filename is None:
            return jsonify({
                'success': False,
                'error': 'Missing required fields'
            }), 400

        success = session_manager.rename_image(session_id, image_id, filename)
        if not success:
            return jsonify({
                'success': False,
                'error': 'Image not found or invalid filename'
            }), 404

        image_data = session_manager.get_image(session_id, image_id)
        return jsonify({
            'success': True,
            'image_id': image_id,
            'filename': image_data['filename'],
            'message': 'Image renamed successfully'
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/latex', methods=['PUT'])
def update_latex():
    """
    Update edited LaTeX for an image
    JSON: {session_id, image_id, latex}
    """
    try:
        data = request.json
        session_id = data.get('session_id')
        image_id = data.get('image_id')
        edited_latex = data.get('latex')
        
        if not all([session_id, image_id, edited_latex is not None]):
            return jsonify({
                'success': False,
                'error': 'Missing required fields'
            }), 400
        
        success = session_manager.update_latex(session_id, image_id, edited_latex)
        
        if not success:
            return jsonify({
                'success': False,
                'error': 'Image not found'
            }), 404
        
        return jsonify({
            'success': True,
            'message': 'LaTeX updated successfully'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/rate', methods=['POST'])
def rate_conversion():
    """
    Rate a LaTeX conversion
    JSON: {session_id, image_id, rating (1-5)}
    """
    try:
        data = request.json
        session_id = data.get('session_id')
        image_id = data.get('image_id')
        rating = data.get('rating')
        
        if not all([session_id, image_id, rating is not None]):
            return jsonify({
                'success': False,
                'error': 'Missing required fields'
            }), 400
        
        if not isinstance(rating, int) or rating < 1 or rating > 5:
            return jsonify({
                'success': False,
                'error': 'Rating must be an integer between 1 and 5'
            }), 400
        
        success = session_manager.rate_image(session_id, image_id, rating)
        
        if not success:
            return jsonify({
                'success': False,
                'error': 'Image not found'
            }), 404
        
        return jsonify({
            'success': True,
            'message': f'Rating of {rating} stars recorded successfully'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ==================== ORIGINAL ENDPOINTS ====================

if __name__ == '__main__':
    # Run without debug mode initially to avoid reloader issues
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == '--debug':
        app.run(debug=True, port=5000, host='0.0.0.0', use_reloader=True)
    else:
        app.run(debug=False, port=5000, host='0.0.0.0', use_reloader=False)
########################################################################################################################
# USE CASE 3
########################################################################################################################

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
