from firebase_config import initialize_firebase
from datetime import datetime
import pytz

# Initialize Firestore
db = initialize_firebase()

# Set Singapore Timezone
sg_timezone = pytz.timezone("Asia/Singapore")

# Add a user 
def add_user(username, role):
    sg_time = datetime.now(sg_timezone)
    user_data = {
        "username": username,
        "role": role,
        "created_at": sg_time,
        "last_login": sg_time
    }
    # Use add() to auto-generate a document ID
    doc_ref = db.collection("users").add(user_data)
    print(f"User added successfully! Document ID: {doc_ref[1].id}")

if __name__ == "__main__":
    username = "testingforstudent2"
    role = "student"
    
    add_user(username, role)
