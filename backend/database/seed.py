"""
Seed script to populate the database with realistic sample data.
Run from the backend/database/ directory:
    python seed.py

This will add:
- 40 student users + 2 teacher users
- User activity records spread across the last 90 days
- ~500 questions across various topics and input methods
- Processing records for each question
- Suggestion feedback entries
"""

import sqlite3
import uuid
import random
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = Path(__file__).parent / "app.db"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def uid():
    return str(uuid.uuid4())

def random_dt(start: datetime, end: datetime) -> datetime:
    """Return a random datetime between start and end."""
    delta = end - start
    secs = int(delta.total_seconds())
    return start + timedelta(seconds=random.randint(0, max(secs, 1)))

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

NUM_STUDENTS = 40
NUM_TEACHERS = 2
DAYS_SPAN = 90  # how many days of history to generate

TOPICS = ["trigonometry", "algebra", "logarithms", "fractions", "vectors", "calculus", "statistics"]
TOPIC_WEIGHTS = [25, 30, 15, 10, 8, 7, 5]  # weighted distribution

INPUT_METHODS = ["typing", "suggestion", "image"]
INPUT_WEIGHTS = [45, 35, 20]

SUGGESTION_TEXTS = [
    "sin(x) + cos(x)",
    "x^2 + 2x + 1",
    "log(a) + log(b) = log(ab)",
    "\\frac{a}{b} + \\frac{c}{d}",
    "\\vec{a} \\cdot \\vec{b}",
    "\\int x^2 dx",
    "\\sum_{i=1}^{n} i",
    "tan(\\theta) = \\frac{sin(\\theta)}{cos(\\theta)}",
    "e^{i\\pi} + 1 = 0",
    "\\sqrt{a^2 + b^2}",
    "\\frac{d}{dx} e^x = e^x",
    "\\lim_{x \\to 0} \\frac{sin(x)}{x} = 1",
]

FIRST_NAMES = [
    "Wei", "Jun", "Xin", "Yi", "Zhi", "Min", "Hui", "Jia", "Li", "Chen",
    "Kai", "Ting", "Yan", "Hong", "Shu", "Mei", "Rui", "Hao", "Fang", "Qian",
    "Amir", "Sarah", "Raj", "Priya", "Ahmad", "Nurul", "Darren", "Rachel",
    "Brandon", "Chloe", "Ethan", "Fiona", "Gabriel", "Hannah", "Isaac", "Jasmine",
    "Kevin", "Lina", "Marcus", "Natalie", "Oscar", "Penny",
]

# ---------------------------------------------------------------------------
# Seed logic
# ---------------------------------------------------------------------------

