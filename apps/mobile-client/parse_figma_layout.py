import json

def rgba_to_hex(r, g, b, a=1):
    return f"#{int(r*255):02x}{int(g*255):02x}{int(b*255):02x}"

def build_tree(node, depth=0):
    name = node.get("name", "Unknown")
    node_type = node.get("type", "Unknown")
    
    details = {}
    
    # Bounding box
    bbox = node.get("absoluteBoundingBox")
    if bbox:
        details["bbox"] = {"w": bbox.get('width', 0), "h": bbox.get('height', 0)}
        
    # Text styles
    style = node.get("style")
    if style:
        fs = style.get("fontSize")
        fw = style.get("fontWeight")
        ff = style.get("fontFamily")
        if fs: details["font"] = f"{fs}px {fw} {ff}"
        
    # Fills
    fills = node.get("fills", [])
    if fills:
        for fill in fills:
            if fill.get("type") == "SOLID":
                color = fill.get("color", {})
                details["fill"] = rgba_to_hex(color.get('r',0), color.get('g',0), color.get('b',0))
                
    # Corner radius
    cr = node.get("cornerRadius")
    if cr:
        details["radius"] = cr
        
    res = {"name": name, "type": node_type, "details": details, "children": []}
    
    for child in node.get("children", []):
        res["children"].append(build_tree(child, depth + 1))
        
    return res

with open('figma_design.json') as f:
    data = json.load(f)

output = []
nodes = data.get('nodes', {})
for node_id, node_data in nodes.items():
    doc = node_data.get('document', {})
    if 'children' in doc:
        for child in doc['children']:
            if child.get("name") in ["Onboarding 1", "Sign In", "Sign Up"]:
                output.append(build_tree(child))

with open('layout_data.json', 'w', encoding='utf-8') as out:
    json.dump(output, out, indent=2)
