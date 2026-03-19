"""
Simple test to verify the backend services are working
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.image_processor import ImageProcessor
from backend.session_manager import SessionManager

def test_image_processor():
    print("Testing ImageProcessor...")
    processor = ImageProcessor()
    
    # Create a simple test image
    from PIL import Image
    import io
    
    img = Image.new('RGB', (200, 100), color='white')
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    image_data = buffer.getvalue()
    
    # Test quality check
    result = processor.check_image_quality(image_data)
    print(f"✓ Quality check: valid={result['valid']}, warnings={len(result['warnings'])}")
    
    # Test base64 conversion
    b64 = processor.image_to_base64(image_data)
    print(f"✓ Base64 conversion: {len(b64)} chars")
    
    return True

def test_session_manager():
    print("\nTesting SessionManager...")
    manager = SessionManager()
    
    # Create session
    session_id = manager.create_session()
    print(f"✓ Created session: {session_id}")
    
    # Add image
    image_id = manager.add_image(
        session_id=session_id,
        image_data=b'test_data',
        filename='test.png',
        latex='x^2',
        confidence=0.85
    )
    print(f"✓ Added image: {image_id}")
    
    # Get image
    img = manager.get_image(session_id, image_id)
    print(f"✓ Retrieved image: {img['filename']}")
    
    # Rate image
    success = manager.rate_image(session_id, image_id, 5)
    print(f"✓ Rated image: {success}")
    
    # Get stats
    stats = manager.get_session_stats(session_id)
    print(f"✓ Session stats: {stats['total_images']} images, avg rating: {stats['average_rating']}")
    
    return True

def test_latex_converter():
    print("\nTesting LatexConverter...")
    print("⚠ Model loading may take 1-2 minutes on first run...")
    
    try:
        from backend.latex_converter import LatexConverter
        converter = LatexConverter()
        print("✓ Model initialized successfully")
        return True
    except Exception as e:
        print(f"✗ Model initialization failed: {e}")
        print("  This is normal if dependencies aren't fully installed yet")
        return False

if __name__ == '__main__':
    print("=" * 50)
    print("FlipAha Backend Test Suite")
    print("=" * 50)
    
    tests = [
        ("Image Processor", test_image_processor),
        ("Session Manager", test_session_manager),
        ("LaTeX Converter", test_latex_converter),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            success = test_func()
            results.append((name, success))
        except Exception as e:
            print(f"\n✗ {name} failed: {e}")
            results.append((name, False))
    
    print("\n" + "=" * 50)
    print("Test Results:")
    print("=" * 50)
    
    for name, success in results:
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{status} - {name}")
    
    total = len(results)
    passed = sum(1 for _, success in results if success)
    print(f"\nPassed: {passed}/{total}")
    
    if passed == total:
        print("\n🎉 All tests passed!")
    else:
        print("\n⚠ Some tests failed. Check dependencies.")
