#!/usr/bin/env python3
"""
Test script to verify confidence scores are returned from the API
"""
import requests
import json
from pathlib import Path

# Test with a local image or create a simple test image
from PIL import Image, ImageDraw, ImageFont
import io

def create_test_equation_image():
    """Create a simple test image with an equation"""
    img = Image.new('RGB', (300, 100), color='white')
    draw = ImageDraw.Draw(img)
    
    # Draw some text representing an equation
    try:
        # Try to use a larger font if available
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 36)
    except:
        font = ImageFont.load_default()
    
    draw.text((20, 30), "x^2 + 2x + 1", fill='black', font=font)
    
    # Convert to bytes
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    return img_bytes

def test_confidence_flow():
    """Test the complete flow and check confidence scores"""
    base_url = "http://localhost:5000/api"
    
    print("=" * 60)
    print("Testing Confidence Score Flow")
    print("=" * 60)
    
    # 1. Create session
    print("\n1. Creating session...")
    response = requests.post(f"{base_url}/session")
    if response.status_code != 200:
        print(f"❌ Failed to create session: {response.status_code}")
        print(response.text)
        return
    
    session_data = response.json()
    session_id = session_data['session_id']
    print(f"✓ Session created: {session_id}")
    
    # 2. Upload image
    print("\n2. Uploading test image...")
    test_image = create_test_equation_image()
    files = {'file': ('test_equation.png', test_image, 'image/png')}
    data = {'session_id': session_id}
    
    response = requests.post(f"{base_url}/upload", files=files, data=data)
    if response.status_code != 200:
        print(f"❌ Failed to upload: {response.status_code}")
        print(response.text)
        return
    
    upload_data = response.json()
    image_id = upload_data['image_id']
    print(f"✓ Image uploaded: {image_id}")
    
    # 3. Check confidence before conversion (should be 0)
    print("\n3. Checking confidence before conversion...")
    response = requests.get(f"{base_url}/image/{image_id}", params={'session_id': session_id})
    if response.status_code != 200:
        print(f"❌ Failed to get image: {response.status_code}")
        return
    
    image_data = response.json()['image']
    confidence_before = image_data.get('confidence', 'NOT FOUND')
    print(f"Confidence before conversion: {confidence_before}")
    print(f"Full image data: {json.dumps(image_data, indent=2)}")
    
    # 4. Convert to LaTeX
    print("\n4. Converting to LaTeX...")
    convert_payload = {
        'session_id': session_id,
        'image_id': image_id
    }
    
    response = requests.post(f"{base_url}/convert", json=convert_payload)
    if response.status_code != 200:
        print(f"❌ Failed to convert: {response.status_code}")
        print(response.text)
        return
    
    convert_data = response.json()
    print(f"✓ Conversion successful")
    print(f"LaTeX: {convert_data.get('latex', 'NOT FOUND')}")
    print(f"Confidence in response: {convert_data.get('confidence', 'NOT FOUND')}")
    print(f"Model used: {convert_data.get('model', 'NOT FOUND')}")
    print(f"\nFull convert response:")
    print(json.dumps(convert_data, indent=2))
    
    # 5. Check confidence after conversion
    print("\n5. Checking confidence after conversion...")
    response = requests.get(f"{base_url}/image/{image_id}", params={'session_id': session_id})
    if response.status_code != 200:
        print(f"❌ Failed to get image: {response.status_code}")
        return
    
    image_data = response.json()['image']
    confidence_after = image_data.get('confidence', 'NOT FOUND')
    print(f"Confidence after conversion: {confidence_after}")
    
    # 6. Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Session ID: {session_id}")
    print(f"Image ID: {image_id}")
    print(f"Confidence before: {confidence_before}")
    print(f"Confidence in convert response: {convert_data.get('confidence', 'NOT FOUND')}")
    print(f"Confidence after: {confidence_after}")
    
    if confidence_after != 'NOT FOUND' and confidence_after > 0:
        print("\n✅ PASS: Confidence scores are working correctly!")
    elif confidence_after == 0:
        print("\n⚠️  WARNING: Confidence is 0 - may not display in UI")
    else:
        print("\n❌ FAIL: Confidence scores are missing!")
    
    print("=" * 60)

if __name__ == "__main__":
    try:
        test_confidence_flow()
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to backend at http://localhost:5000")
        print("Please make sure the Flask backend is running.")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
