from flask import Blueprint, request, jsonify, session
import hashlib
from werkzeug.security import check_password_hash
from database.db import get_db
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

login_bp = Blueprint("login_bp", __name__)

@login_bp.route("/login", methods=["POST"])
def login_user():
    data = request.get_json()

    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"message": "Username and password required"}), 400

    try:
        conn = get_db()
        cursor = conn.cursor()

        # Fetch user by username
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        conn.close()

        if not user:
            return jsonify({"message": "User not found"}), 404

        stored_password_hash = user["password"]

        if stored_password_hash.startswith("scrypt:") and not hasattr(hashlib, "scrypt"):
            return jsonify({
                "message": "This account uses a legacy password format not supported by the current Python runtime. Please reset the password or re-register this account."
            }), 503

        # Check password
        if not check_password_hash(stored_password_hash, password):
            return jsonify({"message": "Incorrect password"}), 401

        # Store current user_id and role in session
        session.permanent = True
        session["user_id"] = user["user_id"]
        session["role"] = user["role"]

        last_login = datetime.now(ZoneInfo("Asia/Singapore")).isoformat()
        # last_login = (datetime.now(ZoneInfo("Asia/Singapore")) - timedelta(days=45)).isoformat()

        conn = get_db()
        with conn:
            conn.execute("UPDATE users SET last_login = ? WHERE username = ?", (last_login, username))

        return jsonify({
            "message": "Login successful",
            "user": {
                "user_id": user["user_id"],
                "username": user["username"],
                "role": user["role"],
                "last_login": last_login
            }
        }), 200

    except Exception as e:
        print(e)
        return jsonify({"message": "Server error"}), 500
