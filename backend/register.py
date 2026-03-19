from flask import Blueprint, request, jsonify
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from werkzeug.security import generate_password_hash
from database.db import get_db
import os

register_bp = Blueprint("register_bp", __name__)

ADMIN_SECRET_CODE = os.getenv("ADMIN_SECRET_CODE", "ADMIN123")

@register_bp.route("/register", methods=["POST"])
def register_user():
    data = request.get_json()

    username = data.get("username")
    password = data.get("password")
    is_admin = data.get("isAdmin", False)
    admin_code = data.get("adminCode")

    if not username or not password:
        return jsonify({"message": "Username and password required"}), 400

    if is_admin and admin_code != ADMIN_SECRET_CODE:
        return jsonify({"message": "Invalid admin code"}), 403

    role = "admin" if is_admin else "student"
    user_id = str(uuid.uuid4())
    hashed_password = generate_password_hash(password, method="pbkdf2:sha256")
    
    singapore_tz = ZoneInfo("Asia/Singapore")
    created_at = datetime.now(singapore_tz).isoformat()

    try:
        conn = get_db()
        conn.execute("""
            INSERT INTO users (user_id, username, password, role, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, username, hashed_password, role, created_at))
        conn.commit()
        conn.close()

        return jsonify({"message": "Registration successful"}), 201

    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            return jsonify({"message": "Username already exists"}), 409
        print(e)
        return jsonify({"message": "Server error"}), 500
