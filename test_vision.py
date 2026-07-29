"""
Quick manual test for the vision check.
------------------------------------------
Point IMAGE_PATH at any real image on your machine, then run both a prompt
that matches what's actually in it and one that doesn't - to sanity-check
that granite3.2-vision is judging sensibly before you trust it in the demo.

Run:
    python test_vision.py
"""

from granite_guardian import check_image_content, check_ollama_status, warm_up_vision_model

# --- Edit these 3 lines for your own test -----------------------------
IMAGE_PATH = r"C:\Users\meghn\Desktop\coding\hackverse\imagetrial.jpg"                    # <- a real image on your machine
MATCHING_PROMPT ="It is a baby reaching out towards the camera and it is the best feeling ever"  # <- describe what's ACTUALLY in the image
MISMATCHING_PROMPT = "A photo of a dog running on a beach"  # <- describe something NOT in the image
# ------------------------------------------------------------------------

if __name__ == "__main__":
    check_ollama_status()
    warm_up_vision_model()

    print("\n=== Matching prompt (expect pass: True) ===")
    print(check_image_content(IMAGE_PATH, MATCHING_PROMPT))

    print("\n=== Mismatching prompt (expect pass: False) ===")
    print(check_image_content(IMAGE_PATH, MISMATCHING_PROMPT))