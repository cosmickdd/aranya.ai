from PIL import Image
import os

os.makedirs('assets/images', exist_ok=True)

# Process Onboarding 1
try:
    img = Image.open('figma_images/19_10.png')
    w, h = img.size
    # crop top part (from 0 to just above text)
    crop_h = int(h * 0.56)
    cropped = img.crop((0, 0, w, crop_h))
    cropped.save('assets/images/onboarding_illustration.png')
    print(f"Cropped onboarding: {w}x{h} -> {w}x{crop_h}")
except Exception as e:
    print(f"Error cropping onboarding: {e}")

# Process Sign In
try:
    img = Image.open('figma_images/72_239.png')
    w, h = img.size
    # crop top part (from 0 to just above "Welcome Back")
    crop_h = int(h * 0.35)
    cropped = img.crop((0, 0, w, crop_h))
    cropped.save('assets/images/signin_illustration.png')
    print(f"Cropped signin: {w}x{h} -> {w}x{crop_h}")
except Exception as e:
    print(f"Error cropping signin: {e}")
