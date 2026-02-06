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

    conn.close()
    return daily_count, weekly_count, monthly_count

def get_new_and_returning_users():
    # Return counts of new and returning users
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.now(SINGAPORE_TZ)

    # New users: created in the last 7 days
    start_new = now - timedelta(days=7)
    cursor.execute("""
        SELECT COUNT(*) AS count FROM users
        WHERE created_at >= ?
    """, (start_new.isoformat(),))
    new_count = cursor.fetchone()["count"]

    # Returning users: created more than 30 days ago but logged in within last 30 days
    start_30_days_ago = now - timedelta(days=30)
    cursor.execute("""
        SELECT COUNT(*) AS count FROM users
        WHERE created_at < ? AND last_login >= ?
    """, (start_30_days_ago.isoformat(), start_30_days_ago.isoformat()))
    returning_count = cursor.fetchone()["count"]

    conn.close()
    return new_count, returning_count

if __name__ == "__main__":
    daily, weekly, monthly = get_active_user_counts()
    print("Number of Active Students:")
    print(f"Daily Active Users: {daily}")
    print(f"Weekly Active Users: {weekly}")
    print(f"Monthly Active Users: {monthly}")
    print("------------------------------------")

    new_users, returning_users = get_new_and_returning_users()
    print("New vs Returning Students:")
    print(f"New Users: {new_users}")
    print(f"Returning Users: {returning_users}")
    print("------------------------------------")