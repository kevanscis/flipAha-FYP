import io
import os
from PIL import Image, ImageDraw, ImageFont

from backend.image_processor import ImageProcessor
from backend.latex_converter import LatexConverter


def _make_test_image_bytes() -> bytes:
    width, height = 1400, 350
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)

    font_candidates = [
        "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
        "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
    ]

    font = None
    for path in font_candidates:
        if os.path.exists(path):
            try:
                font = ImageFont.truetype(path, 96)
                break
            except Exception:
                pass

    if font is None:
        font = ImageFont.load_default()

    # Note: this is not true LaTeX rendering—just a smoke-test image.
    text = r"x^2 + y^2 = 1    int_0^1 x^2 dx"

    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((width - tw) // 2, (height - th) // 2), text, fill="black", font=font)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def main() -> None:
    img_bytes = _make_test_image_bytes()

    processor = ImageProcessor()
    converter = LatexConverter()

    def pil_to_bytes(pil_img: Image.Image) -> bytes:
        buf = io.BytesIO()
        pil_img.save(buf, format="PNG")
        return buf.getvalue()

    variants: list[tuple[str, bytes]] = [
        ("raw", img_bytes),
        ("mild", pil_to_bytes(processor.preprocess_image(img_bytes, mode="mild"))),
        ("binarize", pil_to_bytes(processor.preprocess_image(img_bytes, mode="binarize"))),
    ]

    best: dict | None = None
    attempts: list[dict] = []

    for tag, variant_bytes in variants:
        result = converter.convert_to_latex(variant_bytes)
        if not result.get("success"):
            attempts.append({"variant": tag, "success": False, "error": result.get("error")})
            continue

        score = converter.score_latex(result.get("latex", ""))
        attempts.append({
            "variant": tag,
            "success": True,
            "score": score["score"],
            "valid": score["valid"],
            "errors": score["errors"],
        })

        if best is None or score["score"] > best["score"]:
            best = {
                "variant": tag,
                "score": score["score"],
                "valid": score["valid"],
                "errors": score["errors"],
                "latex": result.get("latex", ""),
            }

    print("attempts=", attempts)
    if best is None:
        raise SystemExit("No successful conversion attempts")

    print("best_variant=", best["variant"])
    print("best_valid=", best["valid"], "errors=", best["errors"])
    latex_preview = (best["latex"] or "").strip().replace("\n", " ")
    print("best_latex_preview=", latex_preview[:200] + ("..." if len(latex_preview) > 200 else ""))


if __name__ == "__main__":
    main()
