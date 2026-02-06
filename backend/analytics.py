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