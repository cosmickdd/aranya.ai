import json

with open('figma_design.json') as f:
    data = json.load(f)

def print_tree(node, depth=0):
    indent = "  " * depth
    name = node.get("name", "Unknown")
    node_id = node.get("id", "Unknown")
    node_type = node.get("type", "Unknown")
    print(f"{indent}- {name} (ID: {node_id}, Type: {node_type})")
    for child in node.get("children", []):
        print_tree(child, depth + 1)

nodes = data.get('nodes', {})
for node_id, node_data in nodes.items():
    doc = node_data.get('document', {})
    if 'children' in doc:
        for child in doc['children']:
            if child.get("name") in ["Onboarding 1", "Sign In", "Sign Up"]:
                print(f"\nAnalyzing: {child.get('name')}")
                print_tree(child)
