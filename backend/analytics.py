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

def get_active_users_daily_trend(days=7):
    conn = get_db()
    cur = conn.cursor()

    today = datetime.now(SINGAPORE_TZ).date()
    start = today - timedelta(days=days-1)

    cur.execute("""
        SELECT DATE(last_login) AS day,
               COUNT(DISTINCT user_id) AS count
        FROM users
        WHERE last_login IS NOT NULL
          AND DATE(last_login) >= ?
        GROUP BY day
        ORDER BY day ASC
    """, (start.isoformat(),))

    rows = cur.fetchall()
    conn.close()

    lookup = {r["day"]: r["count"] for r in rows}
    result = []
    for i in range(days):
        day = (start + timedelta(days=i)).isoformat()
        result.append({"label": day, "count": int(lookup.get(day, 0))})
    return result

def get_active_users_weekly_trend(weeks=4):
    conn = get_db()
    cur = conn.cursor()

    now = datetime.now(SINGAPORE_TZ)
    start = (now - timedelta(days=7*(weeks-1))).date()

    # Week label using year-week (YYYY-WW)
    cur.execute("""
        SELECT strftime('%Y-W%W', last_login) AS wk,
               COUNT(DISTINCT user_id) AS count
        FROM users
        WHERE last_login IS NOT NULL
          AND DATE(last_login) >= ?
        GROUP BY wk
        ORDER BY wk ASC
    """, (start.isoformat(),))

    rows = cur.fetchall()
    conn.close()

    # Fill missing weeks roughly by stepping 7 days
    lookup = {r["wk"]: r["count"] for r in rows}
    result = []
    for i in range(weeks):
        d = start + timedelta(days=7*i)
        wk = d.strftime("%Y-W%W")
        result.append({"label": wk, "count": int(lookup.get(wk, 0))})
    return result

def get_active_users_monthly_trend(months=6):
    conn = get_db()
    cur = conn.cursor()

    now = datetime.now(SINGAPORE_TZ)
    # approximate start by 31 days*months; good enough for charts
    start = (now - timedelta(days=31*(months-1))).date()

    cur.execute("""
        SELECT strftime('%Y-%m', last_login) AS ym,
               COUNT(DISTINCT user_id) AS count
        FROM users
        WHERE last_login IS NOT NULL
          AND DATE(last_login) >= ?
        GROUP BY ym
        ORDER BY ym ASC
    """, (start.isoformat(),))

    rows = cur.fetchall()
    conn.close()

    lookup = {r["ym"]: r["count"] for r in rows}

    # Fill missing months by stepping month manually (simple method)
    result = []
    y, m = start.year, start.month
    for _ in range(months):
        ym = f"{y:04d}-{m:02d}"
        result.append({"label": ym, "count": int(lookup.get(ym, 0))})
        m += 1
        if m == 13:
            m = 1
            y += 1
    return result

def get_inactive_users_monthly_trend(months=6):
    conn = get_db()
    cur = conn.cursor()

    now = datetime.now(SINGAPORE_TZ)
    # start around months-1 months ago (rough)
    start_date = (now - timedelta(days=31*(months-1))).date()

    result = []
    y, m = start_date.year, start_date.month

    for _ in range(months):
        month_start = datetime(y, m, 1, tzinfo=SINGAPORE_TZ).date()
        cutoff = month_start - timedelta(days=30)

        cur.execute("""
            SELECT COUNT(*) AS count
            FROM users
            WHERE last_login IS NULL OR DATE(last_login) < ?
        """, (cutoff.isoformat(),))

        count = cur.fetchone()["count"]
        result.append({"label": f"{y:04d}-{m:02d}", "count": int(count)})

        m += 1
        if m == 13:
            m = 1
            y += 1

    conn.close()
    return result

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

def get_weekly_question_volume(start_date=None, end_date=None):
    conn = get_db()
    cursor = conn.cursor()

    today = datetime.now(SINGAPORE_TZ).date()

    if start_date:
        start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
    if end_date:
        end_date = datetime.strptime(end_date, "%Y-%m-%d").date()

    if start_date is None and end_date is None:
        end_date = today
        start_date = today - timedelta(days=6)  # default: last 7 days incl today
    elif start_date is None:
        start_date = end_date - timedelta(days=6)
    elif end_date is None:
        end_date = today

    cursor.execute("""
        SELECT
            DATE(question_timestamp) AS day,
            COUNT(*) AS count
        FROM questions
        WHERE DATE(question_timestamp) >= ?
          AND DATE(question_timestamp) <= ?
        GROUP BY day
        ORDER BY day ASC
    """, (start_date.isoformat(), end_date.isoformat()))

    rows = cursor.fetchall()
    conn.close()

    # Convert to dict for easy lookup
    data = {row["day"]: row["count"] for row in rows}

    # Ensure every day in range exists (fill missing days with 0)
    result = []
    total_days = (end_date - start_date).days + 1
    for i in range(total_days):
        day = (start_date + timedelta(days=i)).isoformat()
        result.append({
            "day": day,
            "count": data.get(day, 0)
        })

    return result


