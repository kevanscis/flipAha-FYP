import sqlite3

def get_db():
    # Crease or open database file
    conn = sqlite3.connect("app.db")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn