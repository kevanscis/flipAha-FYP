from flask import Flask, send_from_directory, request, jsonify, session, abort
from register import register_bp
from login import login_bp
from concurrent.futures import ThreadPoolExecutor
import os
import json
import subprocess
import re
import requests
import math
from datetime import datetime
from zoneinfo import ZoneInfo
import uuid
import io
from database.db import get_db
from latex_converter import LatexConverter
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_ROOT = os.path.join(BASE_DIR, "..", "frontend")

SINGAPORE_TZ = ZoneInfo("Asia/Singapore")

app = Flask(__name__)

# Initialize services for image processing and LaTeX conversion
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
CLOUD_LLM_BACKUP_BASE_URLS = [
    url.strip().rstrip("/")
    for url in os.getenv("CLOUD_LLM_BACKUP_BASE_URLS", "").split(",")
    if url.strip()
]
CLOUD_LLM_RETRIES = max(1, int(os.getenv("CLOUD_LLM_RETRIES", "2")))
CHAT_CONTEXT_TURNS = max(0, int(os.getenv("CHAT_CONTEXT_TURNS", "4")))
CHAT_CONTEXT_MAX_CHARS = max(200, int(os.getenv("CHAT_CONTEXT_MAX_CHARS", "1600")))


def _get_llm_base_urls():
    seen = set()
    ordered = []
    for url in [CLOUD_LLM_BASE_URL, *CLOUD_LLM_BACKUP_BASE_URLS]:
        if not url or url in seen:
            continue
        seen.add(url)
        ordered.append(url)
    return ordered


