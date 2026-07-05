import json

with open('figma_design.json') as f:
    data = json.load(f)

nodes = data.get('nodes', {})
for node_id, node_data in nodes.items():
    doc = node_data.get('document', {})
    if 'children' in doc:
        for child in doc['children']:
            print(f'{child.get("name")}: {child.get("id")}')
