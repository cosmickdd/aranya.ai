from PIL import Image
import os

os.makedirs('assets/images', exist_ok=True)

# Process Onboarding 1
try:
    img = Image.open('figma_images/19_10.png')
    w, h = img.size
    # crop top 44px (status bar) and bottom above text
    crop_h = int(h * 0.52) # Adjusted to not be too tall
    cropped = img.crop((0, 48, w, crop_h))
    cropped.save('assets/images/onboarding_illustration.png')
    print(f"Cropped onboarding: {w}x{h} -> {w}x{crop_h - 48}")
except Exception as e:
    print(f"Error cropping onboarding: {e}")

# Process Sign In
try:
    img = Image.open('figma_images/72_239.png')
    w, h = img.size
    # crop top 44px (status bar) and bottom above "Welcome Back"
    # "Welcome Back" starts around h*0.33, so let's crop at h*0.31
    crop_h = int(h * 0.31)
    cropped = img.crop((0, 48, w, crop_h))
    cropped.save('assets/images/signin_illustration.png')
    print(f"Cropped signin: {w}x{h} -> {w}x{crop_h - 48}")
except Exception as e:
    print(f"Error cropping signin: {e}")