def get_weekly_input_method_trends(start_date=None, end_date=None):
    conn = get_db()
    cur = conn.cursor()

    today = datetime.now(SINGAPORE_TZ).date()

    if start_date:
        start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
    if end_date:
        end_date = datetime.strptime(end_date, "%Y-%m-%d").date()

    if start_date is None and end_date is None:
        end_date = today
        start_date = today - timedelta(days=6)  # default: last 7 days incl today
    elif start_date is None:
        start_date = end_date - timedelta(days=6)
    elif end_date is None:
        end_date = today

    cur.execute("""
        SELECT
            DATE(question_timestamp) AS day,
            input_method,
            COUNT(*) AS count
        FROM questions
        WHERE DATE(question_timestamp) >= ?
          AND DATE(question_timestamp) <= ?
          AND input_method IN ('typing', 'suggestion', 'image')
        GROUP BY day, input_method
        ORDER BY day ASC
    """, (start_date.isoformat(), end_date.isoformat()))

    rows = cur.fetchall()
    conn.close()

    # Build lookup: {(day, method): count}
    lookup = {(r["day"], r["input_method"]): r["count"] for r in rows}

    # Fill missing days with 0s for all three series
    result = []
    total_days = (end_date - start_date).days + 1
    for i in range(total_days):
        day = (start_date + timedelta(days=i)).isoformat()
        result.append({
            "day": day,
            "typing": int(lookup.get((day, "typing"), 0)),
            "suggestion": int(lookup.get((day, "suggestion"), 0)),
            "image": int(lookup.get((day, "image"), 0))
        })

    return result

def get_topic_frequency(start_date=None, end_date=None):
    """Get the frequency distribution of topics from all questions"""
    conn = get_db()
    cursor = conn.cursor()

    filters = ["1=1"]
    params = []

    if start_date:
        filters.append("DATE(question_timestamp) >= ?")
        params.append(start_date)
    if end_date:
        filters.append("DATE(question_timestamp) <= ?")
        params.append(end_date)

    where_clause = " AND ".join(filters)

    cursor.execute(f"""
        SELECT
            topic,
            COUNT(*) AS count
        FROM questions
        WHERE {where_clause}
        GROUP BY topic
        ORDER BY count DESC
    """, tuple(params))

    rows = cursor.fetchall()
    conn.close()

    result = []
    for row in rows:
        result.append({
            "topic": row["topic"],
            "count": row["count"]
        })

    return result

def get_image_feedback_stats():
    """Get thumbs-up / thumbs-down counts for image converter feedback."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS useful
        FROM image_feedback
        WHERE rating IS NOT NULL
    """)
    row = cursor.fetchone()
    conn.close()

    total = row["total"] or 0
    useful = row["useful"] or 0
    not_useful = total - useful
    rate = round((useful / total) * 100) if total > 0 else None

    return {
        "total": total,
        "useful": useful,
        "not_useful": not_useful,
        "rate": rate
    }


def get_question_difficulty_distribution(start_date=None, end_date=None):
    """
    Return overall and per-topic difficulty breakdown for easy/medium/hard.
    Optionally filter by question date range (inclusive) using YYYY-MM-DD.
    """
    conn = get_db()
    cursor = conn.cursor()

    filters = ["LOWER(COALESCE(difficulty, '')) IN ('easy', 'medium', 'hard')"]
    params = []

    if start_date:
        filters.append("DATE(question_timestamp) >= ?")
        params.append(start_date)

    if end_date:
        filters.append("DATE(question_timestamp) <= ?")
        params.append(end_date)

    where_clause = " AND ".join(filters)

    cursor.execute(f"""
        SELECT LOWER(difficulty) AS difficulty, COUNT(*) AS count
        FROM questions
        WHERE {where_clause}
        GROUP BY LOWER(difficulty)
    """, tuple(params))
    overall_rows = cursor.fetchall()

    overall_counts = {"easy": 0, "medium": 0, "hard": 0}
    for row in overall_rows:
        level = row["difficulty"]
        if level in overall_counts:
            overall_counts[level] = int(row["count"])

    overall_total = sum(overall_counts.values())

    cursor.execute(f"""
        SELECT
            topic,
            SUM(CASE WHEN LOWER(difficulty) = 'easy' THEN 1 ELSE 0 END) AS easy_count,
            SUM(CASE WHEN LOWER(difficulty) = 'medium' THEN 1 ELSE 0 END) AS medium_count,
            SUM(CASE WHEN LOWER(difficulty) = 'hard' THEN 1 ELSE 0 END) AS hard_count,
            COUNT(*) AS total
        FROM questions
        WHERE {where_clause}
        GROUP BY topic
        ORDER BY total DESC, topic ASC
    """, tuple(params))
    topic_rows = cursor.fetchall()
    conn.close()

    topics = []
    for row in topic_rows:
        total = int(row["total"] or 0)
        easy_count = int(row["easy_count"] or 0)
        medium_count = int(row["medium_count"] or 0)
        hard_count = int(row["hard_count"] or 0)

        topics.append({
            "topic": row["topic"] or "Other",
            "total": total,
            "easy_count": easy_count,
            "medium_count": medium_count,
            "hard_count": hard_count,
            "easy_pct": round((easy_count / total) * 100, 1) if total else 0,
            "medium_pct": round((medium_count / total) * 100, 1) if total else 0,
            "hard_pct": round((hard_count / total) * 100, 1) if total else 0,
        })

    return {
        "date_range": {
            "start_date": start_date,
            "end_date": end_date,
        },
        "overall": {
            "total": overall_total,
            "easy_count": overall_counts["easy"],
            "medium_count": overall_counts["medium"],
            "hard_count": overall_counts["hard"],
            "easy_pct": round((overall_counts["easy"] / overall_total) * 100, 1) if overall_total else 0,
            "medium_pct": round((overall_counts["medium"] / overall_total) * 100, 1) if overall_total else 0,
            "hard_pct": round((overall_counts["hard"] / overall_total) * 100, 1) if overall_total else 0,
        },
        "topics": topics,
    }

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