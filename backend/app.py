from flask import Flask, request, jsonify
import re

app = Flask(__name__)

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
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:5173'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
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
        user_input = data.get('input', '').strip().lower()
        
        # Define suggestions based on keywords in input
        all_suggestions = {
            'derivative': ['\\frac{d}{dx}x^n', '\\frac{d^2}{dx^2}', "\\frac{d}{dx}\\sin(x)", "\\frac{d}{dx}e^{x}"],
            'integral': ['\\int x^n dx', '\\int \\sin(x) dx', '\\int e^{x} dx', '\\int \\frac{1}{x} dx'],
            'power': ['x^2', 'x^3', 'x^{1/2}', '2^x'],
            'trig': ['\\sin(x)', '\\cos(x)', '\\tan(x)', '\\cot(x)', '\\sec(x)', '\\csc(x)'],
            'log': ['\\log(x)', '\\ln(x)', '\\log_{10}(x)', 'e^{x}'],
            'fraction': ['\\frac{a}{b}', '\\frac{x}{y}', '\\frac{1}{2}'],
            'sqrt': ['\\sqrt{x}', '\\sqrt[3]{x}', '\\sqrt[n]{x}'],
            'limit': ['\\lim_{x \\to a}', '\\lim_{x \\to \\infty}', '\\lim_{x \\to 0}'],
            'summation': ['\\sum_{i=1}^{n}', '\\prod_{i=1}^{n}'],
        }
        
        keywords_map = {
            'derivative': ['deriv', 'differentiat', 'd/dx'],
            'integral': ['integr', 'antiderivat'],
            'power': ['power', 'exponent', '^'],
            'trig': ['sin', 'cos', 'tan', 'trigon'],
            'log': ['log', 'ln', 'natural'],
            'fraction': ['frac', 'divide', 'division'],
            'sqrt': ['sqrt', 'root', 'square root'],
            'limit': ['limit', 'lim'],
            'summation': ['sum', 'sigma'],
        }
        
        # Find matching suggestions
        suggestions = []
        for category, keywords in keywords_map.items():
            if any(keyword in user_input for keyword in keywords):
                suggestions.extend(all_suggestions.get(category, []))
        
        # If no specific match, return general LaTeX suggestions
        if not suggestions:
            suggestions = ['x^2', 'x', '\\frac{a}{b}', 'e^{x}', '\\sqrt{x}']
        
        # Return max 5 suggestions
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

if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')
