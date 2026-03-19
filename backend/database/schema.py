from db import get_db

def create_tables():
    db = get_db()
    db.executescript("""                     
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at DATETIME NOT NULL,
        last_login DATETIME
    );
    
    CREATE TABLE IF NOT EXISTS user_activity (
        user_activity_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        activity_timestamp DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
    );
                        
    CREATE TABLE IF NOT EXISTS questions (
        question_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        question_timestamp DATETIME NOT NULL,
        input_method TEXT NOT NULL,
        topic TEXT NOT NULL,
        difficulty TEXT,
        FOREIGN KEY (user_id) REFERENCES users(user_id)                 
    );
                        
    CREATE TABLE IF NOT EXISTS processing (
        processing_id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL,
        processing_success INTEGER NOT NULL,
        ocr_confidence REAL,
        retake INTEGER,
        response_time_ms INTEGER NOT NULL,
        system_error INTEGER NOT NULL,
        FOREIGN KEY (question_id) REFERENCES questions(question_id)
    );
                        
    CREATE TABLE IF NOT EXISTS suggestion_feedback (
        feedback_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        question_id TEXT,
        suggestion_text TEXT NOT NULL,
        rating INTEGER NOT NULL,
        raw_input TEXT,
        all_suggestions TEXT,
        feedback_timestamp DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (question_id) REFERENCES questions(question_id)
    );

    CREATE TABLE IF NOT EXISTS image_feedback (
        feedback_id TEXT PRIMARY KEY,
        user_id TEXT,
        session_id TEXT NOT NULL,
        image_id TEXT NOT NULL,
        rating INTEGER,
        confidence REAL,
        created_at DATETIME NOT NULL
    );
    """)
    db.commit()

    # Migrate: add new columns if they don't exist (for existing databases)
    try:
        db.execute("ALTER TABLE suggestion_feedback ADD COLUMN raw_input TEXT")
    except Exception:
        pass  # column already exists
    try:
        db.execute("ALTER TABLE suggestion_feedback ADD COLUMN all_suggestions TEXT")
    except Exception:
        pass  # column already exists
    try:
        db.execute("ALTER TABLE questions ADD COLUMN difficulty TEXT")
    except Exception:
        pass  # column already exists
    db.commit()

    db.close()

create_tables()

if __name__ == "__main__":
    try:
        create_tables()
        print("Tables created successfully")
    except Exception as e:
        print("Error creating tables:", e)