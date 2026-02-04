import sqlite3

def print_db_schema(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get all tables
    cursor.execute("""
        SELECT name
        FROM sqlite_master
        WHERE type='table'
        AND name NOT LIKE 'sqlite_%';
    """)
    tables = cursor.fetchall()

    print("Database Schema\n")

    for (table_name,) in tables:
        print(f"Table: {table_name}")
        print("-" * (7 + len(table_name)))

        # Get table columns
        cursor.execute(f"PRAGMA table_info({table_name});")
        columns = cursor.fetchall()

        for col in columns:
            cid, name, datatype, notnull, default, pk = col
            print(f"  - {name} ({datatype})"
                  f"{' PRIMARY KEY' if pk else ''}"
                  f"{' NOT NULL' if notnull else ''}")

        print()

    conn.close()


def view_users(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM users")
    users = cursor.fetchall()

    if not users:
        print("No users found in the users table.")
    else:
        print("Users Table Data\n")
        for user in users:
            print({
                "user_id": user["user_id"],
                "username": user["username"],
                "role": user["role"],
                "created_at": user["created_at"],
                "last_login": user["last_login"]
            })
        print()

    conn.close()

def delete_all_users(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Delete all rows from users table
    cursor.execute("DELETE FROM users")
    conn.commit()
    conn.close()
    print("All data in users table has been deleted.")

DB_PATH = "app.db"

# print_db_schema(DB_PATH)
view_users(DB_PATH) # username: 123 password: 123
# delete_all_users(DB_PATH)