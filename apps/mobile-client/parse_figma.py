import json

with open('figma_design.json') as f:
    data = json.load(f)

nodes = data.get('nodes', {})
for node_id, node_data in nodes.items():
    doc = node_data.get('document', {})
    if 'children' in doc:
        for child in doc['children']:
            print(f'\n--- Frame: {child.get("name")} ---')
            for sub in child.get('children', []):
                if sub.get('type') == 'TEXT':
                    print(f'Text: {sub.get("characters")}')
                elif sub.get('type') == 'INSTANCE' or sub.get('type') == 'FRAME':
                    print(f'Component: {sub.get("name")}')