def _extract_llm_content(response):
    """Extract best-effort text from OpenAI-compatible or plain-text providers."""
    payload = None
    try:
        payload = response.json()
    except ValueError:
        payload = None

    if isinstance(payload, dict):
        choices = payload.get("choices") or []
        if choices:
            first = choices[0] or {}
            message = first.get("message") or {}
            content = message.get("content")
            if isinstance(content, list):
                parts = []
                for chunk in content:
                    if isinstance(chunk, dict):
                        text_part = chunk.get("text")
                        if text_part:
                            parts.append(str(text_part))
                content = "".join(parts)
            if content:
                return str(content).strip()

            fallback_text = first.get("text")
            if fallback_text:
                return str(fallback_text).strip()

        for key in ("response", "output", "text", "content"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

    return (response.text or "").strip()


def call_cloud_llm(payload, timeout=60):
    """Call cloud LLM with retries and optional backup base URLs."""
    request_payload = dict(payload or {})
    request_payload.setdefault("model", CLOUD_LLM_MODEL)

    errors = []
    for base_url in _get_llm_base_urls():
        endpoint = f"{base_url}/chat/completions"
        for attempt in range(1, CLOUD_LLM_RETRIES + 1):
            try:
                resp = requests.post(
                    endpoint,
                    json=request_payload,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json, text/plain;q=0.9, */*;q=0.8",
                        "User-Agent": "Mozilla/5.0"
                    },
                    timeout=timeout
                )
                resp.raise_for_status()
                content = _extract_llm_content(resp)
                if not content:
                    raise ValueError("Empty LLM response")
                return content, {
                    "provider": "pollinations",
                    "model": request_payload.get("model"),
                    "base_url": base_url,
                    "attempt": attempt,
                    "used_fallback": False,
                }
            except (requests.RequestException, TimeoutError, ValueError) as err:
                errors.append(f"{base_url} (attempt {attempt}): {err}")

    raise RuntimeError(" | ".join(errors) if errors else "Cloud LLM call failed")

########################################################################################################################
# USE CASE 1
########################################################################################################################

FALLBACK_RESPONSE = (
    "I can help with that. Please share the exact equation or expression you want to solve, "
    "and I will provide a clear step-by-step explanation."
)


def _sanitize_chat_history(history):
    cleaned = []
    for item in history or []:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip().lower()
        if role not in ("user", "assistant"):
            continue
        content = _normalize_response_text(item.get("content") or "")
        if not content:
            continue
        cleaned.append({"role": role, "content": content[:600]})
    return cleaned


def _trim_chat_history(history):
    cleaned = _sanitize_chat_history(history)
    max_messages = CHAT_CONTEXT_TURNS * 2
    if max_messages > 0:
        cleaned = cleaned[-max_messages:]
    else:
        cleaned = []

    # Apply overall character cap from newest to oldest
    kept = []
    char_budget = CHAT_CONTEXT_MAX_CHARS
    for message in reversed(cleaned):
        content = message["content"]
        if len(content) > char_budget and kept:
            continue
        if len(content) > char_budget:
            content = content[:char_budget]
        kept.append({"role": message["role"], "content": content})
        char_budget -= len(content)
        if char_budget <= 0:
            break

    return list(reversed(kept))


def _build_chat_messages(question, chat_history=None):
    system_message = {
        "role": "system",
        "content": (
            "You are a concise and accurate math tutor for O-Level students. "
            "Give clear step-by-step explanations when asked to solve. "
            "If the input is ambiguous, ask one short clarifying question. "
            "IMPORTANT OUTPUT FORMAT: Return plain text only. "
            "Do NOT use Markdown (no **, headings, bullet markdown) and do NOT use LaTeX wrappers like \\( \\), \\[ \\]."
        )
    }

    history_messages = _trim_chat_history(chat_history)
    user_message = {"role": "user", "content": question}
    return [system_message, *history_messages, user_message], len(history_messages)


def _format_pi_value(value):
    if abs(value) < 1e-9:
        return "0"
    ratio = value / math.pi
    rounded = round(ratio)
    if abs(ratio - rounded) < 1e-9:
        if rounded == 1:
            return "π"
        if rounded == -1:
            return "-π"
        return f"{rounded}π"
    return f"{value:.6g}"


def _parse_number_token(token):
    token = str(token or "").strip()
    if not token:
        return None
    if "/" in token:
        left, right = token.split("/", 1)
        try:
            return float(left) / float(right)
        except Exception:
            return None
    try:
        return float(token)
    except Exception:
        return None


def _parse_pi_bound(token):
    token = str(token or "").strip().lower().replace("−", "-")
    if not token:
        return None
    if "pi" in token:
        sign = -1.0 if token.startswith("-") else 1.0
        core = token.lstrip("+-").replace("pi", "")
        if core == "":
            factor = 1.0
        else:
            factor = _parse_number_token(core)
        if factor is None:
            return None
        return sign * factor * math.pi
    return _parse_number_token(token)


def _periodic_solutions(base_values, period, lower, upper):
    solutions = set()
    if period <= 0:
        return solutions

    for base in base_values:
        k_min = math.floor((lower - base) / period) - 1
        k_max = math.ceil((upper - base) / period) + 1
        for k in range(int(k_min), int(k_max) + 1):
            value = base + k * period
            if lower - 1e-9 <= value <= upper + 1e-9:
                solutions.add(round(value, 12))
    return solutions


def solve_trig_squared_equation(question):
    """Solve equations like a trig^2(x/d) + c = 0 over lower <= x <= upper."""
    q = str(question or "").lower().replace("−", "-")
    compact = q.replace(" ", "")
    compact = compact.replace("theta", "x").replace("\\theta", "x")
    compact = compact.replace("^", "")
    compact = compact.replace("≤", "<=")

    pattern = re.compile(
        r"solve"
        r"([+\-]?\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)?)?"
        r"(sin|cos|tan)2"
        r"\(x/([+\-]?\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)?)\)"
        r"([+\-]\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)?)=0"
        r"for(.+?)<=x<=(.+)$"
    )
    m = pattern.search(compact)
    if not m:
        return None

    a = _parse_number_token(m.group(1) or "1")
    trig = m.group(2)
    d = _parse_number_token(m.group(3))
    c = _parse_number_token(m.group(4))
    lower = _parse_pi_bound(m.group(5))
    upper = _parse_pi_bound(m.group(6))

    if None in (a, d, c, lower, upper):
        return None
    if abs(a) < 1e-12 or abs(d) < 1e-12 or lower > upper:
        return None

    rhs = -c / a  # trig^2(x/d) = rhs
    y_lower = lower / d
    y_upper = upper / d
    if y_lower > y_upper:
        y_lower, y_upper = y_upper, y_lower

    solutions_y = set()
    if trig in ("sin", "cos"):
        if rhs < 0 or rhs > 1:
            return (
                f"For real solutions, {trig}²(x/{d:.6g}) must be in [0, 1], "
                f"but it equals {rhs:.6g}. So there are no real solutions in "
                f"[{_format_pi_value(lower)}, {_format_pi_value(upper)}]."
            )

        root = math.sqrt(rhs)
        if trig == "sin":
            for target in (root, -root):
                alpha = math.asin(max(-1.0, min(1.0, target)))
                base_values = [alpha, math.pi - alpha]
                solutions_y |= _periodic_solutions(base_values, 2 * math.pi, y_lower, y_upper)
        else:  # cos
            for target in (root, -root):
                alpha = math.acos(max(-1.0, min(1.0, target)))
                base_values = [alpha, -alpha]
                solutions_y |= _periodic_solutions(base_values, 2 * math.pi, y_lower, y_upper)
    else:  # tan
        if rhs < 0:
            return (
                f"For real solutions, tan²(x/{d:.6g}) cannot be negative, "
                f"but it equals {rhs:.6g}. So there are no real solutions in "
                f"[{_format_pi_value(lower)}, {_format_pi_value(upper)}]."
            )

        root = math.sqrt(rhs)
        for target in (root, -root):
            alpha = math.atan(target)
            solutions_y |= _periodic_solutions([alpha], math.pi, y_lower, y_upper)

    if not solutions_y:
        return f"No solutions in the interval [{_format_pi_value(lower)}, {_format_pi_value(upper)}]."

    solutions_x = sorted(round(d * y, 12) for y in solutions_y if lower - 1e-9 <= d * y <= upper + 1e-9)
    unique_x = []
    for value in solutions_x:
        if not unique_x or abs(value - unique_x[-1]) > 1e-9:
            unique_x.append(value)

    if not unique_x:
        return f"No solutions in the interval [{_format_pi_value(lower)}, {_format_pi_value(upper)}]."

    formatted = ", ".join(_format_pi_value(v) for v in unique_x)
    rhs_str = f"{rhs:.6g}".rstrip("0").rstrip(".")
    root_str = f"{math.sqrt(max(rhs, 0)):.6g}".rstrip("0").rstrip(".")
    trig_symbol = {"sin": "sin", "cos": "cos", "tan": "tan"}[trig]

    return (
        f"From {a:.6g}{trig_symbol}²(x/{d:.6g}) + ({c:.6g}) = 0, we get {trig_symbol}²(x/{d:.6g}) = {rhs_str}. "
        f"So {trig_symbol}(x/{d:.6g}) = ±{root_str}. "
        f"Within {_format_pi_value(lower)} ≤ x ≤ {_format_pi_value(upper)}, the solutions are x = {formatted}."
    )


def generate_local_fallback_answer(question):
    """Deterministic fallback for common solvable question patterns."""
    return solve_trig_squared_equation(question)

def _normalize_response_text(text):
    if text is None:
        return ""
    normalized = str(text)
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"[\t\x0b\x0c]+", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def format_llm_answer_for_chat(text):
    """Normalize LLM output while preserving math delimiters for frontend rendering."""
    s = _normalize_response_text(text)
    s = re.sub(r"```(?:[a-zA-Z]+)?\n?", "", s)
    s = s.replace("```", "")
    s = re.sub(r"\*\*(.*?)\*\*", r"\1", s)
    s = re.sub(r"^#{1,6}\s*", "", s, flags=re.MULTILINE)

    # Convert common LaTeX operators/symbols so math is readable in plain chat.
    latex_symbol_map = {
        r"\\leq": "≤",
        r"\\geq": "≥",
        r"\\neq": "≠",
        r"\\pm": "±",
        r"\\times": "×",
        r"\\cdot": "·",
        r"\\infty": "∞",
        r"\\sum": "∑",
        r"\\int": "∫",
        r"\\theta": "θ",
        r"\\pi": "π",
        r"\\alpha": "α",
        r"\\beta": "β",
        r"\\gamma": "γ",
        r"\\Delta": "Δ",
        r"\\sqrt": "√",
        r"\\angle": "∠",
    }
    for pattern, symbol in latex_symbol_map.items():
        s = re.sub(pattern, symbol, s)

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

def generate_llm_answer(question, chat_history=None):
    """
    Generate a response using a hosted ChatGPT-style endpoint.
    This requires no local model installation.
    """
    messages, context_message_count = _build_chat_messages(question, chat_history)
    payload = {
        "model": CLOUD_LLM_MODEL,
        "stream": False,
        "temperature": 0.2,
        "messages": messages,
    }

    try:
        content, meta = call_cloud_llm(payload, timeout=60)

        content = format_llm_answer_for_chat(content)

        return content, {
            **meta,
            "used_fallback": False,
            "context_messages": context_message_count,
        }
    except Exception as e:
        local_answer = generate_local_fallback_answer(question)
        content = local_answer or FALLBACK_RESPONSE
        return content, {
            "provider": "fallback-local-solver" if local_answer else "fallback-llm-unavailable",
            "model": None,
            "used_fallback": local_answer is None,
            "used_local_solver": bool(local_answer),
            "context_messages": context_message_count,
            "error": str(e)
        }


def _clean_latex_candidate(text):
    """Normalize model output into a single LaTeX expression string."""
    s = _normalize_response_text(text)
    s = s.replace("```latex", "").replace("```", "").strip()

    # Remove common math delimiters if present.
    s = re.sub(r"^\$\$(.*)\$\$$", r"\1", s)
    s = re.sub(r"^\$(.*)\$$", r"\1", s)
    s = re.sub(r"^\\\((.*)\\\)$", r"\1", s)
    s = re.sub(r"^\\\[(.*)\\\]$", r"\1", s)

    # If multiple lines are returned, keep the first non-empty one.
    if "\n" in s:
        lines = [line.strip() for line in s.split("\n") if line.strip()]
        s = lines[0] if lines else ""

    return s.strip()


def _clean_plain_text_candidate(text):
    """Normalize short plain-text intent returned by the model."""
    s = _normalize_response_text(text)
    s = s.replace("```", "").strip()
    # Keep intent concise for input-box insertion.
    if len(s) > 240:
        s = s[:240].rstrip()
    return s


def generate_equation_draft(user_prompt):
    """Generate plain-text intent + one LaTeX draft for insertion into chat input."""
    payload = {
        "model": CLOUD_LLM_MODEL,
        "stream": False,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You convert mixed natural-language math prompts into two outputs. "
                    "Return ONLY valid JSON with keys: plain_text, latex. "
                    "plain_text: short normal-language intent with no LaTeX; use empty string if none. "
                    "latex: exactly ONE LaTeX equation/expression only, no markdown. "
                    "Do not wrap latex in $...$, \\(...\\), or \\[...\\]. "
                    "Prefer standard commands like \\frac, \\sqrt, \\sin, \\cos, \\tan. "
                    "Examples: "
                    "'Find all solutions to cos(x) = -1' -> {\"plain_text\":\"Find all solutions\",\"latex\":\"\\cos(x)=-1\"}; "
                    "'What is arcsin(0.5)?' -> {\"plain_text\":\"Evaluate\",\"latex\":\"\\arcsin(0.5)\"}; "
                    "'What angle has a sine of 0.866?' -> {\"plain_text\":\"Find the angle\",\"latex\":\"\\sin(x)=0.866\"}."
                )
            },
            {
                "role": "user",
                "content": user_prompt
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
            timeout=45
        )
        resp.raise_for_status()
        data = resp.json()

        choices = data.get("choices") or []
        first = choices[0] if choices else {}
        message = first.get("message") or {}
        content = (message.get("content") or "").strip()

        parsed = None
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            # Try extracting JSON object from accidental wrappers.
            m = re.search(r"\{[\s\S]*\}", content)
            if m:
                try:
                    parsed = json.loads(m.group(0))
                except json.JSONDecodeError:
                    parsed = None

        plain_text = ""
        latex = ""
        if isinstance(parsed, dict):
            plain_text = _clean_plain_text_candidate(parsed.get("plain_text") or "")
            latex = _clean_latex_candidate(parsed.get("latex") or "")

        # Fallback for non-JSON model output.
        if not latex:
            latex = _clean_latex_candidate(content)

        if not latex:
            raise ValueError("Empty equation draft")

        return {
            "plain_text": plain_text,
            "latex": latex
        }, {
            "provider": "pollinations",
            "model": CLOUD_LLM_MODEL,
            "used_fallback": False
        }
    except (requests.RequestException, TimeoutError, ValueError, json.JSONDecodeError) as e:
        return {
            "plain_text": "",
            "latex": ""
        }, {
            "provider": "fallback-llm-unavailable",
            "model": None,
            "used_fallback": True,
            "error": str(e)
        }


def _clean_latex_candidate(text):
    """Normalize model output into a single LaTeX expression string."""
    s = _normalize_response_text(text)
    s = s.replace("```latex", "").replace("```", "").strip()

    # Remove common math delimiters if present.
    s = re.sub(r"^\$\$(.*)\$\$$", r"\1", s)
    s = re.sub(r"^\$(.*)\$$", r"\1", s)
    s = re.sub(r"^\\\((.*)\\\)$", r"\1", s)
    s = re.sub(r"^\\\[(.*)\\\]$", r"\1", s)

    # If multiple lines are returned, keep the first non-empty one.
    if "\n" in s:
        lines = [line.strip() for line in s.split("\n") if line.strip()]
        s = lines[0] if lines else ""

    return s.strip()


def _clean_plain_text_candidate(text):
    """Normalize short plain-text intent returned by the model."""
    s = _normalize_response_text(text)
    s = s.replace("```", "").strip()
    # Keep intent concise for input-box insertion.
    if len(s) > 240:
        s = s[:240].rstrip()
    return s


def generate_equation_draft(user_prompt):
    """Generate plain-text intent + one LaTeX draft for insertion into chat input."""
    payload = {
        "model": CLOUD_LLM_MODEL,
        "stream": False,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You convert mixed natural-language math prompts into two outputs. "
                    "Return ONLY valid JSON with keys: plain_text, latex. "
                    "plain_text: short normal-language intent with no LaTeX; use empty string if none. "
                    "latex: exactly ONE LaTeX equation/expression only, no markdown. "
                    "Do not wrap latex in $...$, \\(...\\), or \\[...\\]. "
                    "Prefer standard commands like \\frac, \\sqrt, \\sin, \\cos, \\tan. "
                    "Examples: "
                    "'Find all solutions to cos(x) = -1' -> {\"plain_text\":\"Find all solutions\",\"latex\":\"\\cos(x)=-1\"}; "
                    "'What is arcsin(0.5)?' -> {\"plain_text\":\"Evaluate\",\"latex\":\"\\arcsin(0.5)\"}; "
                    "'What angle has a sine of 0.866?' -> {\"plain_text\":\"Find the angle\",\"latex\":\"\\sin(x)=0.866\"}."
                )
            },
            {
                "role": "user",
                "content": user_prompt
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
            timeout=45
        )
        resp.raise_for_status()
        data = resp.json()

        choices = data.get("choices") or []
        first = choices[0] if choices else {}
        message = first.get("message") or {}
        content = (message.get("content") or "").strip()

        parsed = None
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            # Try extracting JSON object from accidental wrappers.
            m = re.search(r"\{[\s\S]*\}", content)
            if m:
                try:
                    parsed = json.loads(m.group(0))
                except json.JSONDecodeError:
                    parsed = None

        plain_text = ""
        latex = ""
        if isinstance(parsed, dict):
            plain_text = _clean_plain_text_candidate(parsed.get("plain_text") or "")
            latex = _clean_latex_candidate(parsed.get("latex") or "")

        # Fallback for non-JSON model output.
        if not latex:
            latex = _clean_latex_candidate(content)

        if not latex:
            raise ValueError("Empty equation draft")

        return {
            "plain_text": plain_text,
            "latex": latex
        }, {
            "provider": "pollinations",
            "model": CLOUD_LLM_MODEL,
            "used_fallback": False
        }
    except (requests.RequestException, TimeoutError, ValueError, json.JSONDecodeError) as e:
        return {
            "plain_text": "",
            "latex": ""
        }, {
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
    except (requests.RequestException, TimeoutError, ValueError, json.JSONDecodeError):
        return "Other"


def classify_question_difficulty(question):
    """
    Classify a question difficulty as one of: easy, medium, hard.
    """
    payload = {
        "model": CLOUD_LLM_MODEL,
        "stream": False,
        "temperature": 0,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a math question difficulty classifier for O-Level students. "
                    "Classify the given math question into exactly one level: easy, medium, or hard. "
                    "Respond with only one lowercase word: easy, medium, or hard."
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
        difficulty = (message.get("content") or "").strip().lower()

        if difficulty not in ("easy", "medium", "hard"):
            difficulty = "medium"

        return difficulty
    except Exception:
        return "medium"


def classify_question_metadata(question):
    """
    Classify both topic and difficulty in a single LLM call to reduce latency.
    Returns: {"topic": <Topic>, "difficulty": <easy|medium|hard>}
    """
    payload = {
        "model": CLOUD_LLM_MODEL,
        "stream": False,
        "temperature": 0,
        "max_tokens": 50,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a math metadata classifier for O-Level students. "
                    "Return ONLY valid JSON with shape: "
                    "{\"topic\":\"Algebra|Trigonometry|Calculus|Geometry|Statistics|Other\","
                    "\"difficulty\":\"easy|medium|hard\"}."
                )
            },
            {
                "role": "user",
                "content": question
            }
        ]
    }

    valid_topics = {"Algebra", "Trigonometry", "Calculus", "Geometry", "Statistics", "Other"}
    valid_difficulties = {"easy", "medium", "hard"}

    try:
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
        first = choices[0] if choices else {}
        message = first.get("message") or {}
        content = (message.get("content") or "").strip()

        parsed = json.loads(content)
        topic = str(parsed.get("topic", "Other")).strip()
        difficulty = str(parsed.get("difficulty", "medium")).strip().lower()

        if topic not in valid_topics:
            topic = "Other"
        if difficulty not in valid_difficulties:
            difficulty = "medium"

        return {"topic": topic, "difficulty": difficulty}

    except Exception:
        return {"topic": "Other", "difficulty": "medium"}

@app.after_request
def add_cors_headers(response):
    allowed = {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
    }
    # Add production origin from env var (e.g. https://flipaha.onrender.com)
    prod_origin = os.getenv("CORS_ORIGIN")
    if prod_origin:
        allowed.add(prod_origin.rstrip("/"))

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


@app.route('/api/equation-draft', methods=['OPTIONS'])
def preflight_equation_draft():
    """Explicit CORS preflight for /api/equation-draft"""
    return jsonify({'status': 'ok'}), 200


@app.route('/api/equation-draft', methods=['POST'])
def equation_draft():
    """Generate a LaTeX equation draft from a natural-language request."""
    try:
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({'success': False, 'error': 'Not logged in'}), 401

        data = request.get_json(silent=True) or {}
        prompt = (data.get('prompt') or '').strip()

        if not prompt:
            return jsonify({'success': False, 'error': 'Prompt is required'}), 400
        if len(prompt) > 300:
            return jsonify({'success': False, 'error': 'Prompt is too long'}), 400

        draft, llm_meta = generate_equation_draft(prompt)
        latex = (draft.get('latex') or '').strip()
        plain_text = (draft.get('plain_text') or '').strip()

        if not latex:
            return jsonify({
                'success': False,
                'error': 'Could not generate an equation right now. Please try again.',
                'llm': llm_meta
            }), 503

        return jsonify({
            'success': True,
            'plain_text': plain_text,
            'latex': latex,
            'llm': llm_meta
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

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

        history_before = _trim_chat_history(session.get("chat_history") or [])

        # 3) Run answer and metadata classification in parallel to cut latency.
        with ThreadPoolExecutor(max_workers=2) as executor:
            answer_future = executor.submit(generate_llm_answer, question, history_before)
            metadata_future = executor.submit(classify_question_metadata, question)
            answer, llm_meta = answer_future.result()
            metadata = metadata_future.result()

        topic = metadata.get("topic", "Other")
        difficulty = metadata.get("difficulty", "medium")
        
        # Ensure quality before returning to client
        original_answer = answer
        quality_before_guard = evaluate_response_quality(question, answer)
        quality_guard_triggered = not quality_before_guard["is_proper"]
        if quality_guard_triggered:
            answer = generate_local_fallback_answer(question) or FALLBACK_RESPONSE

        quality = evaluate_response_quality(question, answer)

        # 3b) Persist bounded chat context for lightweight conversational memory.
        updated_history = _trim_chat_history([
            *history_before,
            {"role": "user", "content": question},
            {"role": "assistant", "content": answer},
        ])
        session["chat_history"] = updated_history
        session.modified = True

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
                    input_method, topic, difficulty
                )
                VALUES (?, ?, ?, ?, ?, ?)
            """, (question_id, user_id, ts, input_method, topic, difficulty))
        conn.close()

        # 5) Return response
        return jsonify({
            'success': True,
            'question': question,
            'answer': answer,
            'topic': topic,
            'difficulty': difficulty,
            'question_id': question_id,
            'llm': llm_meta,
            'quality_guard': {
                'triggered': quality_guard_triggered,
                'issues_before_guard': quality_before_guard['issues'],
                'score_before_guard': quality_before_guard['score'],
                'answer_changed': answer != original_answer,
            },
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
                    input_method, topic, difficulty
                )
                VALUES (?, ?, ?, ?, ?, ?)
            """, (question_id, user_id, ts, input_method, 'Other', 'unknown'))
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
        raw_input = (data.get('raw_input') or '').strip()
        all_suggestions_list = data.get('all_suggestions') or []
        all_suggestions_json = json.dumps(all_suggestions_list) if all_suggestions_list else None
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
                    feedback_id, user_id, question_id, suggestion_text, rating,
                    raw_input, all_suggestions, feedback_timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (feedback_id, user_id, question_id, suggestion_text, rating,
                  raw_input, all_suggestions_json, ts))
        conn.close()

        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/suggestion-feedback/training-data', methods=['GET'])
def get_training_data():
    """Export feedback data for offline GBDT model training.

    Response: JSON array of { suggestion_text, rating, raw_input, all_suggestions }
    Admin only.
    """
    if session.get('role') != 'admin':
        abort(403)

    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT suggestion_text, rating, raw_input, all_suggestions,
                   feedback_timestamp
            FROM suggestion_feedback
            ORDER BY feedback_timestamp
        """)
        rows = cursor.fetchall()
        conn.close()

        data = []
        for r in rows:
            entry = {
                'suggestion_text': r['suggestion_text'],
                'rating': r['rating'],
                'raw_input': r['raw_input'] or '',
                'all_suggestions': json.loads(r['all_suggestions']) if r['all_suggestions'] else [],
                'timestamp': r['feedback_timestamp'],
            }
            data.append(entry)

        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/suggestion-feedback/scores', methods=['GET'])
def get_suggestion_scores():
    """Return aggregated feedback scores per suggestion for ranking.

    Response: { scores: { "<latex>": { ups, downs, total, score }, ... } }
    score = (ups - downs) / total  (range -1 to 1)
    Only suggestions with >= 2 ratings are included to reduce noise.
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT suggestion_text,
                   SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS ups,
                   SUM(CASE WHEN rating = 0 THEN 1 ELSE 0 END) AS downs,
                   COUNT(*) AS total
            FROM suggestion_feedback
            GROUP BY suggestion_text
            HAVING total >= 2
            ORDER BY total DESC
        """)
        rows = cursor.fetchall()
        conn.close()

        scores = {}
        for r in rows:
            total = r['total']
            ups = r['ups'] or 0
            downs = r['downs'] or 0
            scores[r['suggestion_text']] = {
                'ups': ups,
                'downs': downs,
                'total': total,
                'score': round((ups - downs) / total, 4) if total else 0
            }

        return jsonify({'success': True, 'scores': scores}), 200
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
        content, meta = call_cloud_llm(payload, timeout=20)
        ok = bool(content)
        return jsonify({
            'success': ok,
            'provider': 'pollinations',
            'base_url': meta.get('base_url') or CLOUD_LLM_BASE_URL,
            'configured_model': CLOUD_LLM_MODEL,
            'response_preview': content[:64]
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


app.secret_key = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")

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

@app.route("/imageHistory")
def image_history_page():
    return send_from_directory(os.path.join(FRONTEND_ROOT, "imageHistory"), "image-history.html")

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
    start_date = (request.args.get('start_date') or '').strip() or None
    end_date = (request.args.get('end_date') or '').strip() or None

    for value, label in ((start_date, 'start_date'), (end_date, 'end_date')):
        if value:
            try:
                datetime.strptime(value, '%Y-%m-%d')
            except ValueError:
                return jsonify({'error': f'Invalid {label}. Use YYYY-MM-DD'}), 400

    if start_date and end_date and start_date > end_date:
        return jsonify({'error': 'start_date cannot be after end_date'}), 400

    data = get_weekly_question_volume(start_date=start_date, end_date=end_date)
    return jsonify(data)

@app.route("/api/dashboard/input-method-trends")
def input_method_trends():
    start_date = (request.args.get('start_date') or '').strip() or None
    end_date = (request.args.get('end_date') or '').strip() or None

    for value, label in ((start_date, 'start_date'), (end_date, 'end_date')):
        if value:
            try:
                datetime.strptime(value, '%Y-%m-%d')
            except ValueError:
                return jsonify({'error': f'Invalid {label}. Use YYYY-MM-DD'}), 400

    if start_date and end_date and start_date > end_date:
        return jsonify({'error': 'start_date cannot be after end_date'}), 400

    data = get_weekly_input_method_trends(start_date=start_date, end_date=end_date)
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
        
        # Disabled: image quality check and storage
        # quality_result = image_processor.check_image_quality(file_data)
        # warnings = quality_result.get('warnings', [])
        # hint = None
        # if warnings:
        #     hint = '📸 Try a clearer photo for more accurate results.'
        # store_image(session_id, image_id, file_data)
        
        # return jsonify({
        #     'success': True,
        #     'image_id': image_id,
        #     'session_id': session_id,
        #     'filename': secure_filename(file.filename),
        #     'size': len(file_data),
        #     'quality': {
        #         'valid': quality_result.get('valid', True),
        #         'warnings': warnings,
        #         'hint': hint,
        #         'metrics': quality_result.get('metrics', {})
        #     }
        # }), 200
        return jsonify({
            'success': False,
            'error': 'Image upload/processing is disabled in this deployment.'
        }), 501
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
    return jsonify({
        'success': False,
        'error': 'Image conversion is disabled in this deployment.'
    }), 501

@app.route('/api/images', methods=['GET'])
def get_images():
    """
    Get all images for a session
    Query params: session_id
    Returns: {images: [...], stats: {total_images: N}}
    Only returns images if the session belongs to the logged-in user.
    """
    try:
        import base64
        
        session_id = request.args.get('session_id')
        if not session_id:
            return jsonify({
                'success': False,
                'error': 'Missing session_id parameter'
            }), 400
        
        # Verify the requesting user owns this session
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Authentication required'
            }), 401
        
        expected_session = f'user_{user_id}'
        if session_id != expected_session:
            return jsonify({
                'success': False,
                'error': 'Access denied: you can only view your own image history'
            }), 403
        
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

@app.route('/api/scan-feedback', methods=['POST'])
def scan_feedback():
    """
    Record thumbs-up (1) / thumbs-down (0) feedback for an inline scan conversion.
    JSON: {session_id, image_id, rating (0 or 1), original_latex?, edited_latex?}
    """
    try:
        data = request.get_json(silent=True) or {}
        session_id = (data.get('session_id') or '').strip()
        image_id = (data.get('image_id') or '').strip()
        rating = data.get('rating')

        if not session_id:
            return jsonify({'success': False, 'error': 'Missing session_id'}), 400

        if rating is None:
            return jsonify({'success': False, 'error': 'Missing rating'}), 400
        try:
            rating = int(rating)
            if rating not in (0, 1):
                return jsonify({'success': False, 'error': 'Rating must be 0 or 1'}), 400
        except (TypeError, ValueError):
            return jsonify({'success': False, 'error': 'Invalid rating value'}), 400

        user_id = session.get('user_id')
        feedback_id = str(uuid.uuid4())
        ts = datetime.now(SINGAPORE_TZ).isoformat()

        conn = get_db()
        with conn:
            conn.execute("""
                INSERT INTO image_feedback (feedback_id, user_id, session_id, image_id, rating, confidence, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (feedback_id, user_id, session_id, image_id or '', rating, None, ts))
        conn.close()

        return jsonify({'success': True, 'message': 'Feedback recorded'}), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/image/<image_id>', methods=['DELETE'])
def delete_image(image_id):
    """
    Delete an uploaded image
    JSON: {session_id}
    Returns: {success: bool}
    """
    try:
        data = request.json or {}
        session_id = data.get('session_id')
        
        if not session_id:
            return jsonify({
                'success': False,
                'error': 'Missing session_id parameter'
            }), 400
        
        if session_id in image_store and image_id in image_store[session_id]:
            del image_store[session_id][image_id]
            return jsonify({
                'success': True,
                'message': 'Image deleted successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Image not found'
            }), 404
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

    start_date = (request.args.get('start_date') or '').strip() or None
    end_date = (request.args.get('end_date') or '').strip() or None

    for value, label in ((start_date, 'start_date'), (end_date, 'end_date')):
        if value:
            try:
                datetime.strptime(value, '%Y-%m-%d')
            except ValueError:
                return jsonify({'error': f'Invalid {label}. Use YYYY-MM-DD'}), 400

    if start_date and end_date and start_date > end_date:
        return jsonify({'error': 'start_date cannot be after end_date'}), 400
    
    try:
        data = get_topic_frequency(start_date=start_date, end_date=end_date)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/dashboard/question-difficulty')
def question_difficulty_dashboard():
    """Get easy/medium/hard question distribution overall and by topic."""
    if session.get('role') != 'admin':
        abort(403)

    start_date = (request.args.get('start_date') or '').strip() or None
    end_date = (request.args.get('end_date') or '').strip() or None

    for value, label in ((start_date, 'start_date'), (end_date, 'end_date')):
        if value:
            try:
                datetime.strptime(value, '%Y-%m-%d')
            except ValueError:
                return jsonify({'error': f'Invalid {label}. Use YYYY-MM-DD'}), 400

    try:
        data = get_question_difficulty_distribution(start_date=start_date, end_date=end_date)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route("/api/dashboard/image-feedback")
def image_feedback_dashboard():
    """Get image converter star-rating stats for the dashboard"""
    if session.get('role') != 'admin':
        abort(403)

    try:
        data = get_image_feedback_stats()
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
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV", "development") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug)