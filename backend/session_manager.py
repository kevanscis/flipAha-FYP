import uuid
import time
from typing import Dict, List, Optional
from datetime import datetime, timedelta

class SessionManager:
    """
    Manages session-based storage for uploaded images and their LaTeX conversions
    In-memory storage (for production, consider Redis or database)
    """
    
    def __init__(self, session_timeout_hours: int = 24):
        self.sessions = {}  # session_id -> session_data
        self.session_timeout = session_timeout_hours * 3600  # Convert to seconds
    
    def create_session(self) -> str:
        """Create a new session and return session ID"""
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = {
            'created_at': time.time(),
            'last_accessed': time.time(),
            'images': {}  # image_id -> image_data
        }
        return session_id
    
    def get_or_create_session(self, session_id: Optional[str] = None) -> str:
        """Get existing session or create new one if not found/expired"""
        if session_id and session_id in self.sessions:
            session = self.sessions[session_id]
            # Check if session expired
            if time.time() - session['last_accessed'] < self.session_timeout:
                session['last_accessed'] = time.time()
                return session_id
        
        # Create new session if not found or expired
        return self.create_session()
    
    def add_image(self, session_id: str, image_data: bytes, filename: str, 
                  latex: str = '', confidence: float = 0.0) -> str:
        """
        Add image to session storage
        Returns image_id
        """
        if session_id not in self.sessions:
            raise ValueError("Invalid session ID")
        
        image_id = str(uuid.uuid4())
        
        self.sessions[session_id]['images'][image_id] = {
            'id': image_id,
            'filename': filename,
            'image_data': image_data,
            'latex': latex,
            'edited_latex': latex,  # User can edit this
            'confidence': confidence,
            'uploaded_at': datetime.now().isoformat(),
            'rating': None,
            'metadata': {}
        }
        
        self.sessions[session_id]['last_accessed'] = time.time()
        
        return image_id
    
    def get_image(self, session_id: str, image_id: str) -> Optional[Dict]:
        """Get image data from session"""
        if session_id not in self.sessions:
            return None
        
        return self.sessions[session_id]['images'].get(image_id)
    
    def get_all_images(self, session_id: str) -> List[Dict]:
        """Get all images in a session"""
        if session_id not in self.sessions:
            return []
        
        # Return images without raw image_data to reduce payload
        images = []
        for img_id, img_data in self.sessions[session_id]['images'].items():
            images.append({
                'id': img_data['id'],
                'filename': img_data['filename'],
                'latex': img_data['latex'],
                'edited_latex': img_data['edited_latex'],
                'confidence': img_data['confidence'],
                'uploaded_at': img_data['uploaded_at'],
                'rating': img_data['rating'],
                'metadata': img_data.get('metadata', {})
            })
        
        return images
    
    def update_latex(self, session_id: str, image_id: str, edited_latex: str) -> bool:
        """Update the edited LaTeX for an image"""
        image = self.get_image(session_id, image_id)
        if not image:
            return False
        
        image['edited_latex'] = edited_latex
        self.sessions[session_id]['last_accessed'] = time.time()
        return True

    def rename_image(self, session_id: str, image_id: str, filename: str) -> bool:
        """Update the display filename for an image."""
        image = self.get_image(session_id, image_id)
        if not image:
            return False

        name = (filename or '').strip()
        if not name:
            return False

        # Keep this as a display name (not a filesystem path).
        name = name.replace('\n', ' ').replace('\r', ' ').replace('\t', ' ')
        name = name.replace('/', '-').replace('\\', '-')
        if len(name) > 160:
            name = name[:160].rstrip()

        image['filename'] = name
        self.sessions[session_id]['last_accessed'] = time.time()
        return True
    
    def rate_image(self, session_id: str, image_id: str, rating: int) -> bool:
        """
        Rate the LaTeX conversion quality (1-5 stars)
        """
        if rating < 1 or rating > 5:
            return False
        
        image = self.get_image(session_id, image_id)
        if not image:
            return False
        
        image['rating'] = rating
        self.sessions[session_id]['last_accessed'] = time.time()
        return True
    
    def delete_image(self, session_id: str, image_id: str) -> bool:
        """Delete an image from session"""
        if session_id not in self.sessions:
            return False
        
        if image_id in self.sessions[session_id]['images']:
            del self.sessions[session_id]['images'][image_id]
            self.sessions[session_id]['last_accessed'] = time.time()
            return True
        
        return False
    
    def cleanup_expired_sessions(self):
        """Remove expired sessions"""
        current_time = time.time()
        expired_sessions = [
            sid for sid, session in self.sessions.items()
            if current_time - session['last_accessed'] > self.session_timeout
        ]
        
        for sid in expired_sessions:
            del self.sessions[sid]
        
        return len(expired_sessions)
    
    def get_session_stats(self, session_id: str) -> Optional[Dict]:
        """Get statistics about a session"""
        if session_id not in self.sessions:
            return None
        
        session = self.sessions[session_id]
        images = session['images']
        
        total_ratings = [img['rating'] for img in images.values() if img['rating'] is not None]
        
        return {
            'total_images': len(images),
            'created_at': datetime.fromtimestamp(session['created_at']).isoformat(),
            'last_accessed': datetime.fromtimestamp(session['last_accessed']).isoformat(),
            'average_rating': sum(total_ratings) / len(total_ratings) if total_ratings else None,
            'rated_images': len(total_ratings)
        }
