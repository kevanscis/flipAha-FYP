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


# Example usage
print_db_schema("app.db")
