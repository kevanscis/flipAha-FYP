# import os
# import io
# import base64
# from typing import Tuple, Dict, Optional

# # Conditional heavy imports — skip on free-tier deploy
# _LITE_MODE = os.getenv("LITE_MODE", "").lower() in ("1", "true", "yes")

# if _LITE_MODE:
#     cv2 = None
#     np = None
#     Image = None
#     ImageOps = None
#     ImageFilter = None
# else:
#     import cv2
#     import numpy as np
#     from PIL import Image
#     from PIL import ImageOps, ImageFilter

# class ImageProcessor:
#     """Handles image quality checking and preprocessing"""
    
#     def __init__(self):
#         self.min_resolution = (100, 100)
#         self.max_file_size = 10 * 1024 * 1024  # 10MB
#         self.quality_threshold = 50  # Laplacian variance threshold
    
#     def check_image_quality(self, image_data: bytes) -> Dict[str, any]:
#         """
#         Check if image quality is sufficient for processing
#         Returns dict with 'valid' boolean and 'warnings' list
#         """
#         try:
#             # Convert bytes to PIL Image
#             image = Image.open(io.BytesIO(image_data))
            
#             # Convert to numpy array for OpenCV
#             img_array = np.array(image.convert('RGB'))
#             img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
            
#             warnings = []
            
#             # Check 1: Resolution
#             width, height = image.size
#             if width < self.min_resolution[0] or height < self.min_resolution[1]:
#                 warnings.append(f"Image resolution ({width}x{height}) is too low. Minimum recommended: {self.min_resolution[0]}x{self.min_resolution[1]}")
            
#             # Check 2: File size
#             if len(image_data) > self.max_file_size:
#                 warnings.append(f"Image file size is too large ({len(image_data) / 1024 / 1024:.1f}MB). Maximum: {self.max_file_size / 1024 / 1024}MB")
            
#             # Check 3: Sharpness (using Laplacian variance)
#             gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
#             laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            
#             if laplacian_var < self.quality_threshold:
#                 warnings.append(f"Image appears blurry (sharpness score: {laplacian_var:.1f}). Please ensure the image is in focus for better accuracy.")
            
#             # Check 4: Brightness
#             brightness = np.mean(gray)
#             if brightness < 50:
#                 warnings.append("Image is too dark. Please use better lighting.")
#             elif brightness > 200:
#                 warnings.append("Image is overexposed. Please reduce brightness.")
            
#             # Check 5: Contrast
#             contrast = gray.std()
#             if contrast < 30:
#                 warnings.append("Image has low contrast. This may affect equation detection.")
            
#             return {
#                 'valid': len([w for w in warnings if 'too low' in w or 'too large' in w]) == 0,
#                 'warnings': warnings,
#                 'metrics': {
#                     'resolution': f"{width}x{height}",
#                     'sharpness': float(laplacian_var),
#                     'brightness': float(brightness),
#                     'contrast': float(contrast)
#                 }
#             }
            
#         except Exception as e:
#             return {
#                 'valid': False,
#                 'warnings': [f"Failed to process image: {str(e)}"],
#                 'metrics': {}
#             }
    
#     def preprocess_image(self, image_data: bytes, mode: str = 'mild') -> Image.Image:
#         """Preprocess image for better LaTeX conversion.

#         Modes:
#         - 'none': return original image (EXIF-corrected)
#         - 'mild': EXIF-correct + autocontrast + mild sharpen + optional upscale
#         - 'binarize': grayscale + denoise + adaptive threshold (high-contrast, can harm Pix2Tex)
#         """
#         try:
#             image = Image.open(io.BytesIO(image_data))
#             image = ImageOps.exif_transpose(image)

#             mode = (mode or 'mild').strip().lower()
#             if mode == 'none':
#                 return image

#             if mode == 'binarize':
#                 img_array = np.array(image.convert('RGB'))
#                 img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
#                 gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
#                 denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
#                 thresh = cv2.adaptiveThreshold(
#                     denoised,
#                     255,
#                     cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
#                     cv2.THRESH_BINARY,
#                     11,
#                     2,
#                 )
#                 return Image.fromarray(thresh)

#             # default: mild
#             img = image.convert('RGB')
#             img = ImageOps.autocontrast(img, cutoff=1)
#             img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=140, threshold=3))

#             # Pix2Tex tends to do better with reasonable resolution.
#             w, h = img.size
#             max_side = max(w, h)
#             if max_side < 900:
#                 scale = 900 / max_side
#                 new_size = (int(round(w * scale)), int(round(h * scale)))
#                 img = img.resize(new_size, resample=Image.Resampling.LANCZOS)

#             return img

#         except Exception:
#             return Image.open(io.BytesIO(image_data))
    
#     def crop_image(self, image_data: bytes, crop_coords: Dict[str, int]) -> bytes:
#         """
#         Crop image based on coordinates
#         crop_coords: {'x': int, 'y': int, 'width': int, 'height': int}
#         """
#         try:
#             image = Image.open(io.BytesIO(image_data))
            
#             x = crop_coords.get('x', 0)
#             y = crop_coords.get('y', 0)
#             width = crop_coords.get('width', image.width)
#             height = crop_coords.get('height', image.height)
            
#             # Crop using PIL (left, upper, right, lower)
#             cropped = image.crop((x, y, x + width, y + height))
            
#             # Convert back to bytes
#             buffer = io.BytesIO()
#             cropped.save(buffer, format='PNG')
#             return buffer.getvalue()
            
#         except Exception as e:
#             raise ValueError(f"Failed to crop image: {str(e)}")
    
#     def image_to_base64(self, image_data: bytes) -> str:
#         """Convert image bytes to base64 string"""
#         return base64.b64encode(image_data).decode('utf-8')
    
#     def base64_to_image(self, base64_string: str) -> bytes:
#         """Convert base64 string to image bytes"""
#         return base64.b64decode(base64_string)
