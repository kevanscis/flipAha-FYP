from firebase_config import initialize_firebase
from firebase_admin import auth
from datetime import datetime
import pytz

# Initialize Firestore
db = initialize_firebase()

# Set Singapore Timezone
sg_timezone = pytz.timezone("Asia/Singapore")

# Sign up

def signup(email, password, role):
    # 1. Create Auth user
    user = auth.create_user(
        email = email,
        password = password
    )

    print("User created")
    print("UID:", user.uid)

    # 2. Create Firestore user profile linked by UID
    sg_time = datetime.now(sg_timezone)
    user_data = {
        "email": email,
        "role": role,
        "created_at": sg_time,
        "last_login": sg_time
    }

    db.collection("users").document(user.uid).set(user_data)
    print("Firestore user document created")

if __name__ == "__main__":
    email = "testingforsystemadmin@gmail.com"
    password = "testingforsystemadmin" # Must be >= 6 characters
    role = "system administrator"
    
    signup(email, password, role)
