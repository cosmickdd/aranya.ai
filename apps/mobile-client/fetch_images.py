import os
import requests
import json
from dotenv import load_dotenv
import urllib.request

load_dotenv('../../.env')
token = os.getenv('FIGMA_PERSONAL_ACCESS_TOKEN') or os.getenv('FIGMA_TOKEN')
if not token:
    with open('../../.env', 'r') as f:
        for line in f:
            if 'figd_' in line:
                token = line.split('=')[1].strip()
                break

FILE_KEY = 'pwzdCmyNHbjZY5OQ0NnjXK'
NODE_IDS = '19:10,19:28,19:46,72:239,72:292'

headers = {'X-Figma-Token': token}
url = f"https://api.figma.com/v1/images/{FILE_KEY}?ids={NODE_IDS}&format=png"

print(f"Fetching {url}...")
response = requests.get(url, headers=headers)

if response.status_code == 200:
    data = response.json()
    images = data.get('images', {})
    
    os.makedirs('figma_images', exist_ok=True)
    
    for node_id, img_url in images.items():
        if img_url:
            filename = f"figma_images/{node_id.replace(':', '_')}.png"
            print(f"Downloading {node_id} to {filename}...")
            urllib.request.urlretrieve(img_url, filename)
    print("Done downloading images.")
else:
    print(f"Error: {response.status_code}")
    print(response.text)