def seed():
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.execute("PRAGMA foreign_keys = ON")
    cur = conn.cursor()

    now = datetime.now()
    start = now - timedelta(days=DAYS_SPAN)

    print(f"Seeding database at {DB_PATH} ...")
    print(f"Date range: {start.strftime('%Y-%m-%d')} → {now.strftime('%Y-%m-%d')}")

    # ------------------------------------------------------------------
    # 1. Users
    # ------------------------------------------------------------------
    user_ids = []
    random.shuffle(FIRST_NAMES)

    for i in range(NUM_STUDENTS + NUM_TEACHERS):
        user_id = uid()
        role = "teacher" if i < NUM_TEACHERS else "student"
        name = FIRST_NAMES[i % len(FIRST_NAMES)]
        username = f"{name.lower()}_{i:03d}"

        # Spread creation dates across the span
        created_at = random_dt(start, now - timedelta(days=1))

        # Vary last_login: some active today, some recently, some inactive
        r = random.random()
        if r < 0.3:
            # Active today
            last_login = random_dt(now - timedelta(hours=random.randint(1, 12)), now)
        elif r < 0.55:
            # Active this week
            last_login = random_dt(now - timedelta(days=random.randint(1, 6)), now - timedelta(days=1))
        elif r < 0.75:
            # Active this month
            last_login = random_dt(now - timedelta(days=random.randint(8, 29)), now - timedelta(days=7))
        elif r < 0.90:
            # Inactive (> 30 days)
            last_login = random_dt(start, now - timedelta(days=31))
        else:
            # Never logged in
            last_login = None

        cur.execute(
            "INSERT OR IGNORE INTO users (user_id, username, password, role, created_at, last_login) VALUES (?,?,?,?,?,?)",
            (user_id, username, "hashed_password_placeholder", role,
             created_at.isoformat(), last_login.isoformat() if last_login else None)
        )
        user_ids.append((user_id, created_at, last_login))

    print(f"  ✓ {NUM_STUDENTS + NUM_TEACHERS} users created")

    # ------------------------------------------------------------------
    # 2. User Activity
    # ------------------------------------------------------------------
    activity_count = 0
    for user_id, created_at, last_login in user_ids:
        # Generate between 3 and 40 activity events per user
        num_events = random.randint(3, 40)
        upper = last_login if last_login else now - timedelta(days=30)
        if upper < created_at:
            upper = created_at + timedelta(days=1)
        for _ in range(num_events):
            ts = random_dt(created_at, upper)
            cur.execute(
                "INSERT INTO user_activity (user_activity_id, user_id, activity_timestamp) VALUES (?,?,?)",
                (uid(), user_id, ts.isoformat())
            )
            activity_count += 1

    print(f"  ✓ {activity_count} user activity records")

    # ------------------------------------------------------------------
    # 3. Questions  (spread across last DAYS_SPAN days, heavier on recent)
    # ------------------------------------------------------------------
    question_records = []  # (question_id, user_id, timestamp, input_method, topic)
    total_questions = 0

    for user_id, created_at, last_login in user_ids:
        # Students ask more questions
        if last_login is None:
            num_q = random.randint(0, 3)
        else:
            num_q = random.randint(5, 25)

        upper = last_login if last_login else now - timedelta(days=30)
        if upper < created_at:
            upper = created_at + timedelta(days=1)

        for _ in range(num_q):
            q_id = uid()
            ts = random_dt(created_at, upper)
            topic = random.choices(TOPICS, weights=TOPIC_WEIGHTS, k=1)[0]
            method = random.choices(INPUT_METHODS, weights=INPUT_WEIGHTS, k=1)[0]

            cur.execute(
                "INSERT INTO questions (question_id, user_id, question_timestamp, input_method, topic) VALUES (?,?,?,?,?)",
                (q_id, user_id, ts.isoformat(), method, topic)
            )
            question_records.append((q_id, user_id, ts, method, topic))
            total_questions += 1

    print(f"  ✓ {total_questions} questions")

    # ------------------------------------------------------------------
    # 4. Processing  (one per question)
    # ------------------------------------------------------------------
    for q_id, user_id, ts, method, topic in question_records:
        success = 1 if random.random() < 0.88 else 0
        ocr_conf = round(random.uniform(0.55, 0.99), 3) if method == "image" else None
        retake = random.choice([0, 0, 0, 1]) if method == "image" else 0
        resp_time = random.randint(200, 4500)
        sys_error = 1 if random.random() < 0.03 else 0

        cur.execute(
            "INSERT INTO processing (processing_id, question_id, processing_success, ocr_confidence, retake, response_time_ms, system_error) VALUES (?,?,?,?,?,?,?)",
            (uid(), q_id, success, ocr_conf, retake, resp_time, sys_error)
        )

    print(f"  ✓ {total_questions} processing records")

    # ------------------------------------------------------------------
    # 5. Suggestion Feedback  (~40 % of questions get feedback)
    # ------------------------------------------------------------------
    feedback_count = 0
    for q_id, user_id, ts, method, topic in question_records:
        if random.random() > 0.40:
            continue
        suggestion_text = random.choice(SUGGESTION_TEXTS)
        rating = random.choices([1, 2, 3, 4, 5], weights=[5, 10, 20, 35, 30], k=1)[0]
        fb_ts = ts + timedelta(seconds=random.randint(5, 300))

        cur.execute(
            "INSERT INTO suggestion_feedback (feedback_id, user_id, question_id, suggestion_text, rating, feedback_timestamp) VALUES (?,?,?,?,?,?)",
            (uid(), user_id, q_id, suggestion_text, rating, fb_ts.isoformat())
        )
        feedback_count += 1

    print(f"  ✓ {feedback_count} suggestion feedback records")

    conn.commit()
    conn.close()
    print("\nDone! Database seeded successfully.")


if __name__ == "__main__":
    seed()
