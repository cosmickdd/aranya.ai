import os
import requests
import urllib.request
from dotenv import load_dotenv

load_dotenv('../../.env')
token = os.getenv('FIGMA_PERSONAL_ACCESS_TOKEN') or os.getenv('FIGMA_TOKEN')
if not token:
    with open('../../.env', 'r') as f:
        for line in f:
            if 'figd_' in line:
                token = line.split('=')[1].strip()
                break

FILE_KEY = 'pwzdCmyNHbjZY5OQ0NnjXK'
# 19:14 = Onboarding Illus, 107:27 = Sign In Illus, 72:285 = Google Logo
NODE_IDS = '19:14,107:27,72:285'

headers = {'X-Figma-Token': token}
# Fetch high-res PNGs
url = f"https://api.figma.com/v1/images/{FILE_KEY}?ids={NODE_IDS}&format=png&scale=3"

print(f"Fetching {url}...")
response = requests.get(url, headers=headers)

if response.status_code == 200:
    data = response.json()
    images = data.get('images', {})
    
    os.makedirs('assets/images', exist_ok=True)
    
    name_map = {
        '19:14': 'onboarding_illustration.png',
        '107:27': 'signin_illustration.png',
        '72:285': 'google_logo.png'
    }
    
    for node_id, img_url in images.items():
        if img_url:
            filename = f"assets/images/{name_map[node_id]}"
            print(f"Downloading {node_id} to {filename}...")
            urllib.request.urlretrieve(img_url, filename)
    print("Done downloading high-res assets.")
else:
    print(f"Error: {response.status_code}")
    print(response.text)
