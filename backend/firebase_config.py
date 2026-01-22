import firebase_admin
from firebase_admin import credentials, firestore, auth

# Firebase Authentication
def verify_id_token(id_token):
    decoded_token = auth.verify_id_token(id_token)
    return decoded_token

# Firebase Database
def initialize_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(
            "firebase_service_account.json"
        )
        firebase_admin.initialize_app(cred)

    db = firestore.client()
    return db
