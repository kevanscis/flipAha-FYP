from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from database.db import get_db

SINGAPORE_TZ = ZoneInfo("Asia/Singapore")

def get_active_user_counts():
    # Return counts of daily, weekly, and monthly active users (mutually exclusive)
    conn = get_db()
    cursor = conn.cursor()

    now = datetime.now(SINGAPORE_TZ)

    # Daily: users who logged in today only
    start_day = datetime(now.year, now.month, now.day, tzinfo=SINGAPORE_TZ)
    end_day = start_day + timedelta(days=1)
    cursor.execute("""
        SELECT COUNT(*) AS count FROM users
        WHERE last_login >= ? AND last_login < ?
    """, (start_day.isoformat(), end_day.isoformat()))
    daily_count = cursor.fetchone()["count"]

    # Weekly: users who logged in in the last 7 days excluding today
    start_week = now - timedelta(days=7)
    cursor.execute("""
        SELECT COUNT(*) AS count FROM users
        WHERE last_login >= ? AND last_login < ?
    """, (start_week.isoformat(), start_day.isoformat()))
    weekly_count = cursor.fetchone()["count"]

    # Monthly: users who logged in in the last 30 days excluding the last 7 days
    start_month = now - timedelta(days=30)
    cursor.execute("""
        SELECT COUNT(*) AS count FROM users
        WHERE last_login >= ? AND last_login < ?
    """, (start_month.isoformat(), start_week.isoformat()))
    monthly_count = cursor.fetchone()["count"]

    # Inactive: NULL OR older than 30 days
    cursor.execute("""
        SELECT COUNT(*) AS count
        FROM users
        WHERE last_login IS NULL
           OR last_login < ?
    """, (start_month.isoformat(),))
    inactive_count = cursor.fetchone()["count"]

    conn.close()
    return daily_count, weekly_count, monthly_count, inactive_count

def get_new_vs_returning_last_7_days():
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.now(SINGAPORE_TZ)

    start = now - timedelta(days=7)

    # New active users (created in last 7 days AND logged in in last 7 days)
    cursor.execute("""
        SELECT COUNT(*) AS count
        FROM users
        WHERE created_at >= ?
          AND last_login >= ?
    """, (start.isoformat(), start.isoformat()))
    new_active = cursor.fetchone()["count"]

    # Returning active users (created more than 7 days ago AND logged in in last 7 days)
    cursor.execute("""
        SELECT COUNT(*) AS count
        FROM users
        WHERE created_at < ?
          AND last_login >= ?
    """, (start.isoformat(), start.isoformat()))
    returning_active = cursor.fetchone()["count"]

    conn.close()
    return new_active, returning_active

def get_weekly_question_volume():
    conn = get_db()
    cursor = conn.cursor()

    today = datetime.now(SINGAPORE_TZ).date()
    start_date = today - timedelta(days=6)  # last 7 days incl today

    cursor.execute("""
        SELECT
            DATE(question_timestamp) AS day,
            COUNT(*) AS count
        FROM questions
        WHERE DATE(question_timestamp) >= ?
        GROUP BY day
        ORDER BY day ASC
    """, (start_date.isoformat(),))

    rows = cursor.fetchall()
    conn.close()

    # Convert to dict for easy lookup
    data = {row["day"]: row["count"] for row in rows}

    # Ensure all 7 days exist (fill missing days with 0)
    result = []
    for i in range(7):
        day = (start_date + timedelta(days=i)).isoformat()
        result.append({
            "day": day,
            "count": data.get(day, 0)
        })

    return result


def get_weekly_input_method_trends():
    conn = get_db()
    cur = conn.cursor()

    today = datetime.now(SINGAPORE_TZ).date()
    start_date = today - timedelta(days=6)  # last 7 days incl today

    cur.execute("""
        SELECT
            DATE(question_timestamp) AS day,
            input_method,
            COUNT(*) AS count
        FROM questions
        WHERE DATE(question_timestamp) >= ?
          AND input_method IN ('typing', 'suggestion')
        GROUP BY day, input_method
        ORDER BY day ASC
    """, (start_date.isoformat(),))

    rows = cur.fetchall()
    conn.close()

    # Build lookup: {(day, method): count}
    lookup = {(r["day"], r["input_method"]): r["count"] for r in rows}

    # Fill missing days with 0s for both series
    result = []
    for i in range(7):
        day = (start_date + timedelta(days=i)).isoformat()
        result.append({
            "day": day,
            "typing": int(lookup.get((day, "typing"), 0)),
            "suggestion": int(lookup.get((day, "suggestion"), 0))
        })

    return result

if __name__ == "__main__":
    daily, weekly, monthly, inactive = get_active_user_counts()
    print("Number of Active Students:")
    print(f"Daily Active Users: {daily}")
    print(f"Weekly Active Users: {weekly}")
    print(f"Monthly Active Users: {monthly}")
    print(f"InActive Users: {inactive}")
    print("------------------------------------")

    new_users, returning_users = get_new_vs_returning_last_7_days()
    print("New vs Returning Students:")
    print(f"New Users: {new_users}")
    print(f"Returning Users: {returning_users}")
    print("------------------------------------")

    question_volume = get_weekly_question_volume()
    print(question_volume)
    print("------------------------------------")

    input_method_trends = get_weekly_input_method_trends()
    print(input_method_trends)
    print("------------------------------------")