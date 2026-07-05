import os
import requests
import json
from dotenv import load_dotenv

load_dotenv('../../.env')
token = os.getenv('FIGMA_PERSONAL_ACCESS_TOKEN') or os.getenv('FIGMA_TOKEN')
if not token:
    # Try reading directly if env fails
    with open('../../.env', 'r') as f:
        for line in f:
            if 'figd_' in line:
                token = line.split('=')[1].strip()
                break

if not token:
    print("No token found!")
    exit(1)

FILE_KEY = 'pwzdCmyNHbjZY5OQ0NnjXK'
NODE_ID = '0:1'

headers = {'X-Figma-Token': token}
url = f"https://api.figma.com/v1/files/{FILE_KEY}/nodes?ids={NODE_ID}"

print(f"Fetching {url}...")
response = requests.get(url, headers=headers)

if response.status_code == 200:
    data = response.json()
    with open('figma_design.json', 'w') as f:
        json.dump(data, f, indent=2)
    print("Successfully fetched Figma design into figma_design.json")
    
    # Print a quick summary of the nodes
    nodes = data.get('nodes', {})
    for node_id, node_data in nodes.items():
        doc = node_data.get('document', {})
        print(f"Node Name: {doc.get('name')}")
        print(f"Type: {doc.get('type')}")
        if 'children' in doc:
            for child in doc['children']:
                print(f"  - {child.get('name')} ({child.get('type')})")
else:
    print(f"Error: {response.status_code}")
    print(response.text)
