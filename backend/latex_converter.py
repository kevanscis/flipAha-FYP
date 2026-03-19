import torch
from PIL import Image
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from pix2tex.cli import LatexOCR
import io
from typing import Optional, Dict
import re
import os
import threading

try:
    print("[INFO] Attempting to import Pix2Text...")
    from pix2text import Pix2Text
    print("[INFO] Pix2Text imported successfully")
except Exception as e:  # pragma: no cover
    print(f"[ERROR] Failed to import Pix2Text: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    Pix2Text = None

class LatexConverter:
    """Converts equation images to LaTeX using transformer models"""
    
    def __init__(self):
        self.lite_mode = os.getenv("LITE_MODE", "").lower() in ("1", "true", "yes")
        if self.lite_mode:
            print("[INFO] LITE_MODE enabled — ML models disabled to save memory")
            self.device = "cpu"
            self.model = None
            self.model_type = None
            self._initialized = True
            self._init_error = "ML models disabled in LITE_MODE"
            self._init_lock = threading.Lock()
            return
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = None
        self.model_type = "pix2text"  # default; will fall back if unavailable
        self._initialized = False
        self._init_error: Optional[str] = None
        self._init_lock = threading.Lock()

    def _ensure_initialized(self) -> None:
        # Lazy init so Flask can start quickly even if the OCR model needs
        # to download weights or takes a while to warm up.
        if self._initialized:
            return

        with self._init_lock:
            if self._initialized:
                return
            try:
                self._initialize_model()
            except Exception as e:  # pragma: no cover
                self.model = None
                self._init_error = str(e)
            finally:
                self._initialized = True
    
    def _initialize_model(self):
        """Initialize the LaTeX OCR model"""
        prefer = (os.getenv('LATEX_OCR_ENGINE', 'pix2text') or 'pix2text').strip().lower()

        # Pix2Text can be enabled explicitly. It may download models on first run.
        if prefer == 'pix2text' and Pix2Text is not None:
            try:
                device = 'cuda' if torch.cuda.is_available() else 'cpu'
                print(f"Initializing Pix2Text model on {device}...")
                self.model = Pix2Text.from_config(enable_table=False, enable_formula=True, device=device)
                self.model_type = "pix2text"
                print("Pix2Text model loaded successfully")
                return
            except Exception as e:
                print(f"Failed to load Pix2Text: {e}")

        try:
            # Using Pix2Tex (specifically designed for LaTeX)
            print(f"Initializing Pix2Tex model on {self.device}...")
            self.model = LatexOCR()
            self.model_type = "pix2tex"
            print("Pix2Tex model loaded successfully")
        except Exception as e:
            print(f"Failed to load Pix2Tex: {e}")
            try:
                # Fallback to TrOCR if Pix2Tex fails
                print("Falling back to TrOCR model...")
                self.processor = TrOCRProcessor.from_pretrained('microsoft/trocr-base-handwritten')
                self.model = VisionEncoderDecoderModel.from_pretrained('microsoft/trocr-base-handwritten')
                self.model.to(self.device)
                self.model_type = "trocr"
                print("TrOCR model loaded successfully")
            except Exception as e2:
                print(f"Failed to load TrOCR: {e2}")
                self.model = None

    def _strip_math_delimiters(self, text: str) -> str:
        s = (text or '').strip()
        # Strip common wrappers returned by some tools.
        if s.startswith('$$') and s.endswith('$$') and len(s) >= 4:
            s = s[2:-2].strip()
        if s.startswith('$') and s.endswith('$') and len(s) >= 2:
            s = s[1:-1].strip()
        if s.startswith('\\[') and s.endswith('\\]'):
            s = s[2:-2].strip()
        if s.startswith('\\(') and s.endswith('\\)'):
            s = s[2:-2].strip()
        return s
    
    def convert_to_latex(self, image_data: bytes) -> Dict[str, any]:
        """
        Convert image to LaTeX
        Returns dict with 'latex' string and 'confidence' score
        """
        self._ensure_initialized()
        print(f"[OCR] Processing image with model: {self.model_type}")
        if self.model is None:
            return {
                'success': False,
                'latex': '',
                'error': self._init_error or 'Model not initialized',
                'confidence': 0.0
            }
        
        try:
            # Load image
            image = Image.open(io.BytesIO(image_data))

            if self.model_type == "pix2text":
                # Pix2Text: use formula recognizer directly for pure-equation crops.
                # Return structured output so we can surface a confidence score.
                res = self.model.recognize_formula(image, return_text=False)
                # res can be a dict (single image) or list of dicts.
                if isinstance(res, list) and res:
                    res = res[0]
                if isinstance(res, dict):
                    latex_output = self._strip_math_delimiters(str(res.get('text', '') or ''))
                    conf = float(res.get('score', 0.0) or 0.0)
                else:
                    latex_output = self._strip_math_delimiters(str(res or ''))
                    conf = 0.80

                return {
                    'success': True,
                    'latex': latex_output,
                    'confidence': conf,
                    'model': 'pix2text'
                }
            
            if self.model_type == "pix2tex":
                # Pix2Tex conversion
                latex_output = self.model(image)
                latex_output = self._strip_math_delimiters(latex_output)
                
                return {
                    'success': True,
                    'latex': latex_output,
                    'confidence': 0.85,  # Pix2tex doesn't provide confidence scores
                    'model': 'pix2tex'
                }
            
            elif self.model_type == "trocr":
                # TrOCR conversion (not ideal for LaTeX but fallback)
                pixel_values = self.processor(image, return_tensors="pt").pixel_values
                pixel_values = pixel_values.to(self.device)
                
                generated_ids = self.model.generate(pixel_values)
                generated_text = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
                
                # Note: TrOCR is not specialized for LaTeX, so this is a basic fallback
                return {
                    'success': True,
                    'latex': generated_text,
                    'confidence': 0.70,
                    'model': 'trocr',
                    'warning': 'Using fallback model. Results may not be ideal for mathematical equations.'
                }
            
        except Exception as e:
            return {
                'success': False,
                'latex': '',
                'error': str(e),
                'confidence': 0.0
            }
    
    def validate_latex(self, latex_string: str) -> Dict[str, any]:
        """
        Basic validation of LaTeX string
        Returns dict with 'valid' boolean and 'errors' list
        """
        text = (latex_string or '').strip()
        errors = []

        if not text:
            return { 'valid': False, 'errors': ['Empty LaTeX output'] }

        # Brace balance (ignore escaped braces)
        brace_balance = 0
        min_balance = 0
        prev = ''
        for ch in text:
            if prev == '\\':
                prev = ''
                continue
            if ch == '{':
                brace_balance += 1
            elif ch == '}':
                brace_balance -= 1
                if brace_balance < min_balance:
                    min_balance = brace_balance
            prev = ch
        if brace_balance != 0 or min_balance < 0:
            errors.append('Unbalanced { } braces')

        # Environment balance
        begins = re.findall(r"\\begin\{([^}]+)\}", text)
        ends = re.findall(r"\\end\{([^}]+)\}", text)
        if len(begins) != len(ends):
            errors.append('Unbalanced \\begin{...} / \\end{...}')
        else:
            # check same multiset
            if sorted(begins) != sorted(ends):
                errors.append('Mismatched \\begin{env} / \\end{env} names')

        # \left/\right balance (rough)
        if text.count('\\left') != text.count('\\right'):
            errors.append('Unbalanced \\left / \\right')

        # Must contain at least one command or math symbol
        if '\\' not in text and not any(s in text for s in ['^', '_', '=', '+', '-', '\u2211', '\u222b']):
            errors.append('No obvious LaTeX commands or math operators detected')

        return { 'valid': len(errors) == 0, 'errors': errors }

    def score_latex(self, latex_string: str) -> Dict[str, any]:
        """Heuristic score for selecting best output among multiple attempts."""
        text = (latex_string or '').strip()
        validation = self.validate_latex(text)

        score = 0.0
        if not text:
            return { 'score': -1e9, 'valid': False, 'errors': ['Empty LaTeX output'] }

        # Base score: prefer non-trivial outputs.
        score += min(len(text) / 40.0, 6.0)
        if '\\' in text:
            score += 2.0

        # Penalize validation errors heavily.
        if not validation['valid']:
            score -= 8.0 * len(validation['errors'])

        # Extra penalties for common OCR garbage.
        score -= 0.5 * text.count('\\\\\\')
        score -= 0.25 * text.count('???')

        # HEAVY PENALTY for repetitive empty matrices or structures (hallucinations)
        # Matches "\begin{matrix} \end{matrix}" or similar with optional spaces
        empty_matrix_count = len(re.findall(r'\\begin\{matrix\}\s*\\end\{matrix\}', text))
        if empty_matrix_count > 0:
            score -= 50.0 * empty_matrix_count
            validation['valid'] = False
            validation['errors'].append('Hallucinated empty matrices detected')

        # Detect excessive repetition of any begin/end block
        # If the same environment is opened/closed > 5 times in a way that dominates the text
        if len(text) > 50:
             # Heuristic: if text length ratio to matrix count is low, it's likely spam
             total_matrix_count = text.count('matrix}')
             if total_matrix_count > 10 and (len(text) / total_matrix_count) < 20:
                 score -= 100.0
                 validation['valid'] = False
                 validation['errors'].append('Repetitive matrix structure detected')

        return { 'score': score, 'valid': validation['valid'], 'errors': validation['errors'] }
